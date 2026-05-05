"""Preprocessing pipeline: Video → Frames → YOLOv8 Pose → Keypoint sequences.

Extracts normalized keypoint sequences from the Real Life Violence Dataset
and saves them as .npy files split into train/val/test sets.
"""

import logging
import sys
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

from config import (
    DATA_DIR,
    DATASET_DIR,
    IMG_SIZE,
    INPUT_FEATURES,
    LABEL_MAP,
    NUM_KEYPOINTS,
    SEQUENCE_LENGTH,
    TEST_RATIO,
    TRAIN_RATIO,
    VAL_RATIO,
    YOLO_MODEL,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def sample_frames(video_path: str, n_frames: int = SEQUENCE_LENGTH) -> list[np.ndarray]:
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return []

    indices = np.linspace(0, total - 1, n_frames, dtype=int)
    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if ret:
            frames.append(frame)
    cap.release()
    return frames


def extract_keypoints(model: YOLO, frame: np.ndarray) -> np.ndarray:
    """Run YOLOv8-pose on a single frame and return the primary person's keypoints."""
    results = model(frame, imgsz=IMG_SIZE, verbose=False)
    result = results[0]

    if result.keypoints is None or len(result.keypoints) == 0:
        return np.zeros(INPUT_FEATURES, dtype=np.float32)

    kps = result.keypoints.data.cpu().numpy()
    if len(kps) == 0:
        return np.zeros(INPUT_FEATURES, dtype=np.float32)

    # Pick the person with the largest bounding box area (most prominent)
    if result.boxes is not None and len(result.boxes) > 0:
        boxes = result.boxes.xyxy.cpu().numpy()
        areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
        best_idx = np.argmax(areas)
    else:
        best_idx = 0

    person_kps = kps[best_idx]  # shape: (17, 3)

    # Normalize keypoints relative to bounding box
    if result.boxes is not None and len(result.boxes) > best_idx:
        box = result.boxes.xyxy.cpu().numpy()[best_idx]
        x_min, y_min, x_max, y_max = box
        w = max(x_max - x_min, 1.0)
        h = max(y_max - y_min, 1.0)
        person_kps[:, 0] = (person_kps[:, 0] - x_min) / w
        person_kps[:, 1] = (person_kps[:, 1] - y_min) / h
        # confidence stays as-is

    return person_kps.flatten().astype(np.float32)


def process_video(model: YOLO, video_path: str) -> np.ndarray | None:
    """Extract a keypoint sequence from a single video."""
    frames = sample_frames(video_path)
    if len(frames) < SEQUENCE_LENGTH:
        return None

    sequence = np.zeros((SEQUENCE_LENGTH, INPUT_FEATURES), dtype=np.float32)
    for i, frame in enumerate(frames[:SEQUENCE_LENGTH]):
        sequence[i] = extract_keypoints(model, frame)

    # Skip if too many empty frames (no person detected)
    nonzero_frames = np.count_nonzero(sequence.sum(axis=1))
    if nonzero_frames < SEQUENCE_LENGTH * 0.3:
        return None

    return sequence


def collect_videos() -> list[tuple[str, int]]:
    """Collect all video paths with their labels."""
    videos = []
    for class_name, label in LABEL_MAP.items():
        class_dir = DATASET_DIR / class_name
        if not class_dir.exists():
            log.warning("Class directory not found: %s", class_dir)
            continue
        for vf in sorted(class_dir.glob("*.mp4")):
            videos.append((str(vf), label))
    log.info("Found %d videos total", len(videos))
    return videos


def split_data(
    sequences: list[np.ndarray], labels: list[int]
) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """Split data into train/val/test sets with stratification."""
    sequences_arr = np.array(sequences)
    labels_arr = np.array(labels)

    np.random.seed(42)
    indices = np.arange(len(labels_arr))
    np.random.shuffle(indices)

    n = len(indices)
    train_end = int(n * TRAIN_RATIO)
    val_end = train_end + int(n * VAL_RATIO)

    return {
        "train": (sequences_arr[indices[:train_end]], labels_arr[indices[:train_end]]),
        "val": (sequences_arr[indices[train_end:val_end]], labels_arr[indices[train_end:val_end]]),
        "test": (sequences_arr[indices[val_end:]], labels_arr[indices[val_end:]]),
    }


def main():
    log.info("Loading YOLOv8-pose model...")
    model = YOLO(YOLO_MODEL)

    videos = collect_videos()
    if not videos:
        log.error("No videos found in %s", DATASET_DIR)
        sys.exit(1)

    sequences = []
    labels = []
    failed = 0

    for i, (path, label) in enumerate(videos):
        seq = process_video(model, path)
        if seq is not None:
            sequences.append(seq)
            labels.append(label)
        else:
            failed += 1

        if (i + 1) % 50 == 0:
            log.info("Processed %d/%d videos (%d failed)", i + 1, len(videos), failed)

    log.info(
        "Done: %d valid sequences, %d failed out of %d total",
        len(sequences), failed, len(videos),
    )

    # Class distribution
    labels_arr = np.array(labels)
    for lbl, name in {0: "NonViolence", 1: "Violence"}.items():
        log.info("  %s: %d samples", name, (labels_arr == lbl).sum())

    splits = split_data(sequences, labels)
    for split_name, (X, y) in splits.items():
        out_dir = DATA_DIR / split_name
        out_dir.mkdir(parents=True, exist_ok=True)
        np.save(out_dir / "sequences.npy", X)
        np.save(out_dir / "labels.npy", y)
        log.info("Saved %s: %d samples → %s", split_name, len(y), out_dir)

    log.info("Preprocessing complete.")


if __name__ == "__main__":
    main()
