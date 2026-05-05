"""Configuration management service.

Handles config versioning, delta patch generation, distribution, and rollback
per PRD Section 7:

- Delta Patch: Config version mismatch → JSON merge → Previous version kept
- Full Replace: Major version change → Complete download → Automatic backup
- Hash-based change detection via heartbeat ACK config_hash field
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from nisha.domain.events.agent_events import ConfigUpdated
from nisha.domain.models.config import (
    ConfigVersion,
    apply_delta,
    compute_config_hash,
    compute_delta,
)
from nisha.domain.ports.agent_repository import AgentRepository
from nisha.domain.ports.cache import Cache
from nisha.domain.ports.event_bus import EventBus


class ConfigService:
    def __init__(
        self,
        agent_repo: AgentRepository,
        cache: Cache,
        event_bus: EventBus,
    ) -> None:
        self._agents = agent_repo
        self._cache = cache
        self._events = event_bus

    async def get_config_hash(self, agent_id: str) -> str | None:
        """Get the current config hash for an agent (used in heartbeat ACK)."""
        cached = await self._cache.get(f"config:{agent_id}:hash")
        if cached:
            return cached

        agent = await self._agents.get_by_id(agent_id)
        if not agent:
            return None

        config_hash = compute_config_hash(agent.config)
        await self._cache.set(f"config:{agent_id}:hash", config_hash, ttl_seconds=300)
        return config_hash

    async def update_config(
        self,
        agent_id: str,
        new_config: dict[str, Any],
        force_full_replace: bool = False,
    ) -> ConfigVersion:
        """Update agent config with automatic delta detection."""
        agent = await self._agents.get_by_id(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        old_config = agent.config
        old_hash = compute_config_hash(old_config)
        new_hash = compute_config_hash(new_config)

        if old_hash == new_hash:
            raise ValueError("No configuration changes detected")

        # Determine change type
        delta = compute_delta(old_config, new_config)
        changed_keys = list(delta.keys())

        if force_full_replace or len(changed_keys) > len(new_config) // 2:
            change_type = "FULL_REPLACE"
            config_data = new_config
        else:
            change_type = "DELTA_PATCH"
            config_data = delta

        # Get current version number
        version_key = f"config:{agent_id}:version"
        cached_version = await self._cache.get(version_key)
        version_number = int(cached_version) + 1 if cached_version else 1

        # Create version record
        version = ConfigVersion(
            version_id=str(uuid.uuid4()),
            agent_id=agent_id,
            config_hash=new_hash,
            config_data=config_data,
            version_number=version_number,
            change_type=change_type,
            changed_keys=changed_keys,
            previous_version_id=old_hash,
        )

        # Store previous config for rollback
        await self._cache.set_json(
            f"config:{agent_id}:backup:{old_hash}",
            old_config,
            ttl_seconds=86400,  # Keep for 24 hours
        )

        # Apply new config
        if change_type == "DELTA_PATCH":
            final_config = apply_delta(old_config, delta)
        else:
            final_config = new_config

        agent.config = final_config
        agent.updated_at = datetime.now(timezone.utc)
        await self._agents.update(agent)

        # Update cache
        await self._cache.set(f"config:{agent_id}:hash", new_hash, ttl_seconds=300)
        await self._cache.set(version_key, str(version_number), ttl_seconds=86400)

        # Record event
        await self._agents.record_event(
            agent_id,
            "config_update",
            {
                "version_id": version.version_id,
                "version_number": version_number,
                "change_type": change_type,
                "changed_keys": changed_keys,
                "old_hash": old_hash,
                "new_hash": new_hash,
            },
        )

        await self._events.publish(
            ConfigUpdated(
                event_id=str(uuid.uuid4()),
                agent_id=agent_id,
                config_version=new_hash,
                changed_keys=changed_keys,
            )
        )

        version.applied_at = datetime.now(timezone.utc)
        return version

    async def rollback_config(self, agent_id: str, target_hash: str) -> dict[str, Any]:
        """Rollback agent config to a previous version by hash."""
        backup = await self._cache.get_json(f"config:{agent_id}:backup:{target_hash}")
        if not backup:
            raise ValueError(f"No backup found for config hash {target_hash}")

        agent = await self._agents.get_by_id(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        agent.config = backup
        agent.updated_at = datetime.now(timezone.utc)
        await self._agents.update(agent)

        new_hash = compute_config_hash(backup)
        await self._cache.set(f"config:{agent_id}:hash", new_hash, ttl_seconds=300)

        await self._agents.record_event(
            agent_id,
            "config_update",
            {
                "change_type": "ROLLBACK",
                "target_hash": target_hash,
                "new_hash": new_hash,
            },
        )

        return backup

    async def check_config_sync(self, agent_id: str, reported_hash: str) -> dict[str, Any]:
        """Check if agent's reported config hash matches server.

        Called during heartbeat processing to detect config drift.
        Returns sync status and pending config if out of sync.
        """
        agent = await self._agents.get_by_id(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        server_hash = compute_config_hash(agent.config)

        if server_hash == reported_hash:
            return {"in_sync": True, "config_hash": server_hash}

        return {
            "in_sync": False,
            "server_hash": server_hash,
            "agent_hash": reported_hash,
            "pending_config": agent.config,
        }

    async def batch_update_config(
        self,
        agent_ids: list[str],
        config_patch: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Apply a config patch to multiple agents at once."""
        results = []
        for agent_id in agent_ids:
            try:
                agent = await self._agents.get_by_id(agent_id)
                if not agent:
                    results.append({"agent_id": agent_id, "status": "not_found"})
                    continue

                merged = {**agent.config, **config_patch}
                version = await self.update_config(agent_id, merged)
                results.append({
                    "agent_id": agent_id,
                    "status": "updated",
                    "version": version.version_number,
                    "hash": version.config_hash,
                })
            except Exception as exc:
                results.append({"agent_id": agent_id, "status": "error", "error": str(exc)})

        return results
