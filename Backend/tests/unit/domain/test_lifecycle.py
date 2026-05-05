"""Tests for Agent lifecycle state machine."""

import pytest

from nisha.domain.models.enums import AgentStatus
from nisha.domain.services.lifecycle import (
    InvalidTransitionError,
    can_transition,
    evaluate_heartbeat_status,
    get_valid_transitions,
    validate_transition,
)


class TestStateTransitions:
    def test_new_to_active_allowed(self):
        assert can_transition(AgentStatus.NEW, AgentStatus.ACTIVE) is True

    def test_new_to_offline_denied(self):
        assert can_transition(AgentStatus.NEW, AgentStatus.OFFLINE) is False

    def test_active_to_degraded_allowed(self):
        assert can_transition(AgentStatus.ACTIVE, AgentStatus.DEGRADED) is True

    def test_active_to_offline_allowed(self):
        assert can_transition(AgentStatus.ACTIVE, AgentStatus.OFFLINE) is True

    def test_active_to_tampered_allowed(self):
        assert can_transition(AgentStatus.ACTIVE, AgentStatus.TAMPERED) is True

    def test_active_to_maintenance_allowed(self):
        assert can_transition(AgentStatus.ACTIVE, AgentStatus.MAINTENANCE) is True

    def test_degraded_to_active_recovery(self):
        assert can_transition(AgentStatus.DEGRADED, AgentStatus.ACTIVE) is True

    def test_degraded_to_offline_escalation(self):
        assert can_transition(AgentStatus.DEGRADED, AgentStatus.OFFLINE) is True

    def test_offline_to_active_recovery(self):
        assert can_transition(AgentStatus.OFFLINE, AgentStatus.ACTIVE) is True

    def test_tampered_only_to_maintenance(self):
        valid = get_valid_transitions(AgentStatus.TAMPERED)
        assert valid == {AgentStatus.MAINTENANCE}

    def test_maintenance_to_active(self):
        assert can_transition(AgentStatus.MAINTENANCE, AgentStatus.ACTIVE) is True

    def test_maintenance_to_new_factory_reset(self):
        assert can_transition(AgentStatus.MAINTENANCE, AgentStatus.NEW) is True

    def test_validate_raises_on_invalid(self):
        with pytest.raises(InvalidTransitionError) as exc_info:
            validate_transition(AgentStatus.NEW, AgentStatus.OFFLINE)
        assert exc_info.value.from_state == AgentStatus.NEW
        assert exc_info.value.to_state == AgentStatus.OFFLINE

    def test_validate_passes_on_valid(self):
        validate_transition(AgentStatus.NEW, AgentStatus.ACTIVE)  # should not raise

    def test_active_to_new_denied(self):
        assert can_transition(AgentStatus.ACTIVE, AgentStatus.NEW) is False

    def test_offline_to_degraded_denied(self):
        assert can_transition(AgentStatus.OFFLINE, AgentStatus.DEGRADED) is False


class TestHeartbeatStatusEvaluation:
    def test_zero_missed_returns_active(self):
        result = evaluate_heartbeat_status(AgentStatus.ACTIVE, missed_count=0)
        assert result == AgentStatus.ACTIVE

    def test_one_missed_returns_degraded(self):
        result = evaluate_heartbeat_status(AgentStatus.ACTIVE, missed_count=1)
        assert result == AgentStatus.DEGRADED

    def test_two_missed_returns_degraded(self):
        result = evaluate_heartbeat_status(AgentStatus.ACTIVE, missed_count=2)
        assert result == AgentStatus.DEGRADED

    def test_three_missed_returns_offline(self):
        result = evaluate_heartbeat_status(AgentStatus.ACTIVE, missed_count=3)
        assert result == AgentStatus.OFFLINE

    def test_five_missed_returns_offline(self):
        result = evaluate_heartbeat_status(AgentStatus.ACTIVE, missed_count=5)
        assert result == AgentStatus.OFFLINE

    def test_tampered_ignored_regardless_of_heartbeat(self):
        result = evaluate_heartbeat_status(AgentStatus.TAMPERED, missed_count=10)
        assert result == AgentStatus.TAMPERED

    def test_maintenance_ignored(self):
        result = evaluate_heartbeat_status(AgentStatus.MAINTENANCE, missed_count=5)
        assert result == AgentStatus.MAINTENANCE

    def test_new_ignored(self):
        result = evaluate_heartbeat_status(AgentStatus.NEW, missed_count=3)
        assert result == AgentStatus.NEW

    def test_recovery_from_degraded(self):
        result = evaluate_heartbeat_status(AgentStatus.DEGRADED, missed_count=0)
        assert result == AgentStatus.ACTIVE
