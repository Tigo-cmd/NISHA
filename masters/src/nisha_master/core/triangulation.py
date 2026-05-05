"""Triangulation Engine for Agent Localization.

Uses the Log-Distance Path Loss model to convert RSSI to distance,
and weighted centroid trilateration to estimate coordinates.
"""
import math
import logging
from typing import Dict, List, Tuple

import numpy as np

from nisha_master.config import settings

logger = logging.getLogger(__name__)


class TriangulationEngine:
    def __init__(self):
        self.reference_power = settings.rssi_reference_power
        self.path_loss_exp = settings.rssi_path_loss_exponent

        # Hardcoded master locations (in production, fetch from Backend)
        self.anchor_nodes: Dict[str, Tuple[float, float]] = {
            "MASTER_001": (34.0522, -118.2437),
            "MASTER_002": (34.0525, -118.2440),
            "MASTER_003": (34.0520, -118.2430),
        }

    def rssi_to_distance(self, rssi: float) -> float:
        """
        Convert RSSI to distance in meters using log-distance path loss.
        Formula: d = 10 ^ ((TxPower - RSSI) / (10 * n))
        """
        if rssi == 0:
            return -1.0 # Invalid

        ratio = (self.reference_power - rssi) / (10.0 * self.path_loss_exp)
        distance = math.pow(10, ratio)
        return distance

    def calculate_weighted_centroid(self, observations: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Calculates position based on multiple Master node RSSI observations of a single Agent.
        observations format: [{"anchor_id": "MASTER_001", "rssi": -65}, ...]
        """
        if len(observations) < 3:
            logger.debug("Not enough observations for trilateration (need 3+)")
            return {"lat": 0.0, "lng": 0.0, "confidence": 0.0}

        points = []
        weights = []

        for obs in observations:
            anchor_id = obs.get("anchor_id")
            if anchor_id not in self.anchor_nodes:
                continue

            dist = self.rssi_to_distance(obs["rssi"])
            if dist <= 0:
                continue

            anchor_pos = self.anchor_nodes[anchor_id]
            points.append(anchor_pos)

            # Weight is inversely proportional to distance (closer anchors are trusted more)
            weights.append(1.0 / max(dist, 0.1))

        if len(points) < 3:
            return {"lat": 0.0, "lng": 0.0, "confidence": 0.0}

        # Use NumPy for fast vectorized centroid calculation
        points_np = np.array(points)
        weights_np = np.array(weights)

        # Weighted average
        centroid = np.average(points_np, axis=0, weights=weights_np)

        # Simple confidence metric based on variance and signal strength
        avg_rssi = sum(o["rssi"] for o in observations) / len(observations)
        confidence = min(max((100 + avg_rssi) / 60.0, 0.0), 1.0) # Scale roughly 0 to 1

        return {
            "lat": float(centroid[0]),
            "lng": float(centroid[1]),
            "confidence": round(float(confidence), 3)
        }
