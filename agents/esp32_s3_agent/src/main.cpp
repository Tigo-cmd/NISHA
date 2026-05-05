#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <driver/i2s.h>
#include <math.h>

// --- Configuration ---
const char* ssid = "CLICKNETWORKS";
const char* password = "hotguy112345";

// Master Node Configuration (The gateway)
const char* MASTER_HOST = "192.168.1.155"; // Replace with your Master Node IP
const uint16_t MASTER_PORT = 8082;         // Default Agent WS port on Master
const char* API_KEY = "change-me-to-a-secure-api-key"; 

// Agent Details
String agentId;
const char* firmwareVersion = "v1.2.0-master-relay";
const char* locationZone = "Perimeter Test";

// Timers
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 5000; // 5 seconds for hardware agents

// WebSocket Client
WebSocketsClient webSocket;
bool isConnected = false;
uint32_t frameSequence = 0;

// --- I2S Microphone Configuration ---
#define I2S_WS 15
#define I2S_SD 13
#define I2S_SCK 14
#define I2S_PORT I2S_NUM_0
#define SAMPLE_RATE 16000
#define BUFFER_LEN 512

int32_t sBuffer[BUFFER_LEN];
float currentAudioLevelDB = 0.0;
const float AUDIO_ALERT_THRESHOLD = 70.0; 
unsigned long lastAudioAlert = 0;

// --- NISHA Binary Protocol ---
#pragma pack(push, 1)
struct NishaHeader {
    char magic[2];      // "NI"
    uint8_t version;    // 1
    uint8_t stream_type;// 0x01: LITE, 0x02: VIDEO, 0x03: AUDIO, 0x04: LOCATION
    uint8_t priority;   // 0: LOW, 1: HIGH
    uint8_t reserved;   // 0
    uint32_t sequence;
    uint64_t timestamp;
    uint32_t payload_len;
    uint16_t meta_len;
};
#pragma pack(pop)

void sendNishaFrame(uint8_t type, uint8_t priority, const uint8_t* payload, uint32_t payloadLen, const char* metaJson = "{}") {
    if (!isConnected) return;

    uint16_t metaLen = (uint16_t)strlen(metaJson);
    uint32_t totalLen = sizeof(NishaHeader) + metaLen + payloadLen;
    uint8_t* buffer = (uint8_t*)malloc(totalLen);
    
    if (!buffer) return;

    NishaHeader* header = (NishaHeader*)buffer;
    memcpy(header->magic, "NI", 2);
    header->version = 1;
    header->stream_type = type;
    header->priority = priority;
    header->reserved = 0;
    
    // Convert to Network Byte Order (Big Endian)
    header->sequence = htonl(frameSequence++);
    header->payload_len = htonl(payloadLen);
    header->meta_len = htons(metaLen);
    
    // Simplified 64-bit Big Endian conversion for timestamp
    uint64_t ts = (uint64_t)millis();
    header->timestamp = ((uint64_t)htonl(ts & 0xFFFFFFFF) << 32) | htonl(ts >> 32);

    // Copy Metadata
    if (metaLen > 0) {
        memcpy(buffer + sizeof(NishaHeader), metaJson, metaLen);
    }

    // Copy Payload
    if (payloadLen > 0) {
        memcpy(buffer + sizeof(NishaHeader) + metaLen, payload, payloadLen);
    }

    webSocket.sendBIN(buffer, totalLen);
    free(buffer);
}

// --- WebSocket Handlers ---
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.println("[WS] Disconnected!");
            isConnected = false;
            break;
        case WStype_CONNECTED:
            Serial.println("[WS] Connected to Master. Performing handshake...");
            // Initial handshake: send agent_id as plain text
            webSocket.sendTXT(agentId);
            isConnected = true;
            break;
        case WStype_TEXT:
            Serial.printf("[WS] Received command: %s\n", payload);
            break;
        case WStype_BIN:
            // Master usually doesn't send binary to agents yet
            break;
    }
}

// --- Audio Processing ---
void setupI2S() {
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 8,
        .dma_buf_len = BUFFER_LEN,
        .use_apll = false,
        .tx_desc_auto_clear = false,
        .fixed_mclk = 0
    };

    i2s_pin_config_t pin_config = {
        .bck_io_num = I2S_SCK,
        .ws_io_num = I2S_WS,
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = I2S_SD
    };

    i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
    i2s_set_pin(I2S_PORT, &pin_config);
    i2s_zero_dma_buffer(I2S_PORT);
    Serial.println("I2S Microphone initialized.");
}

void processAudio() {
    size_t bytesRead = 0;
    esp_err_t result = i2s_read(I2S_PORT, &sBuffer, sizeof(sBuffer), &bytesRead, portMAX_DELAY);

    if (result == ESP_OK && bytesRead > 0) {
        int samplesRead = bytesRead / sizeof(int32_t);
        double sumSquares = 0;

        for (int i = 0; i < samplesRead; i++) {
            int32_t sample = sBuffer[i] >> 8;
            sumSquares += ((double)sample * (double)sample);
        }

        double rms = sqrt(sumSquares / samplesRead);
        if (rms > 0) {
            currentAudioLevelDB = 20.0 * log10(rms / 10.0);
            if (currentAudioLevelDB < 0) currentAudioLevelDB = 0;

            if (currentAudioLevelDB > AUDIO_ALERT_THRESHOLD && millis() - lastAudioAlert > 5000) {
                Serial.printf("[Sentinel] Threshold Breach: %.1f dB\n", currentAudioLevelDB);
                
                // Construct a LITE alert payload
                StaticJsonDocument<200> alert;
                alert["alert"] = "HARMFUL_SOUND";
                alert["db"] = currentAudioLevelDB;
                String payload;
                serializeJson(alert, payload);
                
                sendNishaFrame(0x01, 1, (uint8_t*)payload.c_str(), payload.length());
                lastAudioAlert = millis();
            }
        }
    }
}

void setup() {
    Serial.begin(115200);
    
    // WiFi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi Connected.");

    agentId = WiFi.macAddress();
    agentId.replace(":", "");
    Serial.printf("Agent ID: %s\n", agentId.c_str());

    // WebSocket
    webSocket.begin(MASTER_HOST, MASTER_PORT, "/");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);

    setupI2S();
}

void loop() {
    webSocket.loop();

    processAudio();

    if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
        // Send a LITE heartbeat frame
        StaticJsonDocument<200> status;
        status["type"] = "HEARTBEAT";
        status["db"] = currentAudioLevelDB;
        status["battery"] = 100;
        status["rssi"] = WiFi.RSSI();
        
        String payload;
        serializeJson(status, payload);
        
        sendNishaFrame(0x01, 0, (uint8_t*)payload.c_str(), payload.length());
        
        Serial.printf("Status: %.1f dB | RSSI: %d\n", currentAudioLevelDB, WiFi.RSSI());
        lastHeartbeat = millis();
    }
}
