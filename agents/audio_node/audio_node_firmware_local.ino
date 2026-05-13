#include <WiFi.h>
#include <WebSocketsClient.h>
#include <HTTPClient.h>
#include <time.h>
#include "driver/i2s.h"

// ---------------- CONFIG ----------------
const char* ssid = "NISHA_CES";
const char* password = "CES@2470";

// LOCAL LAN CONFIG
const char* backend_url = "http://192.168.1.190:8000/api/v1/agents"; // Laptop IP
const char* ws_host = "192.168.1.231";                             // Master Pi IP
const int ws_port = 8082;                                          // Master Agent WS Port
const char* ws_path = "/";

const char* api_key = "nisha_master_key_2024_secure";
const char* agent_id = "AUDIO-NODE-01";

// ---------------- STATE ----------------
WebSocketsClient webSocket;
bool isConnected = false;

unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 20000;

// ---------------- I2S ----------------
#define I2S_WS   15
#define I2S_SCK  14
#define I2S_SD   13
#define I2S_RX_PORT I2S_NUM_0

#define SAMPLE_RATE 16000
#define CHUNK_SIZE 8000

static int32_t sampleBuffer[CHUNK_SIZE];
static int16_t pcm16[CHUNK_SIZE];

// ---------------- BACKEND ----------------
void registerWithBackend() {
    HTTPClient http;
    http.begin(backend_url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(api_key));

    String payload =
        String("{\"agent_id\":\"") + agent_id +
        "\",\"master_id\":\"MASTER_001\",\"hardware_type\":\"ESP32-S3-AUDIO\",\"capabilities\":{\"audio\":true}}";

    int code = http.POST(payload);
    Serial.printf("Registration Response: %d\n", code);
    http.end();
}

// ---------------- NISHA BINARY PROTOCOL (24-BYTE HEADER) ----------------
void sendNishaFrame(uint8_t type, uint8_t* payload, size_t len) {
    if (!isConnected) return;

    uint8_t header[24];
    memset(header, 0, 24);
    
    header[0] = 'N';
    header[1] = 'I';
    header[2] = 0x01;
    header[3] = type;
    header[4] = 0x03;
    header[5] = 0x00;
    
    static uint32_t seq = 0;
    uint32_t seq_be = __builtin_bswap32(seq++);
    memcpy(&header[6], &seq_be, 4);

    time_t now;
    time(&now);
    uint64_t ts_be = __builtin_bswap64((uint64_t)now * 1000);
    memcpy(&header[10], &ts_be, 8);

    uint32_t pLen_be = __builtin_bswap32((uint32_t)len);
    memcpy(&header[18], &pLen_be, 4);
    
    uint16_t mLen_be = 0;
    memcpy(&header[22], &mLen_be, 2);

    size_t totalSize = 24 + len;
    uint8_t* frame = (uint8_t*)malloc(totalSize);
    if (!frame) return;

    memcpy(frame, header, 24);
    memcpy(frame + 24, payload, len);

    webSocket.sendBIN(frame, totalSize);
    free(frame);
}

// ---------------- WEBSOCKET EVENT ----------------
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            isConnected = false;
            Serial.printf("[WS] Disconnected ❌\n");
            break;

        case WStype_CONNECTED:
            Serial.printf("[WS] Connected ✅ to Master\n");
            isConnected = true;
            webSocket.sendTXT(
                "{\"type\":\"HANDSHAKE\",\"agent_id\":\"" + String(agent_id) + "\",\"mode\":\"AGENT\"}"
            );
            break;

        case WStype_TEXT:
            Serial.printf("[WS] MSG: %s\n", payload);
            break;

        case WStype_ERROR:
            Serial.printf("[WS] ERROR\n");
            break;
    }
}

// ---------------- I2S ----------------
void setupI2S() {
    i2s_config_t config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_I2S,
        .intr_alloc_flags = 0,
        .dma_buf_count = 8,
        .dma_buf_len = 128
    };

    i2s_pin_config_t pins = {
        .bck_io_num = I2S_SCK,
        .ws_io_num = I2S_WS,
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = I2S_SD
    };

    i2s_driver_install(I2S_RX_PORT, &config, 0, NULL);
    i2s_set_pin(I2S_RX_PORT, &pins);
}

// ---------------- SETUP ----------------
void setup() {
    Serial.begin(115200);
    delay(100);
    Serial.println("\n\n=== NISHA LOCAL Audio Node Starting ===");

    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.printf("\nWiFi connected - IP: %s\n", WiFi.localIP().toString().c_str());

    configTime(0, 0, "pool.ntp.org");
    time_t now = time(nullptr);
    while (now < 100000) {
        delay(500);
        now = time(nullptr);
    }

    registerWithBackend();
    setupI2S();

    Serial.printf("[WS] Connecting to ws://%s:%d%s\n", ws_host, ws_port, ws_path);
    webSocket.begin(ws_host, ws_port, ws_path);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(3000);
    webSocket.enableHeartbeat(15000, 3000, 2);
}

// ---------------- LOOP ----------------
void loop() {
    webSocket.loop();

    if (isConnected) {
        if (millis() - lastHeartbeat > heartbeatInterval) {
            lastHeartbeat = millis();
            webSocket.sendTXT("{\"type\":\"HEARTBEAT\",\"agent_id\":\"" + String(agent_id) + "\"}");
        }

        size_t bytesRead = 0;
        i2s_read(I2S_RX_PORT, sampleBuffer, sizeof(sampleBuffer), &bytesRead, portMAX_DELAY);

        if (bytesRead > 0) {
            int samples = bytesRead / 4;
            for (int i = 0; i < samples; i++) {
                pcm16[i] = sampleBuffer[i] >> 11;
            }
            sendNishaFrame(0x03, (uint8_t*)pcm16, samples * 2);
        }
    }
}
