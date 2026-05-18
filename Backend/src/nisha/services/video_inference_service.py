"""Video inference service for running violence detection on video frames."""

from __future__ import annotations

import numpy as np
from datetime import UTC, datetime
from typing import Tuple, Optional

from ai.video_processing.inference import UnifiedThreatDetector, DetectionResult


class VideoInferenceService:
    """Service for running behavior and weapons detection on video frames."""

    def __init__(self, model_path: str | None = None, device: str | None = None):
        """Initialize the video inference service.

        Args:
            model_path: Path to the LSTM model checkpoint. If None, uses default.
            device: Device to run inference on ('cuda' or 'cpu'). If None, auto-selects.
        """
        self.detector = UnifiedThreatDetector(model_path=model_path, device=device)

    def analyze_frame(self, frame: np.ndarray) -> tuple[DetectionResult | None, any, any]:
        """Analyze a single video frame for threats (behavior + weapons).

        Args:
            frame: Video frame as numpy array (BGR format).

        Returns:
            Tuple of (DetectionResult, PoseResult, WeaponResult).
        """
        return self.detector.process_frame(frame)

    def reset(self) -> None:
        """Reset the detector's internal state (buffer and frame count)."""
        self.detector.reset()
