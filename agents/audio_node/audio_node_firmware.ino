#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebSocketsClient.h> 
#include <HTTPClient.h>
#include <time.h>            // Added for NTP
#include "driver/i2s.h"

// --- CONFIGURATION ---
const char* ssid = "CLICKNETWORKS";
const char* password = "hotguy112345";
const char* backend_url = "http://192.168.1.155:8081/api/v1/agents";
const char* master_ws_url = "192.168.1.155"; 
const int master_ws_port = 8082;            

const char* api_key = "nisha_master_key_2024_secure";
const char* agent_id = "AUDIO-NODE-01";

// --- HEARTBEAT TIMER ---
unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 20000; // 20 seconds

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

    uint8_t header[24];
    memset(header, 0, 24);
    
    header[0] = 'N';                
    header[1] = 'I';                
    header[2] = 0x01;               // version
    header[3] = type;               // 0x03 for Audio
    header[4] = 0x03;               // priority (0x03 = CONTINUOUS for streams)
    header[5] = 0x00;               
    
    static uint32_t seq = 0;
    uint32_t seq_be = __builtin_bswap32(seq++);
    memcpy(&header[6], &seq_be, 4);

    // Get current NTP time
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
    if (!frame) return; // OOM safety

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
        case WStype_CONNECTED: {
            Serial.println("[WS] Connected to Master");
            // MODERN HANDSHAKE: Send JSON
            String handshake = "{\"type\":\"HANDSHAKE\",\"agent_id\":\"" + String(agent_id) + "\",\"mode\":\"AGENT\"}";
            webSocket.sendTXT(handshake);
            delay(100); // Give Master a moment to register the agent
            isConnected = true;
            break;
        }
        case WStype_TEXT:
            Serial.printf("[WS] Command: %s\n", payload);
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

    // Sync time with NTP (Essential for backend acceptance)
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    Serial.println("Waiting for NTP time sync...");
    time_t now = time(nullptr);
    while (now < 8 * 3600 * 2) {
        delay(500);
        now = time(nullptr);
    }
    Serial.println("Time synchronized");

    if (!MDNS.begin("audio-node-01")) {
        Serial.println("Error setting up MDNS!");
    }

    registerWithBackend();
    setupI2S();

    // CONNECT TO ROOT "/" INSTEAD OF "/ws"
    webSocket.begin(master_ws_url, master_ws_port, "/");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
}

void loop() {
    webSocket.loop();

    if (isConnected) {
        // Send Periodic Heartbeat (Every 10s for testing)
        if (millis() - lastHeartbeat > 10000) {
            lastHeartbeat = millis();
            String hb = "{\"type\":\"HEARTBEAT\",\"agent_id\":\"" + String(agent_id) + "\",\"battery\":100,\"rssi\":-50}";
            webSocket.sendTXT(hb);
            Serial.println("[WS] Heartbeat sent");
        }

        /* --- TEMPORARILY DISABLED FOR DEBUGGING ---
        size_t bytesRead = 0;
        i2s_read(I2S_RX_PORT, (void*)sampleBuffer, sizeof(sampleBuffer), &bytesRead, portMAX_DELAY);
        
        if (bytesRead > 0) {
            int samples = bytesRead / 4;
            for (int i = 0; i < samples; i++) {
                pcm16[i] = (int16_t)(sampleBuffer[i] >> 11);
            }
            sendNishaFrame(0x03, (uint8_t*)pcm16, samples * 2);
        }
        ------------------------------------------- */
        delay(10); // Small yield
    }
}
