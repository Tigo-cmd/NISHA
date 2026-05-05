"""Tests for handoff protocol domain logic."""

import pytest

from nisha.domain.models.handoff import Handoff, HandoffOffer, HandoffStatus


class TestHandoffEntity:
    def test_new_handoff_is_probing(self):
        h = Handoff(
            handoff_id="h-001",
            agent_id="A-001",
            from_master_id="M-001",
        )
        assert h.status == HandoffStatus.PROBING
        assert h.to_master_id is None
        assert not h.is_terminal

    def test_completed_is_terminal(self):
        h = Handoff(
            handoff_id="h-001",
            agent_id="A-001",
            from_master_id="M-001",
            status=HandoffStatus.COMPLETED,
        )
        assert h.is_terminal

    def test_failed_is_terminal(self):
        h = Handoff(
            handoff_id="h-001",
            agent_id="A-001",
            from_master_id="M-001",
            status=HandoffStatus.FAILED,
        )
        assert h.is_terminal

    def test_rolled_back_is_terminal(self):
        h = Handoff(
            handoff_id="h-001",
            agent_id="A-001",
            from_master_id="M-001",
            status=HandoffStatus.ROLLED_BACK,
        )
        assert h.is_terminal

    def test_transferring_is_not_terminal(self):
        h = Handoff(
            handoff_id="h-001",
            agent_id="A-001",
            from_master_id="M-001",
            status=HandoffStatus.TRANSFERRING,
        )
        assert not h.is_terminal

    def test_duration_none_when_not_completed(self):
        h = Handoff(handoff_id="h-001", agent_id="A-001", from_master_id="M-001")
        assert h.duration_seconds is None

    def test_duration_calculated_when_completed(self):
        from datetime import datetime, timezone, timedelta

        start = datetime(2026, 4, 18, 10, 0, 0, tzinfo=timezone.utc)
        end = start + timedelta(seconds=25)
        h = Handoff(
            handoff_id="h-001",
            agent_id="A-001",
            from_master_id="M-001",
            started_at=start,
            completed_at=end,
        )
        assert h.duration_seconds == 25.0
