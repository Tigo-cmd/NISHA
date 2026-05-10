/*
 * NISHA Sentinel - ESP32-CAM Fixed Node Firmware
 * This sketch sets up a stable MJPEG webserver for NISHA Master ingestion.
 * Connection logic synchronized with NISHA Audio Node (Cloudflare WSS).
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include "esp_http_server.h"
#include <time.h>

// --- CONFIGURATION ---
const char* ssid = "CLICKNETWORKS";
const char* password = "hotguy112345";

// Cloudflare WebSocket endpoint (Matches Audio Node)
const char* ws_host = "m01ws.buildwave.pro"; // No "wss://"
const int ws_port = 443;
const char* ws_path = "/";

const char* backend_url = "http://api.buildwave.pro/api/v1/agents";
const char* api_key = "nisha_master_key_2024_secure";
const char* master_id = "MASTER_001";
const char* agent_name = "ACAM-SENTINEL-01";

// --- STATE ---
WebSocketsClient webSocket;
bool isWSConnected = false;
unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 60000; // Backend REST
unsigned long lastWSHeartbeat = 0;
const unsigned long wsHeartbeatInterval = 20000; // Master WS

httpd_handle_t stream_httpd = NULL;

// Camera Pin Mapping (AI-Thinker)
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

// ---------------- BACKEND ----------------
void registerWithBackend() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(backend_url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(api_key));

    String ip = WiFi.localIP().toString();
    String mac = WiFi.macAddress();
    mac.replace(":", "");

    String payload = "{";
    payload += "\"agent_id\": \"" + mac + "\",";
    payload += "\"master_id\": \"" + String(master_id) + "\",";
    payload += "\"hardware_type\": \"ESP32-CAM\",";
    payload += "\"firmware_version\": \"1.1.0\",";
    payload += "\"stream_url\": \"http://" + ip + ":81/stream\",";
    payload += "\"capabilities\": {\"video\": true, \"audio\": false, \"fixed\": true}";
    payload += "}";

    int code = http.POST(payload);
    Serial.printf("[REST] Registration: %d\n", code);
    http.end();
  }
}

// ---------------- WEBSOCKET EVENT ----------------
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected ❌");
      isWSConnected = false;
      break;

    case WStype_CONNECTED:
    {
      Serial.printf("[WS] Connected to Cloudflare ✅: %s\n", payload);
      isWSConnected = true;
      
      String mac = WiFi.macAddress();
      mac.replace(":", "");
      String ip = WiFi.localIP().toString();
      
      // Handshake using mode HARDWARE for MJPEG routing
      String handshake = "{\"type\":\"HANDSHAKE\",\"agent_id\":\"" + mac + "\",\"mode\":\"HARDWARE\",\"stream_url\":\"http://" + ip + ":81/stream\"}";
      webSocket.sendTXT(handshake);
      break;
    }

    case WStype_TEXT:
      Serial.printf("[WS] MSG: %s\n", payload);
      break;
      
    case WStype_ERROR:
      Serial.printf("[WS] ERROR: %s\n", payload ? (char*)payload : "unknown");
      break;
  }
}

// ---------------- MJPEG SERVER ----------------
#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

static esp_err_t stream_handler(httpd_req_t *req){
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char * part_buf[64];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if(res != ESP_OK) return res;

  while(true){
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      res = ESP_FAIL;
    } else {
      _jpg_buf_len = fb->len;
      _jpg_buf = fb->buf;
    }
    
    if(res == ESP_OK){
      size_t hlen = snprintf((char *)part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, (const char *)part_buf, hlen);
    }
    if(res == ESP_OK){
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }
    if(res == ESP_OK){
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }
    if(fb){
      esp_camera_fb_return(fb);
      fb = NULL;
      _jpg_buf = NULL;
    } else if(res == ESP_OK){
      break;
    }
    if(res != ESP_OK) break;
  }
  return res;
}

void startCameraServer(){
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 81;

  httpd_uri_t index_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };
  
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &index_uri);
  }
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  Serial.printf("\n=== NISHA Cam Node: %s ===\n", mac.c_str());

  // Camera Config
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
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  if(psramFound()){
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // Camera Init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return;
  }

  // WiFi Init (Robust sequence for ESP32-CAM)
  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(agent_name);
  WiFi.begin(ssid, password);
  
  Serial.print("Connecting to WiFi");
  int wifi_retry = 0;
  while (WiFi.status() != WL_CONNECTED && wifi_retry < 40) {
    delay(500);
    Serial.print(".");
    wifi_retry++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s, RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    WiFi.setSleep(false); // Critical for MJPEG stability
  } else {
    Serial.println("\n[WiFi] Connection Failed. Rebooting...");
    ESP.restart();
  }

  // Sync Time (Required for WSS)
  configTime(0, 0, "pool.ntp.org");
  time_t now = time(nullptr);
  while (now < 100000) {
    delay(500);
    now = time(nullptr);
  }
  Serial.println("Time synced");
  
  // --- WebSocket Connection (Matches Audio Node Production Config) ---
  Serial.printf("[WS] Connecting to wss://%s:%d%s\n", ws_host, ws_port, ws_path);
  webSocket.beginSSL(ws_host, ws_port, ws_path);
  webSocket.setExtraHeaders("Origin: https://m01ws.buildwave.pro");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);
  
  // Standard stability pings
  webSocket.enableHeartbeat(15000, 3000, 2);

  registerWithBackend();
  startCameraServer();
  lastHeartbeat = millis();
  lastWSHeartbeat = millis();
}

// ---------------- LOOP ----------------
void loop() {
  webSocket.loop();
  
  // Periodic Heartbeat to Backend (Direct REST)
  if (millis() - lastHeartbeat > heartbeatInterval) {
    registerWithBackend();
    lastHeartbeat = millis();
  }

  // Periodic JSON Heartbeat to Master (Application Level)
  if (isWSConnected && (millis() - lastWSHeartbeat > wsHeartbeatInterval)) {
    String mac = WiFi.macAddress();
    mac.replace(":", "");
    webSocket.sendTXT("{\"type\":\"HEARTBEAT\",\"agent_id\":\"" + mac + "\"}");
    lastWSHeartbeat = millis();
  }
  
  delay(1);
}
