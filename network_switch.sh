#!/bin/bash

# NISHA Network Switcher
# Switch between LOCAL (LAN) and TUNNEL (Cloudflare) modes across all components.

MODE=$1
BACKEND_IP="192.168.1.190"  # Update this to your laptop's IP
MASTER_IP="192.168.1.231"    # Update this to your Raspberry Pi's IP

if [[ "$MODE" != "local" && "$MODE" != "tunnel" ]]; then
    echo "Usage: ./network_switch.sh [local|tunnel]"
    exit 1
fi

echo "Switching NISHA network to: ${MODE^^} mode..."

# 1. Update Master (.env)
if [ -f "masters/.env" ]; then
    sed -i "s/NISHA_NETWORK_MODE=.*/NISHA_NETWORK_MODE=${MODE^^}/" masters/.env
    sed -i "s/NISHA_BACKEND_IP=.*/NISHA_BACKEND_IP=$BACKEND_IP/" masters/.env
    echo "[✓] Local Master configuration updated."
    
    # Push to Pi
    echo "Pushing configuration to Raspberry Pi..."
    scp -r masters/.env pi@$MASTER_IP:/home/pi/Nisha_master/masters/src/nisha_master/.env
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
    sed -i "s/NEXT_PUBLIC_NETWORK_MODE=.*/NEXT_PUBLIC_NETWORK_MODE=${MODE^^}/" Frontend/.env.local
    sed -i "s/NEXT_PUBLIC_BACKEND_IP=.*/NEXT_PUBLIC_BACKEND_IP=$BACKEND_IP/" Frontend/.env.local
    echo "[✓] Frontend configuration updated."
fi

# 4. Update Mobile Agent (.env)
if [ -f "mobile-agent/frontend/.env" ]; then
    if [ "$MODE" == "local" ]; then
        WS_URL="ws://$MASTER_IP:8082"
    else
        WS_URL="wss://m01ws.buildwave.pro"
    fi
    sed -i "s|EXPO_PUBLIC_MASTER_WS_URL=.*|EXPO_PUBLIC_MASTER_WS_URL=$WS_URL|" mobile-agent/frontend/.env
    echo "[✓] Mobile Agent configuration updated."
fi

echo "------------------------------------------------"
echo "Done! Remember to RESTART your services for changes to take effect."
if [ "$MODE" == "local" ]; then
    echo "Current Local Path: Pi -> $BACKEND_IP (Laptop)"
else
    echo "Current Tunnel Path: Pi -> Cloudflare -> Laptop"
fi
