from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from transcription_service import TranscriptionService
from audio_classifier import YAMNetClassifier
import os
import json
import logging
import numpy as np
from dotenv import load_dotenv
from fastrtc import ReplyOnPause, Stream
import time

# Load configuration
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="NISHA AI Audio Processor")

# Initialize transcription service (Handles Groq + Local Fallback)
WHISPER_MODEL = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")

transcription_service = TranscriptionService(
    model_size=WHISPER_MODEL,
    device=WHISPER_DEVICE
)

# Initialize Audio Classifier (YAMNet)
audio_classifier = YAMNetClassifier()

# ── Keyword Threat Scanner ──────────────────────────────────────────
# Ported from Nisha_eyes.py — scans transcribed text for violence keywords
VIOLENCE_KEYWORDS = {
    "kill", "shoot", "gun", "weapon", "knife", "stab", "blood",
    "kidnap", "hostage", "murder", "assassinate", "fire", "bomb",
    "attack", "help me", "i'm dying", "please help", "violence",
    "fighting", "gunshot", "beat him", "hurt him", "destroy", "danger",
    "pistol", "rifle", "shotgun", "ammunition", "help", "assist",
    "robbery", "steal", "thief", "robber", "armed",
}

def scan_for_threats(text: str) -> list[str]:
    """
    Scans transcribed text for violence-related keywords.
    Returns list of matched keywords (empty if clean).
    """
    if not text:
        return []
    text_lower = text.lower()
    matches = []
    for keyword in VIOLENCE_KEYWORDS:
        if keyword in text_lower:
            matches.append(keyword)
    return matches


# --- FastRTC Integration ---
# This allows the Frontend to connect directly via WebRTC for ultra-low latency
async def fastrtc_handler(audio: tuple[int, np.ndarray]):
    """
    FastRTC calls this when voice activity stops (ReplyOnPause).
    `audio` is (sample_rate, numpy_array).
    """
    result = await transcription_service.transcribe(audio)
    if result and result.get("text"):
        logger.info(f"[FastRTC] TRANSCRIPT: {result['text']}")
        # In a real scenario, we might broadcast this to all dashboard clients
        # or return it to the browser if mode was send-receive.
    return None

stream = Stream(
    handler=ReplyOnPause(fastrtc_handler),
    modality="audio",
    mode="send-receive",
)
# Mount FastRTC at /rtc
stream.mount(app)

@app.post("/api/v1/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form(None),
    agent_id: str = Form(None)
):
    """REST endpoint for single-segment transcription (Master relay)."""
    audio_data = await file.read()
    logger.info(f"Received REST transcription request for agent {agent_id}")
    
    result = await transcription_service.transcribe(audio_data, language=language)
    
    return {
        "status": "success",
        "agent_id": agent_id,
        "text": result["text"],
        "language": result["language"],
        "provider": result["provider"]
    }

@app.websocket("/api/v1/stream/{agent_id}")
async def websocket_stream(ws: WebSocket, agent_id: str):
    """
    WebSocket endpoint for real-time streaming from the Master node.
    Master sends raw PCM16 bytes (16kHz, Mono).
    Uses Energy VAD + YAMNet for segmentation, alerting, and keyword scanning.
    """
    await ws.accept()
    logger.info(f"Started real-time stream (Energy VAD + YAMNet + Keyword Scanner) for agent: {agent_id}")
    
    audio_buffer = bytearray()
    is_speaking = False
    silence_duration = 0
    bytes_since_last_classification = 0
    
    try:
        while True:
            # Receive raw PCM bytes from the Master
            data = await ws.receive_bytes()
            if not data:
                continue
                
            # Ensure data length is even to prevent np.frombuffer crashes on fragmented packets
            if len(data) % 2 != 0:
                data += b'\x00'
                
            audio_buffer.extend(data)
            bytes_since_last_classification += len(data)
            
            # Simple Energy-based VAD (Root Mean Square)
            samples = np.frombuffer(data, dtype=np.int16)
            if len(samples) > 0:
                rms = np.sqrt(np.mean(samples.astype(np.float32)**2))
                is_speech_frame = rms > 300  # Threshold for 16-bit PCM voice detection
            else:
                is_speech_frame = False

            # ── REAL-TIME ALERTS (every ~0.5 seconds / 16000 bytes) ──
            if bytes_since_last_classification >= 16000:
                # Classify the last ~1 second of audio (up to 32000 bytes)
                window_bytes = audio_buffer[-32000:]
                window_samples = np.frombuffer(window_bytes, dtype=np.int16)
                if len(window_samples) > 8000:
                    _, alert_class, alert_conf, severity, send_telegram = audio_classifier.classify_frame(window_samples)
                    if alert_class and severity:
                        logger.warning(f"🚨 NISHA ALERT [{agent_id}]: {alert_class} ({alert_conf:.2f}) [TIER: {severity.upper()}]")
                        await ws.send_json({
                            "type": "AUDIO_ALERT",
                            "sound_class": alert_class,
                            "confidence": alert_conf,
                            "severity": severity,
                            "send_telegram": send_telegram,
                            "timestamp": time.time()
                        })
                bytes_since_last_classification = 0


            if is_speech_frame:
                if not is_speaking:
                    logger.debug(f"Agent {agent_id} started speaking")
                is_speaking = True
                silence_duration = 0
            else:
                if is_speaking:
                    silence_duration += len(samples) / 16000.0 # seconds
                    
            # If we were speaking and now there is a significant pause (~0.5s)
            # OR if the buffer is getting too long (e.g. 10s safety limit)
            if (is_speaking and silence_duration >= 0.5) or len(audio_buffer) > 320000: # 10s limit
                # Process the segment
                segment_bytes = bytes(audio_buffer)
                audio_buffer = bytearray() # Clear buffer
                is_speaking = False
                silence_duration = 0
                bytes_since_last_classification = 0
                
                segment_samples = np.frombuffer(segment_bytes, dtype=np.int16)
                
                # --- SMART TRANSCRIPTION FILTER ---
                # Check if the entire segment actually contains speech
                is_speech, _, _, _, _ = audio_classifier.classify_frame(segment_samples)
                
                if not is_speech:
                    logger.info(f"YAMNet filtered out non-speech segment ({len(segment_bytes)} bytes) for {agent_id}")
                    continue
                    
                result = await transcription_service.transcribe(segment_bytes)
                
                if result and result.get("text"):
                    text = result["text"]
                    logger.info(f"VAD SEGMENT [{agent_id}]: {text}")

                    # ── KEYWORD THREAT SCANNER ──────────────────────
                    threat_keywords = scan_for_threats(text)
                    if threat_keywords:
                        logger.warning(
                            f"🗣️ THREAT DETECTED [{agent_id}]: keywords={threat_keywords} in \"{text}\""
                        )
                        # Send transcript alert FIRST (separate from transcription)
                        await ws.send_json({
                            "type": "TRANSCRIPT_ALERT",
                            "text": text,
                            "keywords": threat_keywords,
                            "keyword_count": len(threat_keywords),
                            "severity": "critical" if len(threat_keywords) >= 2 else "high",
                            "send_telegram": len(threat_keywords) >= 2,
                            "language": result.get("language"),
                            "timestamp": time.time()
                        })

                    # Relay transcription back to Master -> Dashboard
                    await ws.send_json({
                        "type": "PARTIAL_TRANSCRIPT",
                        "text": text,
                        "language": result.get("language"),
                        "provider": result.get("provider"),
                        "is_final": True,
                        "has_threat": len(threat_keywords) > 0,
                        "threat_keywords": threat_keywords if threat_keywords else None
                    })
                
    except WebSocketDisconnect:
        logger.info(f"Stream disconnected for agent: {agent_id}")
    except Exception as e:
        logger.error(f"Streaming error for {agent_id}: {e}")

if __name__ == "__main__":
    import uvicorn
    # AI Processor runs on port 8083 by default
    uvicorn.run(app, host="0.0.0.0", port=8083)
