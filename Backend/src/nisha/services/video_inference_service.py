"""Video inference service for running violence detection on video frames."""

from __future__ import annotations

import numpy as np
from datetime import UTC, datetime
from typing import Tuple, Optional

from ai.video_processing.inference import ViolenceDetector, DetectionResult


class VideoInferenceService:
    """Service for running violence detection on video frames using YOLOv8 Pose + LSTM."""

    def __init__(self, model_path: str | None = None, device: str | None = None):
        """Initialize the video inference service.

        Args:
            model_path: Path to the LSTM model checkpoint. If None, uses default.
            device: Device to run inference on ('cuda' or 'cpu'). If None, auto-selects.
        """
        self.detector = ViolenceDetector(model_path=model_path, device=device)

    def analyze_frame(self, frame: np.ndarray) -> Tuple\[Optional\[DetectionResult\], Any\]:
        """Analyze a single video frame for violence detection.

        Args:
            frame: Video frame as numpy array (BGR format).

        Returns:
            Tuple of (DetectionResult or None, YOLO results object).
            DetectionResult is returned when a sequence is complete and classification can be made.
        """
        return self.detector.process_frame(frame)

    def reset(self) -> None:
        """Reset the detector's internal state (buffer and frame count)."""
        self.detector.reset()
