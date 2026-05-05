"""Master repository implementation using SQLAlchemy."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from nisha.domain.models.master import Master, MeshRoute
from nisha.domain.ports.master_repository import MasterRepository
from nisha.infrastructure.database.models import MasterModel, MeshRouteModel


def _model_to_domain(row: MasterModel) -> Master:
    return Master(
        master_id=row.master_id,
        name=row.name,
        ip_address=str(row.ip_address) if row.ip_address else None,
        max_agents=row.max_agents,
        current_agent_count=row.current_agent_count,
        status=row.status,
        location_zone=row.location_zone,
        gps_lat=float(row.gps_lat) if row.gps_lat is not None else None,
        gps_lng=float(row.gps_lng) if row.gps_lng is not None else None,
        mesh_neighbors=row.mesh_neighbors or [],
        last_seen=row.last_seen,
        created_at=row.created_at,
    )


def _route_to_domain(row: MeshRouteModel) -> MeshRoute:
    return MeshRoute(
        source_node=row.source_node,
        target_node=row.target_node,
        next_hop=row.next_hop,
        hop_count=row.hop_count,
        signal_strength=row.signal_strength or -40,
        last_updated=row.last_updated,
        active=row.active,
    )


class SqlAlchemyMasterRepository(MasterRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, master_id: str) -> Master | None:
        result = await self._session.get(MasterModel, master_id)
        return _model_to_domain(result) if result else None

    async def list_all(
        self,
        *,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Master]:
        stmt = select(MasterModel)
        if status:
            stmt = stmt.where(MasterModel.status == status)
        stmt = stmt.offset(offset).limit(limit).order_by(MasterModel.master_id)
        result = await self._session.execute(stmt)
        return [_model_to_domain(row) for row in result.scalars()]

    async def create(self, master: Master) -> Master:
        model = MasterModel(
            master_id=master.master_id,
            name=master.name,
            ip_address=master.ip_address,
            max_agents=master.max_agents,
            current_agent_count=master.current_agent_count,
            status=master.status,
            location_zone=master.location_zone,
            gps_lat=master.gps_lat,
            gps_lng=master.gps_lng,
            mesh_neighbors=master.mesh_neighbors,
            last_seen=master.last_seen,
        )
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return _model_to_domain(model)

    async def update(self, master: Master) -> Master:
        model = await self._session.get(MasterModel, master.master_id)
        if not model:
            raise ValueError(f"Master {master.master_id} not found")
        model.name = master.name
        model.ip_address = master.ip_address
        model.max_agents = master.max_agents
        model.current_agent_count = master.current_agent_count
        model.status = master.status
        model.location_zone = master.location_zone
        model.gps_lat = master.gps_lat
        model.gps_lng = master.gps_lng
        model.mesh_neighbors = master.mesh_neighbors
        model.last_seen = master.last_seen
        await self._session.flush()
        await self._session.refresh(model)
        return _model_to_domain(model)

    async def delete(self, master_id: str) -> bool:
        model = await self._session.get(MasterModel, master_id)
        if not model:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    async def increment_agent_count(self, master_id: str, delta: int = 1) -> None:
        stmt = (
            update(MasterModel)
            .where(MasterModel.master_id == master_id)
            .values(current_agent_count=MasterModel.current_agent_count + delta)
        )
        await self._session.execute(stmt)
        await self._session.flush()

    async def get_mesh_routes(
        self,
        *,
        source_node: str | None = None,
        active_only: bool = True,
    ) -> list[MeshRoute]:
        stmt = select(MeshRouteModel)
        if source_node:
            stmt = stmt.where(MeshRouteModel.source_node == source_node)
        if active_only:
            stmt = stmt.where(MeshRouteModel.active.is_(True))
        result = await self._session.execute(stmt)
        return [_route_to_domain(row) for row in result.scalars()]

    async def upsert_mesh_route(self, route: MeshRoute) -> None:
        stmt = select(MeshRouteModel).where(
            MeshRouteModel.source_node == route.source_node,
            MeshRouteModel.target_node == route.target_node,
        )
        result = await self._session.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            existing.next_hop = route.next_hop
            existing.hop_count = route.hop_count
            existing.signal_strength = route.signal_strength
            existing.last_updated = datetime.now(timezone.utc)
            existing.active = route.active
        else:
            model = MeshRouteModel(
                source_node=route.source_node,
                target_node=route.target_node,
                next_hop=route.next_hop,
                hop_count=route.hop_count,
                signal_strength=route.signal_strength,
                active=route.active,
            )
            self._session.add(model)
        await self._session.flush()
