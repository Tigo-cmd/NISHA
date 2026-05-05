"""Command dispatch application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Sequence

from nisha.domain.events.agent_events import CommandCompleted, CommandDispatched
from nisha.domain.models.command import Command
from nisha.domain.models.enums import AgentStatus, CommandPriority, CommandStatus, CommandType
from nisha.domain.ports.agent_repository import AgentRepository
from nisha.domain.ports.command_repository import CommandRepository
from nisha.domain.ports.cache import Cache
from nisha.domain.ports.event_bus import EventBus


# Command metadata per PRD
_COMMAND_META: dict[str, dict] = {
    CommandType.REBOOT: {"priority": CommandPriority.HIGH, "requires_ack": True},
    CommandType.UPDATE_CONFIG: {"priority": CommandPriority.HIGH, "requires_ack": True},
    CommandType.START_RECORDING: {"priority": CommandPriority.MEDIUM, "requires_ack": False},
    CommandType.STOP_RECORDING: {"priority": CommandPriority.MEDIUM, "requires_ack": True},
    CommandType.CALIBRATE_SENSOR: {"priority": CommandPriority.MEDIUM, "requires_ack": True},
    CommandType.REQUEST_STATUS: {"priority": CommandPriority.LOW, "requires_ack": True},
}


class CommandService:
    def __init__(
        self,
        cmd_repo: CommandRepository,
        agent_repo: AgentRepository,
        cache: Cache,
        event_bus: EventBus,
    ) -> None:
        self._cmds = cmd_repo
        self._agents = agent_repo
        self._cache = cache
        self._events = event_bus

    async def dispatch_command(
        self,
        agent_id: str,
        command_type: str,
        params: dict[str, Any] | None = None,
        issued_by: str | None = None,
    ) -> Command:
        agent = await self._agents.get_by_id(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        if agent.status == AgentStatus.TAMPERED:
            raise ValueError(f"Agent {agent_id} is TAMPERED — manual inspection required")

        meta = _COMMAND_META.get(command_type, {"priority": CommandPriority.MEDIUM, "requires_ack": True})

        cmd = Command(
            cmd_id=str(uuid.uuid4()),
            agent_id=agent_id,
            command_type=command_type,
            priority=meta["priority"],
            status=CommandStatus.PENDING,
            params=params or {},
            requires_ack=meta["requires_ack"],
            issued_by=issued_by,
        )

        # If agent is offline, queue the command
        if agent.status == AgentStatus.OFFLINE:
            cmd.status = CommandStatus.PENDING
        else:
            cmd.status = CommandStatus.DISPATCHED
            cmd.dispatched_at = datetime.now(timezone.utc)

        cmd = await self._cmds.create(cmd)

        await self._events.publish(
            CommandDispatched(
                event_id=str(uuid.uuid4()),
                cmd_id=cmd.cmd_id,
                agent_id=agent_id,
                command_type=command_type,
                priority=cmd.priority,
            )
        )

        return cmd

    async def acknowledge_command(
        self,
        cmd_id: str,
        success: bool = True,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> Command:
        cmd = await self._cmds.get_by_id(cmd_id)
        if not cmd:
            raise ValueError(f"Command {cmd_id} not found")

        now = datetime.now(timezone.utc)
        cmd.status = CommandStatus.COMPLETED if success else CommandStatus.FAILED
        cmd.completed_at = now
        cmd.result = result
        cmd.error = error

        if not success and cmd.retry_count < cmd.max_retries:
            cmd.retry_count += 1
            cmd.status = CommandStatus.PENDING
            cmd.completed_at = None

        cmd = await self._cmds.update(cmd)

        await self._events.publish(
            CommandCompleted(
                event_id=str(uuid.uuid4()),
                cmd_id=cmd_id,
                agent_id=cmd.agent_id,
                success=success,
                result=result or {},
            )
        )

        return cmd

    async def get_pending_commands(self, agent_id: str) -> Sequence[Command]:
        return await self._cmds.get_pending_commands(agent_id)
