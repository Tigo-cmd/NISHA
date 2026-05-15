"""
YAMNet Audio Classifier — Offline Local Model
------------------------------------------------
Loads the YAMNet SavedModel from the local `yamnet_model/` directory
(extracted from yamnet-tensorflow2-yamnet-v1.tar.gz).
No network access required — model weights and class map are fully local.
"""

import numpy as np
import csv
import os
import logging

logger = logging.getLogger(__name__)

# Resolve the path relative to this file so it works regardless of cwd
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
YAMNET_MODEL_DIR = os.path.join(_THIS_DIR, "yamnet_model")
YAMNET_CLASS_MAP = os.path.join(YAMNET_MODEL_DIR, "assets", "yamnet_class_map.csv")


class YAMNetClassifier:
    def __init__(self):
        self.model = None
        self.class_names = []
        self._is_initialized = False

        # Classes that trigger immediate frontend UI alerts
        self.DANGER_CLASSES = {
            "Gunshot, gunfire",
            "Machine gun",
            "Fusillade",
            "Artillery fire",
            "Cap gun",
            "Siren",
            "Civil defense siren",
            "Emergency vehicle",
            "Police car (siren)",
            "Ambulance (siren)",
            "Fire engine, fire truck (siren)",
            "Screaming",
            "Shatter",            # glass shattering
            "Explosion",
            "Fire alarm",
            "Smoke detector, smoke alarm",
            "Alarm",
        }

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

    def initialize(self):
        """Load the YAMNet SavedModel and class-name list from disk."""
        if self._is_initialized:
            return

        # ── Load model from local SavedModel directory ──────────────
        logger.info("Loading YAMNet from local SavedModel: %s", YAMNET_MODEL_DIR)
        try:
            import tensorflow as tf
            self.model = tf.saved_model.load(YAMNET_MODEL_DIR)
            logger.info("YAMNet loaded successfully (offline).")
        except Exception as e:
            logger.error("Failed to load YAMNet from %s: %s", YAMNET_MODEL_DIR, e)
            self.model = None

        # ── Load class names from bundled CSV ───────────────────────
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

    def classify_frame(
        self, waveform: np.ndarray, top_k: int = 5
    ) -> tuple[bool, str | None, float]:
        """
        Classifies a 16 kHz mono audio frame.

        Args:
            waveform: 1-D numpy array of float32 samples at 16 kHz.
            top_k:    Number of top predictions to inspect.

        Returns:
            (is_speech, alert_class, alert_confidence)
            - is_speech:        True if a speech-related class is in the top-K.
            - alert_class:      Name of the highest-confidence danger class, or None.
            - alert_confidence:  Confidence score of that danger class.
        """
        import tensorflow as tf

        self.initialize()

        if self.model is None or len(self.class_names) == 0:
            # Fallback: assume speech so Whisper still gets data
            return True, None, 0.0

        # ── Normalise input ─────────────────────────────────────────
        if waveform.dtype != np.float32:
            waveform = waveform.astype(np.float32)

        # int16-range values → [-1.0, 1.0]
        if np.max(np.abs(waveform)) > 1.0:
            waveform = waveform / 32768.0

        # ── Run inference ───────────────────────────────────────────
        waveform_tensor = tf.constant(waveform, dtype=tf.float32)
        scores, embeddings, spectrogram = self.model(waveform_tensor)

        # Average scores across all time-frames → single prediction vector
        mean_scores = tf.reduce_mean(scores, axis=0).numpy()

        top_indices = np.argsort(mean_scores)[::-1][:top_k]

        is_speech = False
        alert_class = None
        alert_confidence = 0.0

        for idx in top_indices:
            class_name = self.class_names[idx]
            score = float(mean_scores[idx])

            if class_name in self.SPEECH_CLASSES and score > 0.05:
                is_speech = True

            if class_name in self.DANGER_CLASSES and score > 0.15:
                if alert_class is None:          # keep the highest-ranked match
                    alert_class = class_name
                    alert_confidence = score

        return is_speech, alert_class, alert_confidence
