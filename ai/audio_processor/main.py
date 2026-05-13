from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from transcription_service import TranscriptionService
import os
import json
import uuid
import logging
from dotenv import load_dotenv

# Load configuration
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NISHA AI Audio Processor")

# Initialize transcription service
WHISPER_MODEL = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")  # Default to CPU for stability

transcription_service = TranscriptionService(
    api_key=os.getenv("INTRON_SAHARA_API_KEY"),
    model_size=WHISPER_MODEL,
    device=WHISPER_DEVICE
)

@app.post("/api/v1/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form(None),
    agent_id: str = Form(None)
):
    """REST endpoint for single-segment transcription (Master relay)."""
    audio_data = await file.read()
    logger.info(f"Received transcription request from agent {agent_id} ({len(audio_data)} bytes)")
    
    result = await transcription_service.transcribe(audio_data, language=language)
    
    return {
        "status": "success",
        "agent_id": agent_id,
        "text": result["text"],
        "language": result["language"],
        "provider": result["provider"],
        "confidence": result.get("confidence", 0.0)
    }

@app.websocket("/ws/audio")
async def websocket_audio(ws: WebSocket):
    """WebSocket endpoint for real-time streaming transcription."""
    await ws.accept()
    logger.info("New WebSocket client connected for audio processing")

    try:
        while True:
            message = await ws.receive()
            
            if "bytes" not in message:
                continue

            audio_bytes = message["bytes"]
            if not audio_bytes:
                continue

            # In-memory processing via TranscriptionService
            # Note: For streaming, we usually want to accumulate chunks, 
            # but for this existing logic, we process the chunk as a whole.
            result = await transcription_service.transcribe(audio_bytes)

            response = {
                "text": result["text"],
                "language": result["language"],
                "provider": result["provider"],
                "gunshot": False # Placeholder for future classification
            }

            await ws.send_text(json.dumps(response))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")

@app.websocket("/api/v1/stream/{agent_id}")
async def websocket_stream(ws: WebSocket, agent_id: str):
    await ws.accept()
    logger.info(f"Started real-time stream for agent: {agent_id}")
    
    # We will use a rolling buffer to keep context
    rolling_buffer = bytearray()
    
    try:
        while True:
            # Receive raw PCM bytes from the Master
            data = await ws.receive_bytes()
            rolling_buffer.extend(data)
            
            # When we have enough for a small segment (e.g., 1.5 seconds)
            if len(rolling_buffer) >= 48000: # 16kHz * 2 bytes * 1.5s
                # Process this segment
                # Wrap raw PCM in a WAV header so Whisper/FFmpeg can read it
                import struct
                sample_rate = 16000
                bits_per_sample = 16
                channels = 1
                data_size = len(rolling_buffer)
                
                wav_header = struct.pack(
                    '<4sI4s4sIHHIIHH4sI',
                    b'RIFF', 36 + data_size, b'WAVE', b'fmt ', 16, 1, channels,
                    sample_rate, sample_rate * channels * bits_per_sample // 8,
                    channels * bits_per_sample // 8, bits_per_sample, b'data', data_size
                )
                segment_data = wav_header + bytes(rolling_buffer)
                
                # Call the transcription service
                result = await transcription_service.transcribe(segment_data)
                
                if result and result.get("text"):
                    text = result["text"]
                    logger.info(f"LIVE TRANSCRIPT [{agent_id}]: {text}")
                    # Send the partial text back to the Master
                    await ws.send_json({
                        "type": "PARTIAL_TRANSCRIPT",
                        "text": text,
                        "language": result.get("language")
                    })
                
                # Keep the last 0.5s for overlap/context
                rolling_buffer = rolling_buffer[-16000:] 
                
    except WebSocketDisconnect:
        logger.info(f"Stream disconnected for agent: {agent_id}")
    except Exception as e:
        logger.error(f"Streaming error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8083)
