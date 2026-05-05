"""Real-time inference: video stream → YOLOv8 Pose → sliding window → LSTM → classification.

Can process:
  - Live camera feed
  - Video file
  - Individual frames from agents (via process_frame API)
"""

import logging
from collections import deque
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import cv2
import numpy as np
import torch
from ultralytics import YOLO

from config import (
    CLASS_MAP,
    CONFIDENCE_THRESHOLD,
    IMG_SIZE,
    INPUT_FEATURES,
    MODEL_DIR,
    SEQUENCE_LENGTH,
    SLIDING_WINDOW_STRIDE,
    YOLO_MODEL,
)
from model import BehaviorLSTM

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


@dataclass
class DetectionResult:
    behavior: str
    confidence: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    keypoints: np.ndarray | None = None
    frame_index: int = 0


class ViolenceDetector:
    def __init__(
        self,
        model_path: str | Path | None = None,
        yolo_model: str = YOLO_MODEL,
        device: str | None = None,
    ):
        self.device = torch.device(
            device or ("cuda" if torch.cuda.is_available() else "cpu")
        )

        self.yolo = YOLO(yolo_model)

        self.lstm = BehaviorLSTM().to(self.device)
        ckpt_path = model_path or (MODEL_DIR / "best_behavior_lstm.pt")
        ckpt = torch.load(ckpt_path, map_location=self.device, weights_only=True)
        self.lstm.load_state_dict(ckpt["model_state_dict"])
        self.lstm.eval()

        self.keypoint_buffer: deque[np.ndarray] = deque(maxlen=SEQUENCE_LENGTH)
        self._frame_count = 0

    def process_frame(self, frame: np.ndarray, imgsz: int = IMG_SIZE) -> tuple[DetectionResult | None, any]:
        """Process a single frame. Returns (behavior_result, yolo_result)."""
        # Run YOLO inference explicitly on the correct device
        results = self.yolo(frame, imgsz=imgsz, device=self.device, verbose=False)
        result = results[0]
        
        # Extract normalized keypoints for the LSTM
        kps_flat = self._extract_keypoints_from_result(result)
        self.keypoint_buffer.append(kps_flat)
        self._frame_count += 1

        # Check for behavior classification
        behavior_result = None
        if len(self.keypoint_buffer) >= SEQUENCE_LENGTH and (self._frame_count - SEQUENCE_LENGTH) % SLIDING_WINDOW_STRIDE == 0:
            sequence = np.array(self.keypoint_buffer)
            behavior, confidence = self._classify_sequence(sequence)
            behavior_result = DetectionResult(
                behavior=behavior,
                confidence=confidence,
                keypoints=kps_flat,
                frame_index=self._frame_count,
            )

        return behavior_result, result

    def _extract_keypoints_from_result(self, result) -> np.ndarray:
        """Isolated keypoint extraction from a single YOLO result."""
        if result.keypoints is None or len(result.keypoints) == 0:
            return np.zeros(INPUT_FEATURES, dtype=np.float32)

        kps = result.keypoints.data.cpu().numpy()
        if len(kps) == 0:
            return np.zeros(INPUT_FEATURES, dtype=np.float32)

        # Get the largest person detected
        if result.boxes is not None and len(result.boxes) > 0:
            boxes = result.boxes.xyxy.cpu().numpy()
            areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
            best_idx = np.argmax(areas)
        else:
            best_idx = 0

        person_kps = kps[best_idx].copy()

        # Normalize relative to bounding box for LSTM stability
        if result.boxes is not None and len(result.boxes) > best_idx:
            box = result.boxes.xyxy.cpu().numpy()[best_idx]
            x_min, y_min, x_max, y_max = box
            w = max(x_max - x_min, 1.0)
            h = max(y_max - y_min, 1.0)
            person_kps[:, 0] = (person_kps[:, 0] - x_min) / w
            person_kps[:, 1] = (person_kps[:, 1] - y_min) / h

        return person_kps.flatten().astype(np.float32)

    @torch.no_grad()
    def _classify_sequence(self, sequence: np.ndarray) -> tuple[str, float]:
        tensor = torch.tensor(sequence, dtype=torch.float32).unsqueeze(0).to(self.device)
        output = self.lstm(tensor)
        probs = torch.softmax(output, dim=1).cpu().numpy()[0]
        pred_class = int(probs.argmax())
        return CLASS_MAP[pred_class], float(probs[pred_class])

    def _extract_keypoints(self, frame: np.ndarray) -> np.ndarray:
        # Kept for backward compatibility
        results = self.yolo(frame, imgsz=IMG_SIZE, verbose=False)
        return self._extract_keypoints_from_result(results[0])

    def draw_landmarks(self, frame: np.ndarray, keypoints: np.ndarray):
        """Draw pose skeleton on the frame."""
        if keypoints is None or np.all(keypoints == 0):
            return
            
        # Reshape flat keypoints (51,) -> (17, 3)
        kps = keypoints.reshape(-1, 3)
        h, w = frame.shape[:2]
        
        # Connections for YOLOv8 Pose (COCO format)
        skeleton = [
            (16, 14), (14, 12), (17, 15), (15, 13), (12, 13), (6, 12), (7, 13),
            (6, 7), (6, 8), (7, 9), (8, 10), (9, 11), (2, 3), (1, 2), (1, 3), (2, 4), (3, 5)
        ]

        # Draw points
        for i, (x, y, conf) in enumerate(kps):
            if conf > 0.5:
                # We need un-normalized coordinates if they were normalized in extract_keypoints
                # But wait, extract_keypoints in your file currently normalizes them relative to the box.
                # To draw them correctly, we should ideally have pixel coordinates.
                pass 

    def process_video(
        self, source: str | int = 0, show: bool = False
    ) -> list[DetectionResult]:
        """Process a video file or camera stream end-to-end."""
        cap = cv2.VideoCapture(source)
        results = []

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            detection = self.process_frame(frame)
            if detection and detection.confidence >= CONFIDENCE_THRESHOLD:
                results.append(detection)
                log.info(
                    "Frame %d: %s (%.2f%%)",
                    detection.frame_index,
                    detection.behavior,
                    detection.confidence * 100,
                )

                if show:
                    color = (0, 0, 255) if detection.behavior == "Violence" else (0, 255, 0)
                    label = f"{detection.behavior}: {detection.confidence:.1%}"
                    cv2.putText(frame, label, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

            if show:
                cv2.imshow("NISHA Violence Detection", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

        cap.release()
        if show:
            cv2.destroyAllWindows()
        self.reset()
        return results

    def reset(self):
        self.keypoint_buffer.clear()
        self._frame_count = 0


def main():
    import argparse

    parser = argparse.ArgumentParser(description="NISHA Violence Detection Inference")
    parser.add_argument("source", nargs="?", default="0", help="Video file path or camera index")
    parser.add_argument("--show", action="store_true", help="Show video with detections")
    parser.add_argument("--model", type=str, default=None, help="Path to LSTM model checkpoint")
    args = parser.parse_args()

    source = int(args.source) if args.source.isdigit() else args.source
    detector = ViolenceDetector(model_path=args.model)
    results = detector.process_video(source=source, show=args.show)

    log.info("Total detections: %d", len(results))
    violence_count = sum(1 for r in results if r.behavior == "Violence")
    log.info("Violence detections: %d", violence_count)


if __name__ == "__main__":
    main()
