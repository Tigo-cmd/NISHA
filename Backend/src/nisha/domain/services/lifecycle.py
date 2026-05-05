"""Agent lifecycle state machine.

Enforces valid state transitions as defined in the PRD.
Pure domain logic -- no infrastructure dependencies.
"""

from __future__ import annotations

from nisha.domain.models.enums import AgentStatus

# Valid state transitions: {from_state: {to_states}}
_TRANSITIONS: dict[AgentStatus, set[AgentStatus]] = {
    AgentStatus.NEW: {AgentStatus.ACTIVE},
    AgentStatus.ACTIVE: {
        AgentStatus.DEGRADED,
        AgentStatus.OFFLINE,
        AgentStatus.TAMPERED,
        AgentStatus.MAINTENANCE,
    },
    AgentStatus.DEGRADED: {
        AgentStatus.ACTIVE,
        AgentStatus.OFFLINE,
        AgentStatus.TAMPERED,
        AgentStatus.MAINTENANCE,
    },
    AgentStatus.OFFLINE: {
        AgentStatus.ACTIVE,
        AgentStatus.TAMPERED,
        AgentStatus.MAINTENANCE,
    },
    AgentStatus.TAMPERED: {
        AgentStatus.MAINTENANCE,
    },
    AgentStatus.MAINTENANCE: {
        AgentStatus.ACTIVE,
        AgentStatus.NEW,  # Factory reset
    },
}


class InvalidTransitionError(Exception):
    def __init__(self, from_state: AgentStatus, to_state: AgentStatus) -> None:
        self.from_state = from_state
        self.to_state = to_state
        super().__init__(
            f"Invalid state transition: {from_state.value} -> {to_state.value}"
        )


def can_transition(from_state: AgentStatus, to_state: AgentStatus) -> bool:
    allowed = _TRANSITIONS.get(from_state, set())
    return to_state in allowed


def validate_transition(from_state: AgentStatus, to_state: AgentStatus) -> None:
    if not can_transition(from_state, to_state):
        raise InvalidTransitionError(from_state, to_state)


def get_valid_transitions(state: AgentStatus) -> set[AgentStatus]:
    return _TRANSITIONS.get(state, set()).copy()


def evaluate_heartbeat_status(
    current_status: AgentStatus,
    missed_count: int,
) -> AgentStatus:
    """Determine agent status based on missed heartbeat count.

    Per PRD:
    - 1 missed: DEGRADED
    - 2 missed: DEGRADED (with direct ping attempt)
    - 3+ missed: OFFLINE
    - 0 missed (recovery): ACTIVE
    """
    if current_status in (AgentStatus.TAMPERED, AgentStatus.MAINTENANCE, AgentStatus.NEW):
        return current_status

    if missed_count == 0:
        return AgentStatus.ACTIVE
    elif missed_count < 3:
        return AgentStatus.DEGRADED
    else:
        return AgentStatus.OFFLINE
