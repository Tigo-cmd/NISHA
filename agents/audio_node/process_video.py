import cv2
from ultralytics import YOLO

model = YOLO('runs/detect/orange_fine_tuning/weights/best.pt')

def detect_and_count_fruits(frame):
    results = model(frame, imgsz=320, verbose=False, conf=0.25)
    detections = results[0]
    counts = {"healthy": 0, "Rotten": 0, "fruit": 0}

    for detection in detections.boxes.data.tolist():
        xmin, ymin, xmax, ymax, confidence, class_id = detection[:6]
        class_name = model.names[int(class_id)]
        
        if class_name in counts:
            counts[class_name] += 1
            if class_name == "healthy":
                color = (0, 255, 0)
            elif class_name == "Rotten":
                color = (0, 0, 255)
            else:
                color = (0, 255, 255)

            cv2.rectangle(frame, (int(xmin), int(ymin)), (int(xmax), int(ymax)), color, 2)
            label = f"{class_name} {confidence:.2f}"
            cv2.putText(frame, label, (int(xmin), int(ymin) - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    
    return frame, counts

def main():
    video_path = 'vid2.mp4'
    output_path = 'output_detection2.mp4'

    print(f"Opening {video_path}...")
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return

    # Resize dimensions
    display_width = 640
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    aspect_ratio = frame_height / frame_width
    display_height = int(display_width * aspect_ratio)

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps != fps:
        fps = 30.0

    print(f"Saving output to {output_path} (FPS: {fps})")
    out = cv2.VideoWriter(output_path, fourcc, fps, (display_width, display_height))

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        if frame_count % 10 == 0:
            print(f"Processing frame {frame_count}/{total_frames}...")

        frame = cv2.resize(frame, (display_width, display_height))
        processed_frame, counts = detect_and_count_fruits(frame)

        cv2.putText(processed_frame, f'Healthy: {counts["healthy"]}', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.putText(processed_frame, f'Rotten: {counts["Rotten"]}', (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        cv2.putText(processed_frame, f'Other Fruit: {counts["fruit"]}', (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

        out.write(processed_frame)

    cap.release()
    out.release()
    print(f"✅ Video successfully processed and saved to {output_path}")

if __name__ == '__main__':
    main()
