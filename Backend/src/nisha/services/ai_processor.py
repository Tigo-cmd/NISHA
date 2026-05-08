"""AI Processor service bridging the backend with ML models."""

import sys
import logging
import asyncio
import numpy as np
import cv2
from pathlib import Path
from typing import Optional, Tuple
from concurrent.futures import ThreadPoolExecutor

# Setup path to include the ai directory
project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
ai_dir = project_root / "ai" / "video_processing"

if str(ai_dir) not in sys.path:
    sys.path.append(str(project_root))
    sys.path.append(str(ai_dir))

try:
    from ai.video_processing.inference import ViolenceDetector
    from ai.video_processing.config import YOLO_MODEL, CONFIDENCE_THRESHOLD
    from ai.audio_processor.processor import AudioClassifier
    AI_AVAILABLE = True
except ImportError as e:
    logging.error(f"Failed to import AI models: {e}")
    # Try adding parent to path if relative import fails in some environments
    if str(project_root) not in sys.path:
        sys.path.append(str(project_root))
        try:
            from ai.audio_processor.processor import AudioClassifier
            from ai.video_processing.inference import ViolenceDetector
            AI_AVAILABLE = True
        except:
            AI_AVAILABLE = False
    else:
        AI_AVAILABLE = False

logger = logging.getLogger(__name__)

class AIProcessor:
    """Service to handle AI inference for video and audio streams."""
    
    def __init__(self, use_nano: bool = True):
        self.detector: Optional[ViolenceDetector] = None
        self.audio_classifier: Optional[AudioClassifier] = None
        self.use_nano = use_nano
        self.executor = ThreadPoolExecutor(max_workers=4)
        self._lock = asyncio.Lock()

    def load_models(self):
        """Load ML models into memory."""
        if not AI_AVAILABLE:
            logger.error("AI modules not found, cannot load models")
            return

        try:
            # Use same paths as detector.py
            model_path = ai_dir / "models" / "best_behavior_lstm.pt"
            yolo_name = "yolov8n-pose.pt" if self.use_nano else YOLO_MODEL
            yolo_weight = ai_dir / yolo_name
            
            logger.info(f"Loading AI models: YOLO={yolo_name}, LSTM={model_path.name}")
            self.detector = ViolenceDetector(
                model_path=model_path, 
                yolo_model=str(yolo_weight)
            )
            
            # Load Audio Classifier
            self.audio_classifier = AudioClassifier()
            
            logger.info("AI models (Video & Audio) loaded successfully")
        except Exception as e:
            logger.error(f"Error loading AI models: {e}")

    async def process_video_frame(self, frame_data: bytes, metadata: dict = None) -> Tuple[Optional[str], float]:
        """Process a raw video frame (bytes) and return (behavior, confidence)."""
        if not self.detector:
            return None, 0.0

        # Run in thread pool as CV2 and Torch operations are blocking
        return await asyncio.get_event_loop().run_in_executor(
            self.executor, 
            self._process_frame_sync, 
            frame_data,
            metadata
        )

    def _process_frame_sync(self, data: bytes, metadata: dict = None) -> Tuple[Optional[str], float]:
        """Synchronous processing for either a static frame or a video clip."""
        try:
            frame = None
            
            # Handle raw RGB pixel data from mobile agents
            if metadata and metadata.get('format') == 'raw_rgb':
                w = metadata.get('width', 160)
                h = metadata.get('height', 120)
                expected_len = w * h * 3
                if len(data) >= expected_len:
                    frame = np.frombuffer(data[:expected_len], np.uint8).reshape((h, w, 3))
                    # RGB -> BGR for OpenCV
                    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                else:
                    logger.warning(f"Raw RGB data size mismatch: got {len(data)}, expected {expected_len}")
                    return None, 0.0
            else:
                # Check for common video magic numbers (e.g., MP4/MOV) or just try decoding as image
                nparr = np.frombuffer(data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
                # If frame is None, it might be a video clip (mp4/mov)
                if frame is None:
                    import tempfile
                    import os
                    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                        tmp.write(data)
                        tmp_path = tmp.name
                    
                    try:
                        cap = cv2.VideoCapture(tmp_path)
                        # Grab a frame from the middle of the clip for behavior analysis
                        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                        cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames // 2)
                        ret, frame = cap.read()
                        cap.release()
                    finally:
                        if os.path.exists(tmp_path):
                            os.remove(tmp_path)

            if frame is None:
                return None, 0.0
                
            # Process using ViolenceDetector
            detection, _ = self.detector.process_frame(frame, imgsz=320)
            
            if detection:
                return detection.behavior, detection.confidence
                
            return "NonViolence", 1.0
        except Exception as e:
            logger.error(f"Error processing visual data: {e}")
            return None, 0.0

    async def process_audio_frame(self, audio_data: bytes, metadata: dict = None) -> tuple[str, float, Optional[str]]:
        """Process audio bytes and return (classification, confidence, transcription)."""
        if not self.audio_classifier:
            return "AmbientNoise", 1.0, None

        # TODO: If metadata.get('format') == 'aac', decode to PCM first
        # For now, we assume the classifier can handle it or we log the format
        if metadata and metadata.get('format') == 'aac':
            logger.debug("Received AAC audio frame, passing to classifier (may require decoding)")

        return await asyncio.get_event_loop().run_in_executor(
            self.executor,
            self.audio_classifier.process_audio,
            audio_data
        )
