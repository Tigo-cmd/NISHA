"""Multi-Agent Event Correlation Engine."""

import time
import math
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

@dataclass
class DetectionEvent:
    agent_id: str
    behavior: str
    confidence: float
    timestamp: float
    lat: Optional[float] = None
    lng: Optional[float] = None

@dataclass
class CorrelatedEvent:
    event_id: str
    behavior: str
    severity: str
    agents: List[str]
    start_time: float
    last_update: float
    avg_confidence: float
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None

class CorrelationEngine:
    """Correlates detections across multiple agents within spatio-temporal windows."""
    
    def __init__(self, time_window_seconds: int = 30, distance_threshold_km: float = 0.1):
        self.time_window = time_window_seconds
        self.distance_threshold = distance_threshold_km
        self._recent_detections: List[DetectionEvent] = []
        self._active_events: List[CorrelatedEvent] = []

    def add_detection(self, agent_id: str, behavior: str, confidence: float, lat: Optional[float] = None, lng: Optional[float] = None) -> Optional[CorrelatedEvent]:
        """Add a new detection and return a correlated event if grouping occurs."""
        now = time.time()
        new_det = DetectionEvent(
            agent_id=agent_id,
            behavior=behavior,
            confidence=confidence,
            timestamp=now,
            lat=lat,
            lng=lng
        )
        
        self._recent_detections.append(new_det)
        self._cleanup(now)
        
        return self._correlate(new_det)

    def _cleanup(self, now: float):
        """Remove old detections and events outside the window."""
        self._recent_detections = [d for d in self._recent_detections if now - d.timestamp < self.time_window]
        self._active_events = [e for e in self._active_events if now - e.last_update < self.time_window * 2]

    def _correlate(self, detection: DetectionEvent) -> Optional[CorrelatedEvent]:
        """Try to find an existing event to join, or create a new one if multiple agents see the same thing."""
        # Only correlate "Violence" or harmful behaviors
        if detection.behavior == "NonViolence":
            return None

        # Look for active events with same behavior
        for event in self._active_events:
            if event.behavior == detection.behavior:
                spatial_match = True
                if event.center_lat and detection.lat:
                    dist = self._haversine(event.center_lat, event.center_lng, detection.lat, detection.lng)
                    if dist > self.distance_threshold:
                        spatial_match = False
                
                if spatial_match:
                    self._update_event(event, detection)
                    return event

        # Look for other agents' detections to start a new correlated event
        nearby_detections = [
            d for d in self._recent_detections 
            if d.agent_id != detection.agent_id and d.behavior == detection.behavior
        ]
        
        if nearby_detections:
            # Start a new correlated event
            import uuid
            new_event = CorrelatedEvent(
                event_id=str(uuid.uuid4()),
                behavior=detection.behavior,
                severity="HIGH" if len(nearby_detections) > 1 else "MEDIUM",
                agents=[detection.agent_id] + [d.agent_id for d in nearby_detections],
                start_time=min(d.timestamp for d in nearby_detections + [detection]),
                last_update=detection.timestamp,
                avg_confidence=(detection.confidence + sum(d.confidence for d in nearby_detections)) / (len(nearby_detections) + 1),
                center_lat=detection.lat,
                center_lng=detection.lng
            )
            self._active_events.append(new_event)
            return new_event
            
        return None

    def _update_event(self, event: CorrelatedEvent, detection: DetectionEvent):
        """Update an existing event with new detection data."""
        if detection.agent_id not in event.agents:
            event.agents.append(detection.agent_id)
        
        event.last_update = detection.timestamp
        # Simple moving average for confidence
        event.avg_confidence = (event.avg_confidence * 0.7) + (detection.confidence * 0.3)
        
        # Increase severity if multiple agents are involved
        if len(event.agents) >= 3:
            event.severity = "CRITICAL"
        elif len(event.agents) >= 2:
            event.severity = "HIGH"

    def _haversine(self, lat1, lon1, lat2, lon2) -> float:
        """Calculate the great-circle distance between two points in km."""
        R = 6371.0  # Radius of the Earth in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) * math.sin(dlat / 2) +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) * math.sin(dlon / 2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
