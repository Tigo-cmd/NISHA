/*
 * NISHA Sentinel - ESP32-CAM Fixed Node Firmware
 * STABILITY RECOVERY VERSION
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include "esp_http_server.h"
#include <time.h>

// =====================================================
// WIFI CONFIG
// =====================================================
const char* ssid = "CLICKNETWORKS";
const char* password = "hotguy112345";

// =====================================================
// BACKEND CONFIG
// =====================================================
const char* backend_url = "http://api.buildwave.pro/api/v1/agents";
const char* ws_host = "m01ws.buildwave.pro";
const int ws_port = 443;
const char* ws_path = "/";
const char* api_key = "nisha_master_key_2024_secure";
const char* master_id = "MASTER_001";

// =====================================================
// STATE
// =====================================================
WebSocketsClient webSocket;
bool isConnected = false;
unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 20000;

String getMacID() {
    String mac = WiFi.macAddress();
    mac.replace(":", "");
    return mac;
}

// =====================================================
// MJPEG SERVER CONSTANTS
// =====================================================
httpd_handle_t stream_httpd = NULL;
#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// =====================================================
// CAMERA PINS (AI THINKER)
// =====================================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// =====================================================
// CAMERA STREAM HANDLER
// =====================================================
static esp_err_t stream_handler(httpd_req_t *req) {
    camera_fb_t * fb = NULL;
    esp_err_t res = ESP_OK;
    size_t jpg_buf_len = 0;
    uint8_t * jpg_buf = NULL;
    char part_buf[64];

    res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
    if(res != ESP_OK) return res;

    while(true) {
        fb = esp_camera_fb_get();
        if (!fb) {
            Serial.println("[CAM] Capture failed");
            res = ESP_FAIL;
        } else {
            jpg_buf_len = fb->len;
            jpg_buf = fb->buf;
        }

        if(res == ESP_OK) {
            size_t hlen = snprintf(part_buf, sizeof(part_buf), _STREAM_PART, jpg_buf_len);
            res = httpd_resp_send_chunk(req, part_buf, hlen);
        }
        if(res == ESP_OK) {
            res = httpd_resp_send_chunk(req, (const char *)jpg_buf, jpg_buf_len);
        }
        if(res == ESP_OK) {
            res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
        }
        if(fb) {
            esp_camera_fb_return(fb);
            fb = NULL;
            jpg_buf = NULL;
        }
        if(res != ESP_OK) break;
    }
    return res;
}

void startCameraServer() {
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = 81;
    config.ctrl_port = 32768;

    httpd_uri_t stream_uri = {
        .uri = "/stream",
        .method = HTTP_GET,
        .handler = stream_handler,
        .user_ctx = NULL
    };

    Serial.println("[HTTP] Starting MJPEG server...");
    if (httpd_start(&stream_httpd, &config) == ESP_OK) {
        httpd_register_uri_handler(stream_httpd, &stream_uri);
        Serial.println("[HTTP] MJPEG stream ready");
    } else {
        Serial.println("[HTTP] Failed to start server");
    }
}

// =====================================================
// REGISTER WITH BACKEND
// =====================================================
void registerWithBackend() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    HTTPClient http;
    http.begin(backend_url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(api_key));

    String macId = getMacID();
    String stream_url = "http://" + WiFi.localIP().toString() + ":81/stream";

    String payload =
        String("{") +
        "\"agent_id\":\"" + macId + "\"," +
        "\"master_id\":\"" + String(master_id) + "\"," +
        "\"hardware_type\":\"ESP32-CAM\"," +
        "\"stream_url\":\"" + stream_url + "\"," +
        "\"capabilities\":{\"video\":true,\"audio\":false,\"fixed\":true}" +
        "}";

    int code = http.POST(payload);
    Serial.printf("[REST] Registration (%s): %d\n", macId.c_str(), code);
    http.end();
}

// =====================================================
// WEBSOCKET EVENTS
// =====================================================
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            isConnected = false;
            Serial.printf("[WS] Disconnected ❌ (%s)\n", payload ? (char*)payload : "no reason");
            break;

        case WStype_CONNECTED:
        {
            isConnected = true;
            Serial.printf("[WS] Connected ✅: %s\n", payload);

            String macId = getMacID();
            String stream_url = "http://" + WiFi.localIP().toString() + ":81/stream";

            String handshake =
                String("{") +
                "\"type\":\"HANDSHAKE\"," +
                "\"agent_id\":\"" + macId + "\"," +
                "\"mode\":\"HARDWARE\"," +
                "\"hardware_type\":\"ESP32-CAM\"," +
                "\"stream_url\":\"" + stream_url + "\"," +
                "\"capabilities\":{\"video\":true,\"audio\":false,\"fixed\":true}" +
                "}";

            webSocket.sendTXT(handshake);
            Serial.println("[WS] Handshake sent: " + handshake);
            break;
        }

        case WStype_TEXT:
        {
            Serial.printf("[WS] MSG: %s\n", payload);
            if (strstr((char*)payload, "REBOOT")) {
                Serial.println("[SYS] Rebooting...");
                ESP.restart();
            }
            if (strstr((char*)payload, "FLIP")) {
                sensor_t * s = esp_camera_sensor_get();
                if (s) s->set_hmirror(s, !s->status.hmirror);
            }
            break;
        }

        case WStype_ERROR:
            Serial.printf("[WS] ERROR: %s\n", payload ? (char*)payload : "unknown");
            break;

        case WStype_PING:
            Serial.println("[WS] PING");
            break;

        case WStype_PONG:
            Serial.println("[WS] PONG");
            break;
    }
}

// =====================================================
// SETUP CAMERA
// =====================================================
void setupCamera() {
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;
    config.pin_sscb_sda = SIOD_GPIO_NUM;
    config.pin_sscb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 10000000; // Safer clock for clones (10MHz)
    config.pixel_format = PIXFORMAT_JPEG;

    // Detect PSRAM for best quality
    if(psramFound()) {
        Serial.println("[CAM] PSRAM found - Using VGA");
        config.frame_size = FRAMESIZE_VGA;
        config.jpeg_quality = 12;
        config.fb_count = 2;
    } else {
        Serial.println("[CAM] PSRAM NOT found - Using QVGA");
        config.frame_size = FRAMESIZE_QVGA;
        config.jpeg_quality = 15;
        config.fb_count = 1;
    }

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CAM] Init failed: 0x%x\n", err);
        delay(5000);
        ESP.restart();
    }
    Serial.println("[CAM] Camera initialized successfully");
}

// =====================================================
// SETUP
// =====================================================
void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n=== NISHA RECOVERY STARTING ===");

    WiFi.disconnect(true);
    delay(100);
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);

    Serial.print("[WiFi] Connecting");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.printf("\n[WiFi] Connected - IP: %s\n", WiFi.localIP().toString().c_str());

    configTime(0, 0, "pool.ntp.org");
    Serial.println("[NTP] Syncing time...");
    time_t now = time(nullptr);
    while (now < 100000) {
        delay(500);
        now = time(nullptr);
    }
    Serial.println("[NTP] Time synced");

    setupCamera();
    startCameraServer();
    registerWithBackend();

    Serial.printf("[WS] Connecting to wss://%s:%d%s\n", ws_host, ws_port, ws_path);
    webSocket.beginSSL(ws_host, ws_port, ws_path);
    
    String authHeader = "Bearer " + String(api_key);
    webSocket.setExtraHeaders(("Origin: https://m01ws.buildwave.pro\r\nAuthorization: " + authHeader).c_str());
    
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(3000);
    webSocket.enableHeartbeat(15000, 3000, 2);
}

// =====================================================
// LOOP
// =====================================================
void loop() {
    webSocket.loop();
    if (isConnected) {
        if (millis() - lastHeartbeat > heartbeatInterval) {
            lastHeartbeat = millis();
            String heartbeat = "{\"type\":\"HEARTBEAT\",\"agent_id\":\"" + getMacID() + "\"}";
            webSocket.sendTXT(heartbeat);
            Serial.println("[WS] Heartbeat sent");
        }
    }
    delay(1);
}