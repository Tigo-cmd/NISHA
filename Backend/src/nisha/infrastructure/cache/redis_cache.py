"""Redis cache adapter implementing the Cache port."""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis

from nisha.domain.ports.cache import Cache


class RedisCache(Cache):
    def __init__(self, client: aioredis.Redis) -> None:
        self._client = client

    async def get(self, key: str) -> Any | None:
        value = await self._client.get(key)
        if value is None:
            return None
        return value.decode() if isinstance(value, bytes) else value

    async def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        if ttl_seconds:
            await self._client.setex(key, ttl_seconds, str(value))
        else:
            await self._client.set(key, str(value))

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def exists(self, key: str) -> bool:
        return bool(await self._client.exists(key))

    async def get_json(self, key: str) -> dict | None:
        value = await self._client.get(key)
        if value is None:
            return None
        raw = value.decode() if isinstance(value, bytes) else value
        return json.loads(raw)

    async def set_json(self, key: str, value: dict, ttl_seconds: int | None = None) -> None:
        serialized = json.dumps(value, default=str)
        if ttl_seconds:
            await self._client.setex(key, ttl_seconds, serialized)
        else:
            await self._client.set(key, serialized)

    async def increment(self, key: str) -> int:
        return await self._client.incr(key)

    async def set_hash(self, key: str, mapping: dict[str, Any]) -> None:
        str_mapping = {k: json.dumps(v, default=str) if not isinstance(v, str) else v for k, v in mapping.items()}
        await self._client.hset(key, mapping=str_mapping)

    async def get_hash(self, key: str) -> dict[str, Any]:
        raw = await self._client.hgetall(key)
        result: dict[str, Any] = {}
        for k, v in raw.items():
            key_str = k.decode() if isinstance(k, bytes) else k
            val_str = v.decode() if isinstance(v, bytes) else v
            try:
                result[key_str] = json.loads(val_str)
            except (json.JSONDecodeError, TypeError):
                result[key_str] = val_str
        return result
