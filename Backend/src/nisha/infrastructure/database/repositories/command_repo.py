"""Command repository implementation using SQLAlchemy."""

from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nisha.domain.models.command import Command
from nisha.domain.models.enums import CommandStatus
from nisha.domain.ports.command_repository import CommandRepository
from nisha.infrastructure.database.models import CommandModel


def _model_to_domain(row: CommandModel) -> Command:
    return Command(
        cmd_id=row.cmd_id,
        agent_id=row.agent_id,
        command_type=row.command_type,
        priority=row.priority,
        status=row.status,
        params=row.params,
        requires_ack=row.requires_ack,
        max_retries=row.max_retries,
        retry_count=row.retry_count,
        issued_by=row.issued_by,
        issued_at=row.issued_at,
        dispatched_at=row.dispatched_at,
        completed_at=row.completed_at,
        result=row.result,
        error=row.error,
    )


def _domain_to_dict(cmd: Command) -> dict:
    return {
        "cmd_id": cmd.cmd_id,
        "agent_id": cmd.agent_id,
        "command_type": cmd.command_type,
        "priority": cmd.priority,
        "status": cmd.status,
        "params": cmd.params,
        "requires_ack": cmd.requires_ack,
        "max_retries": cmd.max_retries,
        "retry_count": cmd.retry_count,
        "issued_by": cmd.issued_by,
        "issued_at": cmd.issued_at,
        "dispatched_at": cmd.dispatched_at,
        "completed_at": cmd.completed_at,
        "result": cmd.result,
        "error": cmd.error,
    }


class SqlAlchemyCommandRepository(CommandRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, cmd_id: str) -> Command | None:
        result = await self._session.get(CommandModel, cmd_id)
        return _model_to_domain(result) if result else None

    async def create(self, command: Command) -> Command:
        data = _domain_to_dict(command)
        model = CommandModel(**data)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return _model_to_domain(model)

    async def update(self, command: Command) -> Command:
        model = await self._session.get(CommandModel, command.cmd_id)
        if not model:
            raise ValueError(f"Command {command.cmd_id} not found")
        data = _domain_to_dict(command)
        for key, value in data.items():
            setattr(model, key, value)
        await self._session.flush()
        await self._session.refresh(model)
        return _model_to_domain(model)

    async def get_pending_commands(self, agent_id: str) -> Sequence[Command]:
        stmt = (
            select(CommandModel)
            .where(
                CommandModel.agent_id == agent_id,
                CommandModel.status.in_([CommandStatus.PENDING, CommandStatus.DISPATCHED]),
            )
            .order_by(
                CommandModel.priority.desc(),
                CommandModel.issued_at.asc(),
            )
        )
        result = await self._session.execute(stmt)
        return [_model_to_domain(m) for m in result.scalars()]
