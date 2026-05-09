/home/tigo/Arduino/Smart_Waste_sorting/Smart_Waste_sorting.ino: In function 'void webSocketEvent(WStype_t, uint8_t*, size_t)':
/home/tigo/Arduino/Smart_Waste_sorting/Smart_Waste_sorting.ino:167:10: error: jump to case label
  167 |     case WStype_TEXT:
      |          ^~~~~~~~~~~
/home/tigo/Arduino/Smart_Waste_sorting/Smart_Waste_sorting.ino:164:14: note:   crosses initialization of 'String handshake'
  164 |       String handshake = "{\"type\":\"HANDSHAKE\",\"agent_id\":\"" + mac + "\",\"mode\":\"HARDWARE\",\"stream_url\":\"http://" + ip + ":81/stream\"}";
      |              ^~~~~~~~~
/home/tigo/Arduino/Smart_Waste_sorting/Smart_Waste_sorting.ino:162:14: note:   crosses initialization of 'String ip'
  162 |       String ip = WiFi.localIP().toString();
      |              ^~
/home/tigo/Arduino/Smart_Waste_sorting/Smart_Waste_sorting.ino:160:14: note:   crosses initialization of 'String mac'
  160 |       String mac = WiFi.macAddress();
      |              ^~~
exit status 1

Compilation error: jump to case label