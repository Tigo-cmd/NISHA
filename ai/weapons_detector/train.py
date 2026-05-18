from ultralytics import YOLO
import os

# Load the base model
model = YOLO('yolov8n.pt')

# Path to the data.yaml file
data_path = os.path.join(os.getcwd(), 'dataset/data.yaml')

# Train the model
# NOTE: You must have labels in dataset/train/labels/ and dataset/val/labels/
# before running this script!
print("Starting training... Make sure you have labels ready!")

results = model.train(
    data=data_path, 
    epochs=100, 
    imgsz=640, 
    batch=16,
    patience=10, 
    name='weapons_detector'
)

print(f"Training finished! Your new model is saved in: runs/detect/orange_fine_tuning/weights/best.pt")