/*
 * NISHA Sentinel - Audio Node Firmware (ESP32-S3)
 * Reconfigured for Real-Time WebSocket streaming to NISHA Master.
 */

#include <WiFi.h>
#include <WebSocketsClient.h> // Ensure you have the "WebSockets" library by Markus Sattler
#include <HTTPClient.h>
#include "driver/i2s.h"

// --- CONFIGURATION ---
const char* ssid = "Tigonuel";
const char* password = "        ";
const char* backend_url = "http://10.249.27.48:8081/api/v1/agents";
const char* master_ws_url = "10.249.27.48"; // Master IP
const int master_ws_port = 8082;            // Master Telemetry Port
const char* api_key = "nisha_master_key_2024_secure";
const char* agent_id = "AUDIO-NODE-01";

// --- I2S PINS ---
#define I2S_WS   15
#define I2S_SCK  14
#define I2S_SD   13
#define I2S_RX_PORT I2S_NUM_0

// --- AUDIO SETTINGS ---
#define SAMPLE_RATE 16000
#define CHUNK_SIZE 8000
static int32_t sampleBuffer[CHUNK_SIZE];
static int16_t pcm16[CHUNK_SIZE];

WebSocketsClient webSocket;
bool isConnected = false;

// --- REGISTRATION ---
void registerWithBackend() {
    HTTPClient http;
    http.begin(backend_url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(api_key));

    String payload = "{";
    payload += "\"agent_id\": \"" + String(agent_id) + "\",";
    payload += "\"master_id\": \"MASTER_001\",";
    payload += "\"hardware_type\": \"ESP32-S3-AUDIO\",";
    payload += "\"capabilities\": {\"audio\": true, \"video\": false}";
    payload += "}";

    int code = http.POST(payload);
    Serial.printf("Registration Response: %d\n", code);
    http.end();
}

// --- NISHA BINARY PROTOCOL (24-BYTE HEADER) ---
void sendNishaFrame(uint8_t type, uint8_t* payload, size_t len) {
    if (!isConnected) return;

    // Official Header (24 bytes)
    // Format: magic(2s), ver(B), type(B), prio(B), res(B), seq(I), ts(Q), payload_len(I), meta_len(H)
    uint8_t header[24];
    memset(header, 0, 24);
    
    header[0] = 'N';                // magic
    header[1] = 'I';                // magic
    header[2] = 0x01;               // version
    header[3] = type;               // stream_type (0x03 for Audio)
    header[4] = 0x50;               // priority (Master uses this as RSSI, 0x50 = 80)
    header[5] = 0x00;               // reserved
    
    // sequence (4 bytes, Big Endian)
    static uint32_t seq = 0;
    uint32_t seq_be = __builtin_bswap32(seq++);
    memcpy(&header[6], &seq_be, 4);

    // timestamp (8 bytes, Big Endian)
    uint64_t ts_be = __builtin_bswap64((uint64_t)time(NULL) * 1000);
    memcpy(&header[10], &ts_be, 8);

    // payload_len (4 bytes, Big Endian)
    uint32_t pLen_be = __builtin_bswap32((uint32_t)len);
    memcpy(&header[18], &pLen_be, 4);
    
    // meta_len (2 bytes, Big Endian)
    uint16_t mLen_be = 0;
    memcpy(&header[22], &mLen_be, 2);

    // Send Header + Payload
    size_t totalSize = 24 + len;
    uint8_t* frame = (uint8_t*)malloc(totalSize);
    memcpy(frame, header, 24);
    memcpy(frame + 24, payload, len);

    webSocket.sendBIN(frame, totalSize);
    free(frame);
}

// --- WEBSOCKET HANDLER ---
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            isConnected = false;
            Serial.println("[WS] Disconnected");
            break;
        case WStype_CONNECTED:
            Serial.println("[WS] Connected to Master");
            // MANDATORY HANDSHAKE: Send Agent ID as TEXT first
            webSocket.sendTXT(agent_id);
            isConnected = true;
            break;
        case WStype_TEXT:
            Serial.printf("[WS] Command received: %s\n", payload);
            break;
    }
}

// --- I2S SETUP ---
void setupI2S() {
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_I2S,
        .intr_alloc_flags = 0,
        .dma_buf_count = 8,
        .dma_buf_len = 128
    };

    i2s_pin_config_t pin_config = {
        .bck_io_num = I2S_SCK,
        .ws_io_num  = I2S_WS,
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num  = I2S_SD
    };

    i2s_driver_install(I2S_RX_PORT, &i2s_config, 0, NULL);
    i2s_set_pin(I2S_RX_PORT, &pin_config);
    i2s_start(I2S_RX_PORT);
}

void setup() {
    Serial.begin(115200);
    
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected");

    registerWithBackend();
    setupI2S();

    webSocket.begin(master_ws_url, master_ws_port, "/ws");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
}

void loop() {
    webSocket.loop();

    if (isConnected) {
        size_t bytesRead = 0;
        i2s_read(I2S_RX_PORT, (void*)sampleBuffer, sizeof(sampleBuffer), &bytesRead, portMAX_DELAY);
        
        if (bytesRead > 0) {
            int samples = bytesRead / 4;
            for (int i = 0; i < samples; i++) {
                // Downsample 32-bit to 16-bit
                pcm16[i] = (int16_t)(sampleBuffer[i] >> 11);
            }
            // Send as NISHA Audio Frame (Type 0x03)
            sendNishaFrame(0x03, (uint8_t*)pcm16, samples * 2);
        }
    }
}
