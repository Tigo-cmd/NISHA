import cv2

cap = cv2.VideoCapture("vid2.mp4")
count = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    if count % 1 == 0:  # take every 1st frame
        cv2.imwrite(f"dataset/train/images/frame_{count}.jpg", frame)
    
    count += 1

cap.release()