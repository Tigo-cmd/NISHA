"""
YAMNet Audio Classifier — Offline Local Model with Severity Tiers
------------------------------------------------------------------
Loads the YAMNet SavedModel from the local `yamnet_model/` directory.
Fully offline — no network access required.

Severity Tiers:
  TIER 1 (CRITICAL): Gunshots, Explosions, Screaming → immediate full-screen alert + Telegram
  TIER 2 (HIGH):     Sirens, Fire alarms, Glass shatter → toast + Telegram after confirmation
  TIER 3 (MEDIUM):   Alarms, Cap guns → toast only, no Telegram
"""

import numpy as np
import csv
import os
import time
import logging
from collections import deque

logger = logging.getLogger(__name__)

# Resolve the path relative to this file so it works regardless of cwd
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
YAMNET_MODEL_DIR = os.path.join(_THIS_DIR, "yamnet_model")
YAMNET_CLASS_MAP = os.path.join(YAMNET_MODEL_DIR, "assets", "yamnet_class_map.csv")


# ── Severity Tier Definitions ──────────────────────────────────────────
TIER_1_CRITICAL = {
    "Gunshot, gunfire",
    "Machine gun",
    "Fusillade",
    "Artillery fire",
    "Explosion",
    "Screaming",
}

TIER_2_HIGH = {
    "Siren",
    "Civil defense siren",
    "Emergency vehicle",
    "Police car (siren)",
    "Ambulance (siren)",
    "Fire engine, fire truck (siren)",
    "Fire alarm",
    "Smoke detector, smoke alarm",
    "Shatter",
}

TIER_3_MEDIUM = {
    "Alarm",
    "Cap gun",
}

# All danger classes combined
ALL_DANGER_CLASSES = TIER_1_CRITICAL | TIER_2_HIGH | TIER_3_MEDIUM

# Confidence thresholds per tier
CONFIDENCE_THRESHOLDS = {
    "critical": 0.30,   # TIER 1: Lower threshold — these are urgent
    "high":     0.30,   # TIER 2: Moderate threshold
    "medium":   0.20,   # TIER 3: Can be lower since it's just a toast
}

# Telegram thresholds (slightly higher than display to reduce false alerts)
TELEGRAM_THRESHOLDS = {
    "critical": 0.25,   # Real detections show 0.17-0.30 range
    "high":     0.30,   # Require moderate confidence + consecutive for TIER 2
    "medium":   999,    # Never send Telegram for medium
}


def get_severity_tier(class_name: str) -> str | None:
    """Returns 'critical', 'high', 'medium', or None."""
    if class_name in TIER_1_CRITICAL:
        return "critical"
    elif class_name in TIER_2_HIGH:
        return "high"
    elif class_name in TIER_3_MEDIUM:
        return "medium"
    return None


class YAMNetClassifier:
    def __init__(self):
        self.model = None
        self.class_names = []
        self._is_initialized = False

        # Classes that indicate we should pass audio to Whisper for transcription
        self.SPEECH_CLASSES = {
            "Speech",
            "Child speech, kid speaking",
            "Conversation",
            "Narration, monologue",
            "Babbling",
            "Whispering",
            "Shout",
        }

        # ── Consecutive Detection Buffer ────────────────────────────
        # Stores (class_name, confidence, timestamp) for recent detections
        # Used to require 2 detections within 5 seconds for TIER 2 Telegram alerts
        self._recent_detections: deque = deque(maxlen=20)
        self._CONSECUTIVE_WINDOW = 5.0  # seconds

    def initialize(self):
        """Load the YAMNet SavedModel and class-name list from disk."""
        if self._is_initialized:
            return

        logger.info("Loading YAMNet from local SavedModel: %s", YAMNET_MODEL_DIR)
        try:
            import tensorflow as tf
            self.model = tf.saved_model.load(YAMNET_MODEL_DIR)
            logger.info("YAMNet loaded successfully (offline).")
        except Exception as e:
            logger.error("Failed to load YAMNet from %s: %s", YAMNET_MODEL_DIR, e)
            self.model = None

        self.class_names = self._load_class_names()
        if self.class_names:
            logger.info("Loaded %d YAMNet class names.", len(self.class_names))
        else:
            logger.warning("No class names loaded — classification labels will be unavailable.")

        self._is_initialized = True

    def _load_class_names(self) -> list[str]:
        """Read display_name column from the local yamnet_class_map.csv."""
        if not os.path.isfile(YAMNET_CLASS_MAP):
            logger.error("Class map CSV not found at %s", YAMNET_CLASS_MAP)
            return []
        try:
            with open(YAMNET_CLASS_MAP, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                return [row["display_name"] for row in reader]
        except Exception as e:
            logger.error("Failed to parse class map CSV: %s", e)
            return []

    def _has_consecutive_detection(self, class_name: str) -> bool:
        """Check if we've seen the same (or similar tier) class within the last N seconds."""
        now = time.time()
        tier = get_severity_tier(class_name)
        if not tier:
            return False

        # Get the set of classes in the same tier for fuzzy matching
        if tier == "critical":
            tier_classes = TIER_1_CRITICAL
        elif tier == "high":
            tier_classes = TIER_2_HIGH
        else:
            tier_classes = TIER_3_MEDIUM

        count = 0
        for det_class, det_conf, det_time in self._recent_detections:
            if (now - det_time) <= self._CONSECUTIVE_WINDOW and det_class in tier_classes:
                count += 1
        
        return count >= 1  # Current detection + 1 previous = 2 total

    def classify_frame(
        self, waveform: np.ndarray, top_k: int = 5
    ) -> tuple[bool, str | None, float, str | None, bool]:
        """
        Classifies a 16 kHz mono audio frame.

        Args:
            waveform: 1-D numpy array of float32 samples at 16 kHz.
            top_k:    Number of top predictions to inspect.

        Returns:
            (is_speech, alert_class, alert_confidence, severity, send_telegram)
            - is_speech:         True if a speech-related class is in the top-K.
            - alert_class:       Name of the highest-confidence danger class, or None.
            - alert_confidence:  Confidence score of that danger class.
            - severity:          'critical', 'high', 'medium', or None.
            - send_telegram:     True if this alert should be sent to Telegram.
        """
        import tensorflow as tf

        self.initialize()

        if self.model is None or len(self.class_names) == 0:
            return True, None, 0.0, None, False

        # ── Normalise input ─────────────────────────────────────────
        if waveform.dtype != np.float32:
            waveform = waveform.astype(np.float32)

        if np.max(np.abs(waveform)) > 1.0:
            waveform = waveform / 32768.0

        # ── Run inference ───────────────────────────────────────────
        waveform_tensor = tf.constant(waveform, dtype=tf.float32)
        scores, embeddings, spectrogram = self.model(waveform_tensor)

        mean_scores = tf.reduce_mean(scores, axis=0).numpy()
        top_indices = np.argsort(mean_scores)[::-1][:top_k]

        is_speech = False
        alert_class = None
        alert_confidence = 0.0
        severity = None
        send_telegram = False

        for idx in top_indices:
            class_name = self.class_names[idx]
            score = float(mean_scores[idx])

            if class_name in self.SPEECH_CLASSES and score > 0.05:
                is_speech = True

            if class_name in ALL_DANGER_CLASSES:
                tier = get_severity_tier(class_name)
                threshold = CONFIDENCE_THRESHOLDS.get(tier, 0.30)

                if score > threshold and alert_class is None:
                    alert_class = class_name
                    alert_confidence = score
                    severity = tier

        # ── Evaluate Telegram eligibility ───────────────────────────
        if alert_class and severity:
            now = time.time()
            # Record this detection
            self._recent_detections.append((alert_class, alert_confidence, now))

            telegram_threshold = TELEGRAM_THRESHOLDS.get(severity, 999)

            if severity == "critical" and alert_confidence >= telegram_threshold:
                # TIER 1: Always send to Telegram if confidence is high enough
                send_telegram = True
            elif severity == "high":
                # TIER 2: Require consecutive detection AND high confidence
                if alert_confidence >= telegram_threshold and self._has_consecutive_detection(alert_class):
                    send_telegram = True
            # TIER 3: Never send to Telegram

        return is_speech, alert_class, alert_confidence, severity, send_telegram
