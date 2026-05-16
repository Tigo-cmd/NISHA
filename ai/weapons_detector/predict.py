from ultralytics import YOLO
import cv2
import sys
import os

def run_prediction(model_path, source):
    # Load the trained model
    if not os.path.exists(model_path):
        print(f"Error: Model file {model_path} not found. Have you finished training?")
        return

    model = YOLO(model_path)
    
    # Run inference
    # source can be 0 for webcam, a video file path, or an image path
    results = model.predict(source, show=True, conf=0.5)
    
    print("Prediction complete.")

if __name__ == "__main__":
    # Path to your best model weights after training
    # Default location is usually runs/detect/weapons_detector/weights/best.pt
    best_model = "runs/detect/weapons_detector/weights/best.pt"
    
    # Use webcam by default, or provide a path via argument
    source = sys.argv[1] if len(sys.argv) > 1 else 0
    
    run_prediction(best_model, source)
