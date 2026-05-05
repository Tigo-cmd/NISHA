import sys
import os
import argparse
import cv2
import logging
import torch
from pathlib import Path

# Add the project root and video_processing directory to sys.path
project_root = Path(__file__).resolve().parent.parent
video_processing_dir = project_root / "ai" / "video_processing"
sys.path.append(str(project_root))
sys.path.append(str(video_processing_dir))

from ai.video_processing.inference import ViolenceDetector
from ai.video_processing.config import YOLO_MODEL, CONFIDENCE_THRESHOLD

try:
    import yt_dlp
except ImportError:
    yt_dlp = None

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def get_youtube_stream(url):
    """Extract the direct stream URL from a YouTube link."""
    if not yt_dlp:
        logger.error("yt-dlp is not installed. Run: pip install yt-dlp")
        return url
        
    ydl_opts = {
        'format': 'best[ext=mp4]',
        'quiet': True,
        'no_warnings': True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info['url']
    except Exception as e:
        logger.error(f"Error extracting YouTube stream: {e}")
        return url

def run_detection(source, show=True, save_path=None, fast_mode=False, nano_model=False):
    """
    Run violence detection on a specified source (camera, file, or stream link).
    """
    # Check for YouTube link
    if isinstance(source, str) and ("youtube.com" in source or "youtu.be" in source):
        logger.info(f"Extracting stream from YouTube: {source}")
        source = get_youtube_stream(source)

    # Initialize detector
    ai_dir = project_root / "ai" / "video_processing"
    model_path = ai_dir / "models" / "best_behavior_lstm.pt"
    
    # Allow switching to the smaller Nano model for speed
    yolo_name = "yolov8n-pose.pt" if nano_model else YOLO_MODEL
    yolo_weight = ai_dir / yolo_name
    
    # Download nano model if it's missing
    if nano_model and not yolo_weight.exists():
        logger.info("Downloading Nano Pose model for better performance...")
    
    logger.info(f"Loading models (Fast Mode: {fast_mode})...")
    detector = ViolenceDetector(model_path=model_path, yolo_model=str(yolo_weight))

    # Optimization: Lower image size for much higher FPS
    imgsz = 320 if fast_mode else 640

    # Open video source
    if isinstance(source, str) and source.isdigit():
        source = int(source)
    
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        logger.error(f"Could not open source: {source}")
        return

    # Video writer... (omitted for brevity in this view, but kept in file)
    writer = None
    if save_path:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        writer = cv2.VideoWriter(save_path, fourcc, fps, (width, height))

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            # Process frame with optimized size
            detection, yolo_result = detector.process_frame(frame, imgsz=imgsz)
            
            annotated_frame = yolo_result.plot()
# ... (rest of the visualization logic remains)
            
            # Add our custom Violence/Non-Violence label
            if detection and detection.confidence >= CONFIDENCE_THRESHOLD:
                is_violence = detection.behavior == "Violence"
                color = (0, 0, 255) if is_violence else (0, 255, 0)
                label = f"SENTINEL ALERT: {detection.behavior} ({detection.confidence:.1%})"
                
                # Draw high-visibility banner
                cv2.rectangle(annotated_frame, (0, 0), (annotated_frame.shape[1], 60), color, -1)
                cv2.putText(annotated_frame, label, (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 3)
                
                if is_violence:
                    # Flash red border
                    cv2.rectangle(annotated_frame, (0, 0), (annotated_frame.shape[1], annotated_frame.shape[0]), (0, 0, 255), 15)
                    logger.warning(f"VIOLENCE DETECTED! Confidence: {detection.confidence:.2%}")

            if writer:
                writer.write(annotated_frame)

            if show:
                try:
                    cv2.imshow("NISHA SENTINEL - Live Monitor", annotated_frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                except cv2.error as e:
                    logger.warning(f"Display window failed: {e}")
                    logger.info("Falling back to headless mode.")
                    show = False

    except KeyboardInterrupt:
        logger.info("Detection stopped by user.")
    finally:
        cap.release()
        if writer:
            writer.release()
        if show:
            try:
                cv2.destroyAllWindows()
            except:
                pass
        logger.info("Cleanup complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NISHA Video Processor - Detection Tool")
    parser.add_argument("--source", type=str, default="0", 
                        help="Video source: 0 for webcam, path/to/video.mp4 for file, or rtsp://... for stream link")
    parser.add_argument("--no-show", action="store_false", dest="show", 
                        help="Do not display the video window")
    parser.add_argument("--save", type=str, default=None, 
                        help="Path to save the processed video")
    parser.add_argument("--fast", action="store_true",
                        help="Fast mode: reduces image size (320px) for much higher FPS")
    parser.add_argument("--nano", action="store_true",
                        help="Nano mode: uses the smallest YOLO model for maximum performance")
    
    args = parser.parse_args()
    
    run_detection(args.source, show=args.show, save_path=args.save, fast_mode=args.fast, nano_model=args.nano)
