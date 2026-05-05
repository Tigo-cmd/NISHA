"""Alert Generator service to convert detections and correlations into alerts."""

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import uuid

from nisha.domain.models.enums import EventType
from nisha.domain.ports.event_bus import EventBus
from .correlation_engine import CorrelatedEvent

logger = logging.getLogger(__name__)

class AlertGenerator:
    """Processes correlated events and generates high-level alerts."""
    
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus

    async def generate_from_correlation(self, event: CorrelatedEvent):
        """Generate a system alert from a correlated event."""
        alert_id = str(uuid.uuid4())
        
        alert_payload = {
            "alert_id": alert_id,
            "type": "MULTI_AGENT_ALERT",
            "behavior": event.behavior,
            "severity": event.severity,
            "agents": event.agents,
            "confidence": event.avg_confidence,
            "location": {
                "lat": event.center_lat,
                "lng": event.center_lng
            },
            "timestamp": datetime.fromtimestamp(event.last_update, tz=timezone.utc).isoformat()
        }
        
        logger.warning(f"ALERT GENERATED: {event.severity} {event.behavior} involving {len(event.agents)} agents")
        
        # Publish to event bus for dispatchers (Telegram, WS, DB)
        await self.event_bus.publish({
            "type": EventType.ALERT,
            "data": alert_payload
        })
        
        return alert_payload

    async def generate_single_agent_alert(self, agent_id: str, behavior: str, confidence: float, priority: str):
        """Generate an alert for a high-confidence single agent detection."""
        if confidence < 0.85: # Require higher threshold for single agent to avoid noise
            return None
            
        alert_id = str(uuid.uuid4())
        alert_payload = {
            "alert_id": alert_id,
            "type": "SINGLE_AGENT_ALERT",
            "agent_id": agent_id,
            "behavior": behavior,
            "severity": priority,
            "confidence": confidence,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.event_bus.publish({
            "type": EventType.ALERT,
            "data": alert_payload
        })
        
        return alert_payload
