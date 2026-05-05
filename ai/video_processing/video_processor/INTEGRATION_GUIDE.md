# NISHA Sentinel - Video Processor Integration Guide

This document outlines the architectural changes and features implemented in the `video_processor` module to enable real-time violence detection across various video sources.

## 🚀 Key Features

- **Multi-Source Support**: Seamlessly switch between local webcams, video files, and YouTube links.
- **YouTube Extraction**: Integrated `yt-dlp` to automatically resolve YouTube URLs into high-quality stream links.
- **Skeletal Visualization**: Real-time rendering of 17 pose keypoints (skeleton) and detection bounding boxes.
- **Performance Optimization**: 
  - `--fast` mode (320px processing) for 3x higher FPS.
  - `--nano` mode for using ultra-lightweight models on low-power hardware.
  - Explicit CUDA/GPU acceleration support.
- **Visual Alert System**: High-visibility "Sentinel Alert" banner and flashing red borders for critical events.

---

## 🛠 Architectural Changes

### 1. New Directory: `video_processor/`
Dedicated folder for application-level logic, separating it from the `ai/` training research code.
- **`detector.py`**: The main entry point for the monitoring system.

### 2. Upgraded Inference Engine (`ai/video_processing/inference.py`)
- **`process_frame` redesign**: Now returns a tuple of `(DetectionResult, YoloResult)`. This allows the UI to draw landmarks even when the LSTM hasn't finished a sequence classification.
- **Hardware Awareness**: Rewritten to explicitly pass the `device` (CUDA/CPU) to each YOLO inference call, preventing a bug where YOLO would default to CPU on many systems.

### 3. Package Structure
- Added `__init__.py` files to `ai/` and `ai/video_processing/` to treat the AI logic as a proper Python package, facilitating clean imports in the main system.

---

## 📦 Dependencies

The following requirements were added or updated:
- `yt-dlp`: For YouTube stream extraction.
- `opencv-python`: **Requirement Note**: Must use the GUI-enabled version (not `headless`) for the monitoring window to function.

---

## 🔌 Integration Instructions

To use the detection engine in your main backend/frontend integration:

```python
from ai.video_processing.inference import ViolenceDetector

# 1. Initialize
detector = ViolenceDetector(model_path="path/to/lstm.pt", yolo_model="path/to/yolov8n-pose.pt")

# 2. Loop
while True:
    ret, frame = cap.read()
    # classification: The Violence/Safe result
    # yolo_info: Raw pose data and plotting methods
    classification, yolo_info = detector.process_frame(frame, imgsz=320)
    
    if classification and classification.behavior == "Violence":
        trigger_alarm(classification.confidence)
```

## ⚡ Performance Tips for Main System
- Always run in **Fast Mode** (`imgsz=320`) for real-time web-stream integrations.
- Use **Nano Models** (`yolov8n-pose.pt`) if deploying on devices without powerful dedicated GPUs.
