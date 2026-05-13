#!/bin/bash

# NISHA Network Switcher
# Switch between LOCAL (LAN) and TUNNEL (Cloudflare) modes across all components.

MODE=$1
BACKEND_IP="10.222.39.213"  # Update this to your laptop's IP
MASTER_IP="10.222.39.176"    # Update this to your Raspberry Pi's IP

if [[ "$MODE" != "local" && "$MODE" != "tunnel" ]]; then
    echo "Usage: ./network_switch.sh [local|tunnel]"
    exit 1
fi

echo "Switching NISHA network to: ${MODE^^} mode..."

# 1. Update Master (.env)
if [ -f "masters/.env" ]; then
    # Delete existing entry and append new one to be 100% sure
    sed -i '/NISHA_NETWORK_MODE/d' masters/.env
    echo "NISHA_NETWORK_MODE=${MODE^^}" >> masters/.env
    
    sed -i '/NISHA_BACKEND_IP/d' masters/.env
    echo "NISHA_BACKEND_IP=$BACKEND_IP" >> masters/.env
    
    echo "[✓] Local Master configuration updated."
    
    # Push to Pi
    echo "Pushing configuration and AI processor to Raspberry Pi..."
    # Ensure the remote directories exist first
    ssh pi@$MASTER_IP "mkdir -p /home/pi/Nisha_master/masters /home/pi/Nisha_master/ai/audio_processor"
    
    # Push .env to where config.py is
    scp masters/.env pi@$MASTER_IP:/home/pi/Nisha_master/masters/src/nisha_master/.env
    
    # Also sync the processor logic so VAD sensitivity matches
    rsync -avz ai/audio_processor/processor.py pi@$MASTER_IP:/home/pi/Nisha_master/ai/audio_processor/processor.py
    
    if [ $? -eq 0 ]; then
        echo "[✓] Raspberry Pi configuration synced successfully."
    else
        echo "[✗] Failed to sync to Raspberry Pi. Check your connection/SSH."
    fi
fi

# 2. Update Backend (.env)
if [ -f "Backend/.env" ]; then
    # Add mode if not exists, otherwise update
    if grep -q "NISHA_NETWORK_MODE" Backend/.env; then
        sed -i "s/NISHA_NETWORK_MODE=.*/NISHA_NETWORK_MODE=${MODE^^}/" Backend/.env
    else
        echo "NISHA_NETWORK_MODE=${MODE^^}" >> Backend/.env
    fi
    echo "[✓] Backend configuration updated."
fi

# 3. Update Frontend (.env.local)
if [ -f "Frontend/.env.local" ]; then
    sed -i '/NEXT_PUBLIC_NETWORK_MODE/d' Frontend/.env.local
    echo "NEXT_PUBLIC_NETWORK_MODE=${MODE^^}" >> Frontend/.env.local
    
    sed -i '/NEXT_PUBLIC_BACKEND_IP/d' Frontend/.env.local
    echo "NEXT_PUBLIC_BACKEND_IP=$BACKEND_IP" >> Frontend/.env.local
    
    echo "[✓] Frontend configuration updated."
fi

# 4. Update Mobile Agent (.env)
if [ -f "mobile-agent/frontend/.env" ]; then
    if [ "$MODE" == "local" ]; then
        WS_URL="ws://$MASTER_IP:8082"
    else
        WS_URL="wss://m01ws.buildwave.pro"
    fi
    sed -i '/EXPO_PUBLIC_MASTER_WS_URL/d' mobile-agent/frontend/.env
    echo "EXPO_PUBLIC_MASTER_WS_URL=$WS_URL" >> mobile-agent/frontend/.env
    echo "[✓] Mobile Agent configuration updated."
fi

echo "------------------------------------------------"
echo "Done! Remember to RESTART your services for changes to take effect."
if [ "$MODE" == "local" ]; then
    echo "Current Local Path: Pi -> $BACKEND_IP (Laptop)"
else
    echo "Current Tunnel Path: Pi -> Cloudflare -> Laptop"
fi
