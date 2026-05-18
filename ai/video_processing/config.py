"""Configuration constants for NISHA video processing pipeline."""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "violence dataset" / "real life violence situations" / "Real Life Violence Dataset"
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"
LOG_DIR = BASE_DIR / "logs"

# Preprocessing
SEQUENCE_LENGTH = 30
YOLO_MODEL = "yolov8s-pose.pt"
NUM_KEYPOINTS = 17
KEYPOINT_FEATURES = 3  # x, y, confidence
INPUT_FEATURES = NUM_KEYPOINTS * KEYPOINT_FEATURES  # 51
IMG_SIZE = 640

# Dataset split ratios
TRAIN_RATIO = 0.8
VAL_RATIO = 0.1
TEST_RATIO = 0.1

# Training
BATCH_SIZE = 32
LEARNING_RATE = 1e-3
NUM_EPOCHS = 50
PATIENCE = 10  # early stopping
HIDDEN_SIZE = 128
NUM_LAYERS = 2
DROPOUT = 0.3
BIDIRECTIONAL = True

# Class mapping
CLASS_MAP = {0: "NonViolence", 1: "Violence"}
LABEL_MAP = {"NonViolence": 0, "Violence": 1}

# Inference
CONFIDENCE_THRESHOLD = 0.6
SLIDING_WINDOW_STRIDE = 10

# Weapons Detection
WEAPONS_MODEL = "/home/nisha/Desktop/NISHA/ai/weapons_detector/runs/detect/weapons_detector-2/weights/best.pt"
WEAPON_CONFIDENCE_THRESHOLD = 0.5
THREAT_CLASSES = [
    "Guns", "Heavy Gun", "Knife", "Knife_Deploy", "Knife_Weapon", 
    "Long guns", "Pistol", "Rifle", "Shotgun", "handgun", 
    "heavyweapon", "larga", "pistol", "pistols", "rifle", 
    "shotgun", "violence", "weapon"
]
