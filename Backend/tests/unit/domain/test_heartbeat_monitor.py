"""Tests for heartbeat monitor evaluation logic."""

import pytest
from datetime import datetime, timezone, timedelta

from nisha.domain.models.agent import Agent
from nisha.domain.models.enums import AgentStatus
from nisha.domain.services.lifecycle import evaluate_heartbeat_status


class TestHeartbeatMonitorLogic:
    """Test the evaluation logic used by the heartbeat monitor."""

    def test_active_agent_zero_missed(self):
        result = evaluate_heartbeat_status(AgentStatus.ACTIVE, 0)
        assert result == AgentStatus.ACTIVE

    def test_active_agent_one_missed_becomes_degraded(self):
        result = evaluate_heartbeat_status(AgentStatus.ACTIVE, 1)
        assert result == AgentStatus.DEGRADED

    def test_active_agent_three_missed_becomes_offline(self):
        result = evaluate_heartbeat_status(AgentStatus.ACTIVE, 3)
        assert result == AgentStatus.OFFLINE

    def test_degraded_agent_recovery(self):
        result = evaluate_heartbeat_status(AgentStatus.DEGRADED, 0)
        assert result == AgentStatus.ACTIVE

    def test_degraded_agent_escalation(self):
        result = evaluate_heartbeat_status(AgentStatus.DEGRADED, 3)
        assert result == AgentStatus.OFFLINE

    def test_tampered_agent_unchanged(self):
        result = evaluate_heartbeat_status(AgentStatus.TAMPERED, 10)
        assert result == AgentStatus.TAMPERED

    def test_maintenance_agent_unchanged(self):
        result = evaluate_heartbeat_status(AgentStatus.MAINTENANCE, 5)
        assert result == AgentStatus.MAINTENANCE

    def test_missed_count_boundary_two(self):
        result = evaluate_heartbeat_status(AgentStatus.ACTIVE, 2)
        assert result == AgentStatus.DEGRADED

    def test_missed_count_high(self):
        result = evaluate_heartbeat_status(AgentStatus.ACTIVE, 100)
        assert result == AgentStatus.OFFLINE


class TestAgentMissedHeartbeats:
    def test_no_heartbeat_returns_zero(self):
        agent = Agent(agent_id="test", short_id="A-001", last_heartbeat=None)
        assert agent.missed_heartbeats == 0

    def test_recent_heartbeat_returns_zero(self):
        agent = Agent(
            agent_id="test",
            short_id="A-001",
            last_heartbeat=datetime.now(timezone.utc) - timedelta(seconds=10),
        )
        assert agent.missed_heartbeats == 0

    def test_one_interval_missed(self):
        agent = Agent(
            agent_id="test",
            short_id="A-001",
            last_heartbeat=datetime.now(timezone.utc) - timedelta(seconds=45),
        )
        assert agent.missed_heartbeats == 1

    def test_three_intervals_missed(self):
        agent = Agent(
            agent_id="test",
            short_id="A-001",
            last_heartbeat=datetime.now(timezone.utc) - timedelta(seconds=95),
        )
        assert agent.missed_heartbeats == 3
