"""Configuration version domain entity."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class ConfigVersion:
    version_id: str
    agent_id: str
    config_hash: str
    config_data: dict[str, Any]
    version_number: int = 1
    change_type: str = "FULL_REPLACE"  # DELTA_PATCH | FULL_REPLACE
    changed_keys: list[str] = field(default_factory=list)
    previous_version_id: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    applied_at: datetime | None = None
    rolled_back: bool = False


def compute_config_hash(config: dict[str, Any]) -> str:
    serialized = json.dumps(config, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()[:16]


def compute_delta(old_config: dict[str, Any], new_config: dict[str, Any]) -> dict[str, Any]:
    """Compute a JSON merge-style delta between two configs.

    Returns only the keys that changed, with their new values.
    Deleted keys are set to None.
    """
    delta: dict[str, Any] = {}
    all_keys = set(old_config.keys()) | set(new_config.keys())

    for key in all_keys:
        old_val = old_config.get(key)
        new_val = new_config.get(key)

        if key not in new_config:
            delta[key] = None  # Deleted
        elif key not in old_config:
            delta[key] = new_val  # Added
        elif old_val != new_val:
            if isinstance(old_val, dict) and isinstance(new_val, dict):
                nested = compute_delta(old_val, new_val)
                if nested:
                    delta[key] = nested
            else:
                delta[key] = new_val  # Changed

    return delta


def apply_delta(base_config: dict[str, Any], delta: dict[str, Any]) -> dict[str, Any]:
    """Apply a delta patch to a base config."""
    result = dict(base_config)

    for key, value in delta.items():
        if value is None:
            result.pop(key, None)  # Delete
        elif isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = apply_delta(result[key], value)
        else:
            result[key] = value

    return result
