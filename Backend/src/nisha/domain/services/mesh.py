"""Mesh routing domain logic.

Handles route calculation, handoff evaluation, and topology decisions.
Pure domain logic -- no infrastructure dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass

from nisha.domain.models.master import MeshRoute


HANDOFF_SIGNAL_THRESHOLD = -75  # dBm, sustained 30s triggers handoff
HANDOFF_IMPROVEMENT_MARGIN = 15  # dB, alternative must be this much better
MIN_SIGNAL_STRENGTH = -80  # dBm, minimum for master selection


@dataclass(frozen=True)
class HandoffDecision:
    should_handoff: bool
    current_master: str
    target_master: str | None
    reason: str
    current_signal: int
    target_signal: int | None


@dataclass(frozen=True)
class HandoffCandidate:
    master_id: str
    signal_strength: int
    has_capacity: bool


def evaluate_handoff(
    agent_id: str,
    current_master_id: str,
    current_signal: int,
    candidates: list[HandoffCandidate],
) -> HandoffDecision:
    """Evaluate whether an agent should hand off to a different master."""
    if current_signal >= HANDOFF_SIGNAL_THRESHOLD:
        return HandoffDecision(
            should_handoff=False,
            current_master=current_master_id,
            target_master=None,
            reason="Current signal strength is acceptable",
            current_signal=current_signal,
            target_signal=None,
        )

    viable = [
        c for c in candidates
        if c.master_id != current_master_id
        and c.has_capacity
        and c.signal_strength > current_signal + HANDOFF_IMPROVEMENT_MARGIN
    ]

    if not viable:
        return HandoffDecision(
            should_handoff=False,
            current_master=current_master_id,
            target_master=None,
            reason="No viable alternative master found",
            current_signal=current_signal,
            target_signal=None,
        )

    best = max(viable, key=lambda c: c.signal_strength)

    return HandoffDecision(
        should_handoff=True,
        current_master=current_master_id,
        target_master=best.master_id,
        reason=f"Signal degraded ({current_signal} dBm), better option available ({best.signal_strength} dBm)",
        current_signal=current_signal,
        target_signal=best.signal_strength,
    )


def select_best_route(routes: list[MeshRoute]) -> MeshRoute | None:
    active_routes = [r for r in routes if r.active]
    if not active_routes:
        return None
    return min(active_routes, key=lambda r: (r.hop_count, -r.signal_strength))
