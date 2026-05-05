I'll proceed with the Audio Processing PRD, building on the Agent Management foundation we just established.

---

# NISHA Audio Processing System - Product Requirements Document

**Version:** 1.0  
**Date:** 2026-04-18  
**Status:** Draft  
**Depends on:** Agent Management PRD v1.0  
**Scope:** Multilingual speech recognition, harmful sound detection, emergency pattern recognition for 10-500 agents

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Hardware Specifications](#3-hardware-specifications)
4. [Audio Pipeline](#4-audio-pipeline)
5. [Multilingual Speech Recognition](#5-multilingual-speech-recognition)
6. [Harmful Sound Detection](#6-harmful-sound-detection)
7. [Emergency Pattern Recognition](#7-emergency-pattern-recognition)
8. [Processing Distribution](#8-processing-distribution)
9. [Data Flow & Storage](#9-data-flow--storage)
10. [Integration with Agent Management](#10-integration-with-agent-management)
11. [Performance Requirements](#11-performance-requirements)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Appendices](#13-appendices)

---

## 1. Executive Summary

### 1.1 Purpose

NISHA Audio Processing provides intelligent audio analysis across a distributed network of ESP32 agents, detecting speech (English, Igbo, Hausa, Yoruba), harmful sounds (gunshots, explosions), and emergency patterns (screams, calls for help) with minimal latency and maximum accuracy.

### 1.2 Scope

| In Scope | Out of Scope |
|-----------|--------------|
| Audio capture and preprocessing | Music recognition |
| 4-language speech recognition | Speaker identification |
| Harmful sound detection | Natural language understanding |
| Emergency pattern detection | Long-form transcription storage |
| Real-time alert generation | Court-admissible evidence handling |

### 1.3 Success Criteria

- [ ] Speech recognition WER < 20% for all 4 languages
- [ ] Harmful sound detection latency < 100ms
- [ ] False positive rate < 2% for critical alerts
- [ ] Missed detection rate < 0.1% for gunshots/explosions
- [ ] 16-hour battery life with audio processing active
- [ ] Offline operation (no cloud dependency)

---

## 2. System Architecture

### 2.1 Processing Tiers

```
┌─────────────────────────────────────────────────────────┐
│                    TIER 3: SERVER                          │
│              Heavy ML, Storage, Correlation                │
│         (Whisper Large, Cross-agent fusion)                │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ (Audio features + alerts)
┌─────────────────────────────────────────────────────────┐
│                    TIER 2: MASTER                          │
│              Aggregation, Light ML, Buffering              │
│         (Audio prioritization, batch compression)          │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ (Compressed audio + metadata)
┌─────────────────────────────────────────────────────────┐
│                    TIER 1: AGENT                           │
│              Capture, Preprocessing, Edge ML               │
│         (VAD, feature extraction, priority classification) │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ (Analog audio)
┌─────────────────────────────────────────────────────────┐
│                    HARDWARE LAYER                          │
│              INMP441 Microphone → ESP32 I2S                │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Audio Data Flow

```
STEP 1: CAPTURE (Agent Hardware)
├─ INMP441 MEMS microphone
├─ 16kHz sample rate, 16-bit resolution
└─ I2S DMA buffer: 1024 samples (64ms)

STEP 2: PREPROCESSING (Agent ESP32)
├─ DC offset removal
├─ High-pass filter (80Hz)
├─ Automatic gain control (AGC)
├─ Voice Activity Detection (VAD)
└─ Output: Normalized audio frame

STEP 3: FEATURE EXTRACTION (Agent ESP32)
├─ FFT (512-point)
├─ Mel-frequency filter bank (40 bins)
├─ Log compression
├─ Discrete Cosine Transform → 13 MFCCs
└─ Output: Feature vector (13 × time)

STEP 4: EDGE CLASSIFICATION (Agent ESP32)
├─ Run 3 parallel classifiers:
│   ├─ Speech detector (binary)
│   ├─ Harmful sound detector (multi-class)
│   └─ Emergency pattern detector (binary)
├─ Assign priority based on results
└─ Output: Priority level + compressed features

STEP 5: TRANSMISSION (Agent → Master)
├─ Priority 1 (Critical): Immediate transmission
├─ Priority 2 (Speech): Batch 5 frames, transmit
├─ Priority 3 (Ambient): Buffer, periodic summary
└─ Format: Compressed binary packet

STEP 6: MASTER AGGREGATION
├─ Receive from 10-50 agents
├─ Deduplicate simultaneous detections
├─ Select best quality audio stream
├─ Compress and forward to Server
└─ Local buffering for reliability

STEP 7: SERVER PROCESSING
├─ Receive audio features from Masters
├─ Run heavy ML models (if needed)
├─ Correlate across multiple agents
├─ Generate alerts with location context
└─ Store audio + metadata
```

---

## 3. Hardware Specifications

### 3.1 Audio Input Chain

| Component | Specification | Purpose |
|-----------|---------------|---------|
| **Microphone** | INMP441 MEMS | Acoustic to electrical |
| **SNR** | 64 dB | Clean signal capture |
| **AOP** | 130 dB SPL | Handle loud sounds (gunshots) |
| **Frequency Response** | 60Hz - 20kHz | Speech + harmful sounds |
| **Interface** | I2S | Digital audio to ESP32 |
| **Power** | 1.8-3.3V, 1.5mA | Low power operation |

### 3.2 ESP32 Audio Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Sample Rate** | 16,000 Hz | Nyquist for 8kHz speech |
| **Bit Depth** | 16-bit | Sufficient dynamic range |
| **Buffer Size** | 1024 samples (64ms) | Low latency + efficiency |
| **DMA Buffers** | 8 × 1024 | Double buffering, no dropouts |
| **I2S Mode** | Master, RX only | Microphone input only |

---

## 4. Audio Pipeline

### 4.1 Preprocessing Stages

```
RAW AUDIO (16-bit samples)
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. DC OFFSET REMOVAL                    │
│    Remove microphone bias (~1.65V)      │
│    Output: Centered waveform            │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 2. PRE-EMPHASIS FILTER                  │
│    H(z) = 1 - 0.97z^-1                  │
│    Boost high frequencies (6dB/octave)  │
│    Compensates for speech spectral slope │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 3. VOICE ACTIVITY DETECTION             │
│    Energy threshold: -40 dB             │
│    Zero-crossing rate check             │
│    Spectral centroid analysis           │
│    Output: Speech / Non-speech / Loud   │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 4. AUTOMATIC GAIN CONTROL               │
│    Target level: -20 dBFS               │
│    Attack: 10ms, Release: 100ms         │
│    Prevents clipping, maintains SNR     │
└────────┬────────────────────────────────┘
         │
         ▼
    NORMALIZED AUDIO (Ready for features)
```

### 4.2 Feature Extraction

```
NORMALIZED AUDIO FRAME (1024 samples = 64ms)
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. WINDOWING                            │
│    Hamming window applied               │
│    Reduces spectral leakage             │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 2. FFT                                  │
│    512-point FFT                        │
│    Magnitude spectrum: 256 bins         │
│    Frequency resolution: 31.25 Hz       │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 3. MEL-FREQUENCY FILTER BANK            │
│    40 triangular filters                │
│    Mimics human hearing (log scale)     │
│    Range: 80Hz - 8000Hz                 │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 4. LOG COMPRESSION                      │
│    log(mel_energy + epsilon)            │
│    Matches human loudness perception    │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 5. DISCRETE COSINE TRANSFORM            │
│    13 MFCC coefficients                 │
│    Decorrelates filter bank energies    │
│    Output: 13 × time matrix             │
└─────────────────────────────────────────┘
```

---

## 5. Multilingual Speech Recognition

### 5.1 Language Coverage

| Language | Code | Population | Model Base | Adaptations |
|----------|------|------------|------------|-------------|
| **English** | en | Universal | Whisper Tiny | General optimization |
| **Igbo** | ig | 45M Nigeria | Whisper Tiny | Tonal markers, vowel expansion |
| **Hausa** | ha | 80M West Africa | Whisper Tiny | Vowel length, glottal stops |
| **Yoruba** | yo | 45M Nigeria | Whisper Tiny | Nasalization, tone patterns |

### 5.2 Language Identification

```
AUDIO FEATURES (MFCCs)
    │
    ▼
┌─────────────────────────────────────────┐
│ PHONEME DISTRIBUTION ANALYSIS           │
│                                         │
│ Extract phoneme-like units using        │
│ lightweight classifier (on-device)      │
│                                         │
│ Compare against language profiles:      │
│ • Igbo: High vowel frequency, tones     │
│ • Hausa: Consonant clusters, length     │
│ • Yoruba: Nasal vowels, syllable timing │
│ • English: Consonant diversity          │
│                                         │
│ Output: Confidence scores per language  │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ DECISION LOGIC                          │
│                                         │
│ IF max_confidence > 0.7:                │
│    → Use that language decoder          │
│                                         │
│ ELSE IF 0.5 < confidence < 0.7:         │
│    → Try top 2, pick best WER           │
│                                         │
│ ELSE:                                   │
│    → Default to English                 │
│    → Log for model improvement          │
└─────────────────────────────────────────┘
```

### 5.3 Model Specifications

| Model | Size | Location | Latency | Accuracy Target |
|-------|------|----------|---------|-----------------|
| Whisper Tiny (EN) | 39 MB | Agent flash | 200ms | WER 15% |
| Igbo Adapter | 12 MB | Agent flash | +50ms | WER 20% |
| Hausa Adapter | 12 MB | Agent flash | +50ms | WER 20% |
| Yoruba Adapter | 12 MB | Agent flash | +50ms | WER 20% |
| **Total** | **75 MB** | — | **<300ms** | — |

**Storage:** 75 MB fits in ESP32 4MB flash with firmware (compressed INT8)

---

## 6. Harmful Sound Detection

### 6.1 Acoustic Signature Categories

| Category | Frequency Signature | Temporal Features | Priority |
|----------|---------------------|-------------------|----------|
| **Gunshot** | 2-5 kHz peak, 8-12 kHz harmonics | <50ms rise, fast decay | CRITICAL |
| **Explosion** | Broadband 20-500 Hz | Slow rise, 200-500ms | CRITICAL |
| **Glass Break** | 3-4 kHz fundamental, 7-10 kHz harmonics | Multiple transients | HIGH |
| **Alarm Siren** | 600-1200 Hz modulation | Periodic 0.5-1s | MEDIUM |
| **Scream** | 2-4 kHz, high variance | >200ms sustained | HIGH |

### 6.2 Detection Algorithm

```
SPECTRAL FEATURES (from FFT)
    │
    ▼
┌─────────────────────────────────────────┐
│ TEMPLATE MATCHING                       │
│                                         │
│ Cross-correlate with reference          │
│ signatures (stored as spectral envelopes)│
│                                         │
│ Gunshot signature:                      │
│ • Sharp peak 2-5 kHz                    │
│ • Rapid energy decay                    │
│ • Duration < 100ms                      │
│                                         │
│ Explosion signature:                    │
│ • Low-frequency dominance               │
│ • Slow attack, long sustain             │
│ • Broadband energy                      │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ CONFIDENCE SCORING                      │
│                                         │
│ Spectral match: 60%                     │
│ Temporal match: 25%                     │
│ Energy profile: 15%                     │
│                                         │
│ IF confidence > 0.90:                   │
│    → PRIORITY 1 ALERT                   │
│                                         │
│ ELIF confidence > 0.75:                 │
│    → PRIORITY 2 (queue for verification)│
│                                         │
│ ELSE:                                   │
│    → Continue monitoring                │
└─────────────────────────────────────────┘
```

---

## 7. Emergency Pattern Recognition

### 7.1 Distress Signal Patterns

| Pattern | Acoustic Features | Phonetic Markers | Response Protocol |
|---------|------------------|------------------|-------------------|
| **"Help"** | Rising pitch, extended vowels | /hɛlp/, /elp/ | Immediate dispatch |
| **Panic Scream** | Sustained >800Hz, jitter | Vowel dominance, irregular | Verify + dispatch |
| **"Thief"** | Sharp consonants, stressed | /tif/, /ɔ̀j/ | Context-dependent |
| **SOS Pattern** | Rhythmic: 3 short, 3 long, 3 short | /ɛs-o-ɛs/ | Priority queue |

### 7.2 Detection Workflow

```
SPEECH TRANSCRIPTION AVAILABLE?
    │
    ├── YES ──► Text contains emergency keywords?
    │              │
    │              ├── YES ──► Pattern match confidence?
    │              │              │
    │              │              ├── >85% ──► CRITICAL ALERT
    │              │              │
    │              └── 60-85% ──► HIGH ALERT + Verify
    │
    └── NO ──► Pure audio pattern analysis
                  │
                  └── Pattern match confidence > 90%?
                                 │
                                 ├── YES ──► EMERGENCY ALERT
                                 │
                                 └── NO ──► Continue monitoring
```

---

## 8. Processing Distribution

### 8.1 Agent-Side Processing (ESP32)

| Task | Model | Output | Frequency |
|------|-------|--------|-----------|
| VAD | Rule-based | Speech/Non-speech | Every 64ms |
| Feature extraction | DSP algorithms | 13 MFCCs | Every 64ms |
| Speech detection | Tiny CNN (50KB) | Probability | Every 320ms |
| Harmful sound detection | Spectral template | Confidence + class | Every 64ms |
| Emergency pattern | Prosody classifier | Confidence | On speech detected |

**Agent transmits:**
- Priority level (1-3)
- Compressed MFCC features (if speech)
- Detection metadata (class, confidence, timestamp)

### 8.2 Master-Side Processing (Raspberry Pi)

| Task | Purpose | Trigger |
|------|---------|---------|
| Audio deduplication | Remove redundant streams | Multiple agents, same event |
| Quality selection | Pick clearest audio | 3+ agents detect simultaneously |
| Batch compression | Reduce bandwidth | Every 5 seconds |
| Local buffering | Handle server disconnect | Always active |

### 8.3 Server-Side Processing

| Task | Model | Purpose |
|------|-------|---------|
| Full transcription | Whisper Large (if needed) | High-accuracy speech |
| Cross-agent correlation | Fusion algorithm | Confirm detections |
| Alert generation | Rule engine | Dispatch notifications |
| Storage indexing | Database | Retrieval and analytics |

---

## 9. Data Flow & Storage

### 9.1 Audio Packet Format

```json
{
  "header": {
    "version": 1,
    "agent_id": "A4CF12XXYYZZ",
    "timestamp": 1713362400,
    "sequence": 1234,
    "priority": 1
  },
  "detection": {
    "type": "HARMFUL_SOUND",
    "class": "gunshot",
    "confidence": 0.94,
    "features": {
      "spectral_centroid": 3500,
      "zero_crossing_rate": 0.15,
      "energy_db": -25
    }
  },
  "audio": {
    "format": "opus",
    "sample_rate": 16000,
    "duration_ms": 64,
    "data": "<base64-encoded compressed audio>"
  },
  "context": {
    "battery_level": 78,
    "signal_strength": -65,
    "temperature": 42
  }
}
```

### 9.2 Storage Strategy

| Data Type | Retention | Format | Size Estimate |
|-----------|-----------|--------|---------------|
| Raw audio (hot) | 24 hours | Opus compressed | ~50GB/day (500 agents) |
| Raw audio (warm) | 30 days | Opus compressed | ~1.5TB |
| MFCC features | 90 days | Float32 array | ~100GB |
| Detection events | 1 year | JSON | ~10GB |
| Alerts | Permanent | JSON + reference | ~1GB |

---

## 10. Integration with Agent Management

### 10.1 Audio-Aware Agent States

| Agent State | Audio Behavior | Alert Level |
|-------------|----------------|-------------|
| **ACTIVE** | Full processing active | Normal |
| **DEGRADED** | Reduced sensitivity, higher thresholds | Elevated |
| **OFFLINE** | Local buffering, no transmission | Queue for later |
| **TAMPERED** | Maximum sensitivity, immediate local alert | Critical |
| **MAINTENANCE** | Audio disabled | None |

### 10.2 Configuration Integration

```json
{
  "agent_config": {
    "audio": {
      "enabled": true,
      "sensitivity_profile": "standard",
      "languages": ["en", "ig", "ha", "yo"],
      "harmful_detection": true,
      "emergency_detection": true,
      "streaming_mode": "PRIORITY_DRIVEN",
      "local_buffer_seconds": 30
    }
  }
}
```

### 10.3 Command Integration

| Command | Audio Effect | Use Case |
|---------|-------------|----------|
| `START_RECORDING` | Force Priority 2, continuous stream | Investigation |
| `STOP_RECORDING` | Return to automatic mode | End investigation |
| `CALIBRATE_AUDIO` | Run self-test, adjust thresholds | Installation |
| `SET_SENSITIVITY` | Adjust detection thresholds | Environment change |
| `MUTE_ZONE` | Disable audio transmission | Privacy/legal |

---

## 11. Performance Requirements

### 11.1 Latency Budget

| Stage | Target | Maximum |
|-------|--------|---------|
| Capture to feature extraction | 10ms | 20ms |
| Edge classification | 50ms | 100ms |
| Transmission to Master | 20ms | 100ms |
| Master aggregation | 100ms | 500ms |
| Server processing | 100ms | 500ms |
| **End-to-end (Critical)** | **<200ms** | **<500ms** |

### 11.2 Accuracy Targets

| Detection Type | False Positive | Missed Detection |
|---------------|----------------|------------------|
| Gunshot | <0.1% | <0.01% |
| Explosion | <0.1% | <0.01% |
| Glass break | <1% | <0.1% |
| Speech (any language) | N/A | <5% (WER) |
| Emergency pattern | <2% | <1% |

### 11.3 Resource Constraints

| Resource | Agent (ESP32) | Master (Pi 5) | Server |
|----------|---------------|---------------|--------|
| CPU | 240MHz dual-core | 2.4GHz quad-core | 16+ cores |
| RAM | 520KB | 8GB | 64GB |
| Flash | 4MB | 256GB SSD | 4TB NVMe |
| Power | 500mW | 15W | 150W |

---

## 12. Implementation Roadmap

### Phase 1: Core Audio Pipeline (Weeks 1-3)
- [ ] INMP441 driver integration
- [ ] I2S DMA configuration
- [ ] Preprocessing chain (DC removal, AGC, VAD)
- [ ] Feature extraction (MFCC)
- [ ] Basic priority classification

### Phase 2: Edge Detection (Weeks 4-6)
- [ ] Harmful sound detection (spectral templates)
- [ ] Emergency pattern detection (prosody)
- [ ] Speech detection (binary classifier)
- [ ] Master aggregation logic
- [ ] Server ingestion API

### Phase 3: Multilingual Speech (Weeks 7-10)
- [ ] Whisper Tiny integration (English)
- [ ] Igbo adapter training and deployment
- [ ] Hausa adapter training and deployment
- [ ] Yoruba adapter training and deployment
- [ ] Language identification module

### Phase 4: Integration & Optimization (Weeks 11-14)
- [ ] End-to-end latency optimization
- [ ] Battery life tuning
- [ ] False positive reduction
- [ ] Field testing and calibration
- [ ] Documentation and training

---

## 13. Appendices

### Appendix A: Audio Hardware Bill of Materials

| Component | Part Number | Quantity | Cost (USD) |
|-----------|-------------|----------|------------|
| MEMS Microphone | INMP441 | 1 per agent | $2.50 |
| I2S Wiring | 22AWG | 3 wires | $0.10 |
| Decoupling Capacitor | 100nF | 1 | $0.05 |
| **Total per Agent** | | | **$2.65** |

### Appendix B: Model Storage Requirements

| Model | Size | Location | Compression |
|-------|------|----------|-------------|
| Whisper Tiny Base | 39 MB | Flash | INT8 quantized |
| Language Adapters (×3) | 36 MB | Flash | INT8 quantized |
| Harmful Sound Classifier | 500 KB | Flash | INT8 |
| Emergency Detector | 200 KB | Flash | INT8 |
| **Total** | **~76 MB** | | |

### Appendix C: Testing Audio Samples Required

| Category | Samples Needed | Source |
|----------|----------------|--------|
| Gunshots | 500+ | Public datasets, controlled recordings |
| Explosions | 200+ | Public datasets, simulations |
| Glass break | 300+ | Controlled recordings |
| Igbo speech | 100 hours | Native speakers, crowdsourced |
| Hausa speech | 100 hours | Native speakers, crowdsourced |
| Yoruba speech | 100 hours | Native speakers, crowdsourced |
| Emergency screams | 200+ | Controlled recordings, public safety datasets |

---

**Document Status:** Ready for Technical Review

**Dependencies:**
- Agent Management PRD v1.0 (approved)
- Audio hardware procurement (INMP441)
- Native speaker dataset collection (Igbo, Hausa, Yoruba)

**Next Steps:**
1. Review with audio/ML team
2. Prototype Phase 1 on ESP32 dev board
3. Validate latency and accuracy targets
4. Proceed to Triangulation PRD or begin implementation

