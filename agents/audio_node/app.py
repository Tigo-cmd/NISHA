import cv2
from ultralytics import YOLO
from flask import Flask, render_template, Response

app = Flask(__name__)


model = YOLO('runs/detect/orange_fine_tuning/weights/best.pt')


def detect_and_count_fruits(frame):
    results = model(frame, imgsz=320, verbose=False, conf=0.25) # increased conf for better result
    detections = results[0]
    counts = {"healthy": 0, "Rotten": 0, "fruit": 0}

    for detection in detections.boxes.data.tolist():
        xmin, ymin, xmax, ymax, confidence, class_id = detection[:6]
        class_name = model.names[int(class_id)]
        
        if class_name in counts:
            counts[class_name] += 1
            # Color: Green for healthy, Red for Rotten, Yellow for fruit
            if class_name == "healthy":
                color = (0, 255, 0)
            elif class_name == "Rotten":
                color = (0, 0, 255)
            else:
                color = (0, 255, 255) # Yellow

            cv2.rectangle(frame, (int(xmin), int(ymin)), (int(xmax), int(ymax)), color, 2)
            label = f"{class_name} {confidence:.2f}"
            cv2.putText(frame, label, (int(xmin), int(ymin) - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    
    return frame, counts


def generate_frames():
    video_path = 'vid3.mp4'  
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return

    # Resize dimensions for web stream
    display_width = 640
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    aspect_ratio = frame_height / frame_width
    display_height = int(display_width * aspect_ratio)

    # Output video writer setup
    output_path = 'output_detection.mp4'
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0.0 or fps != fps: # Check for NaN or 0
        fps = 30.0
    out = cv2.VideoWriter(output_path, fourcc, fps, (display_width, display_height))
    video_saved = False # Boolean flag to prevent writing to the file repeatedly

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            # Re-run from the start for continuous streaming
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            
            # Close writer once the first complete loop finishes
            if not video_saved and out is not None:
                out.release()
                print(f"✅ Video detection saved to {output_path}")
                video_saved = True
            
            continue

        # Resize for display and processing
        frame = cv2.resize(frame, (display_width, display_height))
        processed_frame, counts = detect_and_count_fruits(frame)

        # Overlays for the HUD
        cv2.putText(processed_frame, f'Healthy: {counts["healthy"]}', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.putText(processed_frame, f'Rotten: {counts["Rotten"]}', (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        cv2.putText(processed_frame, f'Other Fruit: {counts["fruit"]}', (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

        if not video_saved and out is not None:
            out.write(processed_frame)

        # Encode the frame in JPEG format
        (flag, encodedImage) = cv2.imencode(".jpg", processed_frame)
        if not flag:
            continue

        # yield the output frame in the byte format
        yield(b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + bytearray(encodedImage) + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/')
def index():
    return """
    <html>
      <head>
        <title>Orange Detection Stream</title>
        <style>
          body { font-family: sans-serif; background-color: #1a1a1a; color: white; text-align: center; }
          h1 { color: #f39c12; }
          img { border: 5px solid #2c3e50; border-radius: 10px; max-width: 90%; }
        </style>
      </head>
      <body>
        <h1>🍊 Live Orange Defect Detection Feed</h1>
        <p>Healthy: <span style="color:#00ff00;">Green</span> | Rotten: <span style="color:#ff0000;">Red</span></p>
        <img src="/video_feed">
      </body>
    </html>
    """

if __name__ == '__main__':
    print("🚀 Stream starting at: http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, threaded=True)
