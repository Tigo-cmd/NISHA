# Nisha_eyes.py — Integrated backend (audio + video)
# - Threading mode for socketio (no gevent/eventlet)
# - /api/frame synchronous inference (fast response for frontend)
# - /ws video_frame Socket.IO handler (background full processing)
# - Uses video_processor.process_frame (PyTorch 3D CNN)
# - Audio transcription + Telegram alerts retained

from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO
from flask_cors import CORS
import cv2
import os
import uuid
import subprocess
import base64
import numpy as np
import torch
from datetime import datetime
from dotenv import load_dotenv
from groq import Groq
from moviepy import AudioFileClip
from video_processor import process_frame  # async processing function
import video_processor as vp  # access model, device, helpers, queues
import asyncio
import time
import telegram
import wave
import io
from threading import Thread
from source import TigoGroq



main = TigoGroq()


# ----------------------
# Config / tokens
# ----------------------
BOT_TOKEN = os.getenv("BOT_TOKEN", "8125308313:AAEZRE9vc8TAm5dJ6nMJIuNNnZ1F17K49-g")
CHAT_ID = os.getenv("CHAT_ID", "@nisha_security")

bot = telegram.Bot(token=BOT_TOKEN)

# keywords for audio alerting
keywords: list[str] = [
    'shoot', 'murder', 'weapon', 'assassinate', 'kill', 'firearm', 'gun',
    'pistol', 'rifle', 'shotgun', 'ammunition', 'help', 'assist'
]

VIOLENCE_KEYWORDS = {
    "kill", "shoot", "gun", "weapon", "knife", "stab", "blood",
    "kidnap", "hostage", "murder", "assassinate", "fire", "bomb",
    "attack", "help me", "I'm dying", "please help", "violence",
    "fighting", "gunshot", "beat him", "hurt him", "destroy", "danger"
}
# Load environment
load_dotenv()
client = Groq()

# Create app
app = Flask(__name__, static_folder='../public', template_folder='templates')
CORS(app, resources={r"/api/*": {"origins": "*"}})
app.config['CORS_HEADERS'] = 'Content-Type'

# Use threading mode to avoid gevent monkeypatch + PyTorch problems
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Storage directories
RAW_UPLOAD_DIR = os.path.join(app.root_path, 'uploads', 'raw')
CONVERTED_DIR = os.path.join(app.root_path, 'uploads', 'converted')
os.makedirs(RAW_UPLOAD_DIR, exist_ok=True)
os.makedirs(CONVERTED_DIR, exist_ok=True)

DIRECT_EXTS = {'.mp3', '.wav', '.ogg', '.flac', '.webm'}


def detect_violent_words(text: str) -> bool:
    text_low = text.lower()
    for word in VIOLENCE_KEYWORDS:
        if word in text_low:
            return True
    return False


def convert_webm_to_wav(webm_bytes: bytes) -> bytes:
    """
    Convert WebM audio bytes to WAV format using ffmpeg.
    Returns WAV bytes that Groq's Whisper can process.
    """
    try:
        # Write WebM to temp file
        temp_webm = f"/tmp/temp_{uuid.uuid4().hex}.webm"
        temp_wav = f"/tmp/temp_{uuid.uuid4().hex}.wav"
        
        with open(temp_webm, 'wb') as f:
            f.write(webm_bytes)
        
        # Convert WebM to WAV using ffmpeg
        cmd = [
            'ffmpeg',
            '-i', temp_webm,
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            temp_wav,
            '-y'  # overwrite without asking
        ]
        
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        
        if result.returncode != 0:
            print(f"[convert] ffmpeg error: {result.stderr.decode()}")
            return None
        
        # Read converted WAV
        with open(temp_wav, 'rb') as f:
            wav_bytes = f.read()
        
        # Cleanup
        try:
            os.remove(temp_webm)
            os.remove(temp_wav)
        except:
            pass
        
        return wav_bytes
        
    except Exception as e:
        print(f"[convert] Error converting WebM to WAV: {e}")
        return None


def send_telegram_sync(chat_id: str, text: str = None, audio: bytes = None, caption: str = None):
    """
    Send Telegram message or audio in a separate thread (non-blocking).
    Uses async/await properly without blocking Flask request.
    """
    def _send():
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            if audio:
                from io import BytesIO
                audio_stream = BytesIO(audio)
                loop.run_until_complete(
                    bot.send_audio(chat_id=chat_id, audio=audio_stream, caption=caption)
                )
                print("✓ Telegram audio sent")
            elif text:
                loop.run_until_complete(
                    bot.send_message(chat_id=chat_id, text=text)
                )
                print("✓ Telegram message sent")
        except Exception as e:
            print(f"✗ Failed to send Telegram: {e}")
        finally:
            loop.close()
    
    # Run in background thread so it doesn't block the request
    thread = Thread(target=_send, daemon=True)
    thread.start()


def translate_to_english(text: str) -> str:
    """
    Translate text to English using TigoGroq LLM.
    Supports Igbo, Hausa, Yoruba to English translation.
    Falls back to original text if translation fails.
    """
    if not text or not text.strip():
        return text
    
    try:
        print(f"[Translator] Translating: {text[:100]}")
        # Run async function in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        translated = loop.run_until_complete(
            main.get_response_from_ai(text)
        )
        
        loop.close()
        
        print(f"[Translator] ✓ Translated: {translated[:100]}")
        return translated.strip()
        
    except Exception as e:
        print(f"[Translator] ✗ Translation failed: {e}. Using original text.")
        return text


# ----------------------
# Utility: async telegram wrapper
# ----------------------
async def send_telegram_alert(message: str):
    try:
        # bot here is synchronous but most telegram libs also allow sync calls.
        # we attempt to call async style; if it fails, fallback to sync send.
        try:
            await bot.send_message(chat_id=CHAT_ID, text=message)
        except TypeError:
            # fallback for synchronous method
            bot.send_message(chat_id=CHAT_ID, text=message)
        print("Telegram alert sent.")
    except Exception as e:
        print(f"Failed to send Telegram alert: {e}")


# ----------------------
# Routes: frontend, audio listing, audio transcribe, events
# ----------------------
@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/api/audio')
def audio_list():
    return jsonify([
        {"timestamp": datetime.utcnow().timestamp(), "url": "/audio/sample1.mp3"},
        {"timestamp": datetime.utcnow().timestamp(), "url": "/audio/sample2.mp3"}
    ])


@app.route('/api/event', methods=['POST'])
def handle_event():
    evt = request.get_json()
    print(f"\nEvent @ {datetime.utcnow().isoformat()} UTC")
    for node in evt.get('nodes', []):
        print(f"Node {node['id']}: ({node['x']}, {node['y']})")
    src = evt.get('source', {})
    print(f"Source: {src}")
    for i in range(1, 7):
        m = evt.get(f'motion_{i}')
        s = evt.get(f'sound_{i}')
        a = evt.get(f'audio_{i}')
        if m is not None or s is not None:
            print(f"Node {i} motion={m} sound={s} audio={a}")
    print(f"cam1: {evt.get('cam1Link')}")
    print(f"cam2: {evt.get('cam2Link')}")
    print(f"audio stream: {evt.get('audioLink')}")

    socketio.emit('newEvent', evt)
    return jsonify({"status": "ok"}), 200


# ----------------------
# Audio transcription endpoint (keeps your logic)
# ----------------------
@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio part"}), 400
    file = request.files['audio']
    ext = os.path.splitext(file.filename)[1].lower()
    uid = uuid.uuid4().hex
    ts = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    raw_name = f"{ts}_{uid}{ext}"
    raw_path = os.path.join(RAW_UPLOAD_DIR, raw_name)
    file.save(raw_path)

    text = ""
    audio_for_telegram = None
    
    try:
        print(f"[transcribe] Received {ext} file, size: {os.path.getsize(raw_path)} bytes")
        
        # Read the file content
        with open(raw_path, 'rb') as f:
            file_content = f.read()
        
        # Convert WebM to WAV if needed (WebM chunks are not valid standalone files)
        if ext == '.webm':
            print(f"[transcribe] Converting WebM to WAV...")
            wav_content = convert_webm_to_wav(file_content)
            if wav_content:
                file_content = wav_content
                filename = "audio.wav"
                print(f"[transcribe] ✓ Conversion successful, WAV size: {len(wav_content)} bytes")
            else:
                print(f"[transcribe] ✗ Conversion failed, trying raw WebM")
                filename = "audio.webm"
        else:
            filename = f"audio{ext}"
        
        print(f"[transcribe] Sending {filename} ({len(file_content)} bytes) to Groq Whisper...")
        resp = client.audio.transcriptions.create(
            file=(filename, file_content),
            model="whisper-large-v3",
            timeout=120
        )
        text = resp.text
        print(f"[transcribe] ✓ Transcription success: {text[:100] if text else '(empty)'}...")
        
        # Keep file content for Telegram if alert needed
        audio_for_telegram = file_content
        
    except Exception as e:
        print(f"[transcribe] ✗ Whisper error: {e}")
        text = ""

    # Translate to English if text is not empty
    translated_text = text
    if text:
        print(f"[transcribe] Original text: {text}")
        translated_text = translate_to_english(text)
        print(f"[transcribe] Translated text: {translated_text}")

    # Check for violent keywords in translated text
    if translated_text:
        words = translated_text.lower().split()
        if any(word in keywords for word in words):
            print("🚨 Keyword detected in transcription.")
            timestamp_now = datetime.now()
            avg_prob = 0.95

            msg = (
                f"🚨 Alert: Suspicious conversation detected at {timestamp_now.strftime('%Y-%m-%d %H:%M:%S')} (conf={avg_prob:.2f})\n"
                f"Location: College of Engineering And Engineering Technology Umudike Abia State\n"
                f"Original: {text}\n"
                f"Translated: {translated_text}\n"
                f"Please take necessary action."
            )
            print(f"📢 Sending Telegram alert: {msg}")
            # Send in background thread (non-blocking)
            send_telegram_sync(chat_id=CHAT_ID, text=msg)
            
            # send audio (from memory, not file)
            if audio_for_telegram:
                send_telegram_sync(chat_id=CHAT_ID, audio=audio_for_telegram, caption=msg)

    # cleanup - now safe to delete since we read everything into memory
    try:
        os.remove(raw_path)
    except Exception as e:
        print(f"[transcribe] Could not clean up {raw_path}: {e}")

    return jsonify({"text": translated_text}), 200

@app.route("/api/audio-stream", methods=["POST"])
def audio_stream():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio part"}), 400

    blob = request.files['audio']
    temp_path = f"uploads/raw/stream_{uuid.uuid4().hex}.webm"
    blob.save(temp_path)

    # Transcribe directly without conversion
    text = ""
    try:
        print(f"[audio-stream] Reading audio file...")
        with open(temp_path, "rb") as f:
            file_content = f.read()
        
        print(f"[audio-stream] Sending to Groq Whisper...")
        resp = client.audio.transcriptions.create(
            file=("audio.mp3", file_content),  # Send with .mp3 extension (Groq requirement)
            model="whisper-large-v3",
            timeout=60
        )
        text = resp.text.strip()
        print(f"[audio-stream] ✓ Transcription: {text[:100]}")
    except Exception as e:
        print(f"[audio-stream] ✗ Transcription error: {e}")
        text = ""

    # Translate to English
    translated_text = text
    if text:
        print(f"[audio-stream] Translating: {text[:100]}")
        translated_text = translate_to_english(text)
        print(f"[audio-stream] ✓ Translated: {translated_text[:100]}")

    # Check for violent words in translated text and send alert
    if translated_text and detect_violent_words(translated_text):
        alert_msg = (
            f"🚨 **Violent Speech Detected!**\n"
            f"Original: {text}\n"
            f"Translated: {translated_text}\n"
            f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        send_telegram_sync(chat_id=CHAT_ID, text=alert_msg)

    # Cleanup
    try:
        os.remove(temp_path)
    except:
        pass

    return jsonify({"text": translated_text})



@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_from_directory('uploads/raw', filename)


# ----------------------
# Helper: background wrapper to call async process_frame safely
# ----------------------
def _bg_process_frame(frame_b64: str, node_id: str):
    """
    Called inside a worker thread via socketio.start_background_task.
    Runs process_frame (async) by creating a new event loop.
    """
    try:
        asyncio.run(process_frame(frame_b64, socketio, node_id))
    except Exception as e:
        print("[video][bg] processing error:", e)


# ----------------------
# Socket.IO handler for incoming frames (real-time)
# ----------------------
@socketio.on('video_frame', namespace='/ws')
def handle_video_frame_socket(data):
    """
    Receives frames sent via Socket.IO from frontend. Spawns background task that
    runs the full processing pipeline (DB log, alerts, emit processed frame).
    Frontend may also call /api/frame for immediate response.
    """
    node_id = data.get("nodeId", "browser_cam")
    frame_in = data.get("frame")

    if not frame_in:
        print("⚠️ Empty frame received via socket")
        return

    # strip data URL prefix if present
    if frame_in.startswith('data:'):
        _, b64 = frame_in.split(',', 1)
    else:
        b64 = frame_in

    # spawn background job (non-blocking)
    socketio.start_background_task(_bg_process_frame, b64, node_id)


# ----------------------
# Synchronous HTTP endpoint for frontend (/api/frame)
# - returns immediate result (label + confidence)
# - also spawns background full processing for DB and alerts
# ----------------------
@app.route('/api/frame', methods=['POST'])
def api_frame():
    """
    Expected body: { frame: "data:image/jpeg;base64,...", nodeId?: "..." }
    Returns: { label: "Violence"|"Safe", confidence: 0.XX }
    """
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "invalid json"}), 400

    frame_in = payload.get("frame")
    node_id = payload.get("nodeId", "browser_cam")

    if not frame_in:
        return jsonify({"error": "no frame provided"}), 400

    if frame_in.startswith('data:'):
        _, b64 = frame_in.split(',', 1)
    else:
        b64 = frame_in

    # Decode to OpenCV frame
    try:
        jpeg_bytes = base64.b64decode(b64)
        arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as e:
        print("[api/frame] decode error:", e)
        return jsonify({"error": "failed to decode frame"}), 400

    # Quick synchronous inference using the PyTorch model:
    try:
        # Use video_processor preprocessing helper and model (already loaded at import)
        # Preprocess single frame
        pre = vp.preprocess_frame(frame)  # returns H,W,C normalized float32

        # Build a clip by repeating the same frame FRAMES times so 3D model can run
        clip = np.stack([pre for _ in range(vp.FRAMES)])  # (T,H,W,C)
        clip_t = torch.tensor(clip).permute(3, 0, 1, 2).unsqueeze(0).to(vp.device)

        with torch.no_grad():
            prob = float(vp.model(clip_t).item())

        # update smoothing queue
        vp.pred_smooth_queue.append(prob)
        avg_conf = float(np.mean(vp.pred_smooth_queue))
        label = "Violence" if avg_conf > vp.CONF_THRESHOLD else "Safe"

    except Exception as e:
        print("[api/frame] inference error:", e)
        return jsonify({"error": "inference failed"}), 500

    # Spawn background task to perform full processing (DB log, alerts, processed frame emit)
    # We reuse the same base64 string
    socketio.start_background_task(_bg_process_frame, b64, node_id)

    # Return immediate result to frontend (matches the shape your React expects)
    return jsonify({"label": label, "confidence": avg_conf}), 200


# ----------------------
# Run the app safely
# ----------------------
if __name__ == '__main__':
    # Important: debug=False and use_reloader=False avoid double-loading PyTorch
    socketio.run(
        app,
        host='0.0.0.0',
        port=3000,
        debug=False,
        use_reloader=False,
        allow_unsafe_werkzeug=True
    )
