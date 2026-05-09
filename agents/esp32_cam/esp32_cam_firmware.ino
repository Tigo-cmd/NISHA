/*
 * NISHA Sentinel - ESP32-CAM Fixed Node Firmware
 * This sketch sets up a stable MJPEG webserver for NISHA Master ingestion.
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include "esp_http_server.h"

// --- CONFIGURATION ---
const char* ssid = "CLICKNETWORKS";
const char* password = "hotguy112345";

// Master Node Details (mDNS)
const char* master_ws_host = "nisha-master.local";
const int master_ws_port = 8082;
const char* backend_url = "https://api.buildwave.pro/api/v1/agents";
const char* api_key = "nisha_master_key_2024_secure";
const char* master_id = "MASTER_001";
const char* agent_name = "ACAM-SENTINEL-01";

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

httpd_handle_t stream_httpd = NULL;

// Function to register this agent with the NISHA Backend
void registerWithBackend() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(backend_url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(api_key));

    String ip = WiFi.localIP().toString();
    String mac = WiFi.macAddress();
    mac.replace(":", ""); // Standardize MAC ID

    String payload = "{";
    payload += "\"agent_id\": \"" + mac + "\",";
    payload += "\"master_id\": \"" + String(master_id) + "\",";
    payload += "\"hardware_type\": \"ESP32-CAM\",";
    payload += "\"firmware_version\": \"1.0.0\",";
    payload += "\"stream_url\": \"http://" + ip + ":81/stream\",";
    payload += "\"capabilities\": {\"video\": true, \"audio\": false, \"fixed\": true}";
    payload += "}";

    int httpResponseCode = http.POST(payload);
    
    if (httpResponseCode > 0) {
      Serial.print("Registration Successful: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("Registration Failed: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }
}

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

// Stream Handler
static esp_err_t stream_handler(httpd_req_t *req){
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char * part_buf[64];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if(res != ESP_OK){ return res; }

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
    if(res != ESP_OK){ break; }
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

WebSocketsClient webSocket;
bool isWSConnected = false;
unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 60000; // 60 seconds
unsigned long lastWSHeartbeat = 0;
const unsigned long wsHeartbeatInterval = 10000; // 10 seconds for Master link

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from Master ❌");
      isWSConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.printf("[WS] Connected to Master ✅ at %s\n", payload);
      isWSConnected = true;
      
      // Handshake with ID and Stream URL
      String mac = WiFi.macAddress();
      mac.replace(":", "");
      String ip = WiFi.localIP().toString();
      
      String handshake = "{\"type\":\"HANDSHAKE\",\"agent_id\":\"" + mac + "\",\"mode\":\"HARDWARE\",\"stream_url\":\"http://" + ip + ":81/stream\"}";
      webSocket.sendTXT(handshake);
      break;
    case WStype_TEXT:
      Serial.printf("[WS] Message from Master: %s\n", payload);
      break;
  }
}

void setup() {
  Serial.begin(115200);
  
  // Print ID (MAC)
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  Serial.printf("\n=== NISHA Cam Node: %s ===\n", mac.c_str());

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
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  // WiFi Init
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  
  // Initialize WebSocket connection to Master
  webSocket.begin(master_ws_host, master_ws_port, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  registerWithBackend();
  startCameraServer();
  lastHeartbeat = millis();
}

void loop() {
  webSocket.loop();
  
  // Periodic Heartbeat to Backend (Direct)
  if (millis() - lastHeartbeat > heartbeatInterval) {
    registerWithBackend();
    lastHeartbeat = millis();
  }

  // Periodic Heartbeat to Master (via WS)
  if (isWSConnected && (millis() - lastWSHeartbeat > wsHeartbeatInterval)) {
    String mac = WiFi.macAddress();
    mac.replace(":", "");
    webSocket.sendTXT("{\"type\":\"HEARTBEAT\",\"agent_id\":\"" + mac + "\"}");
    lastWSHeartbeat = millis();
  }
  delay(1);
}
