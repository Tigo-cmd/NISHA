"""Tests for mesh routing and handoff logic."""

import pytest

from nisha.domain.models.master import MeshRoute
from nisha.domain.services.mesh import evaluate_handoff, select_best_route, HandoffCandidate


class TestHandoffEvaluation:
    def test_strong_signal_no_handoff(self):
        decision = evaluate_handoff(
            agent_id="A-001",
            current_master_id="M-001",
            current_signal=-50,
            candidates=[
                HandoffCandidate(master_id="M-002", signal_strength=-40, has_capacity=True),
            ],
        )
        assert decision.should_handoff is False
        assert decision.target_master is None

    def test_weak_signal_with_better_candidate(self):
        decision = evaluate_handoff(
            agent_id="A-001",
            current_master_id="M-001",
            current_signal=-85,
            candidates=[
                HandoffCandidate(master_id="M-002", signal_strength=-45, has_capacity=True),
                HandoffCandidate(master_id="M-003", signal_strength=-60, has_capacity=True),
            ],
        )
        assert decision.should_handoff is True
        assert decision.target_master == "M-002"  # strongest signal

    def test_weak_signal_no_capacity(self):
        decision = evaluate_handoff(
            agent_id="A-001",
            current_master_id="M-001",
            current_signal=-85,
            candidates=[
                HandoffCandidate(master_id="M-002", signal_strength=-45, has_capacity=False),
            ],
        )
        assert decision.should_handoff is False

    def test_weak_signal_improvement_below_margin(self):
        decision = evaluate_handoff(
            agent_id="A-001",
            current_master_id="M-001",
            current_signal=-80,
            candidates=[
                HandoffCandidate(master_id="M-002", signal_strength=-70, has_capacity=True),
            ],
        )
        # -70 - (-80) = 10 dB improvement, but margin is 15 dB
        assert decision.should_handoff is False

    def test_excludes_current_master_from_candidates(self):
        decision = evaluate_handoff(
            agent_id="A-001",
            current_master_id="M-001",
            current_signal=-85,
            candidates=[
                HandoffCandidate(master_id="M-001", signal_strength=-40, has_capacity=True),
            ],
        )
        assert decision.should_handoff is False

    def test_no_candidates_no_handoff(self):
        decision = evaluate_handoff(
            agent_id="A-001",
            current_master_id="M-001",
            current_signal=-90,
            candidates=[],
        )
        assert decision.should_handoff is False


class TestRouteSelection:
    def test_select_shortest_route(self):
        routes = [
            MeshRoute(source_node="A-001", target_node="Server", hop_count=3, signal_strength=-60),
            MeshRoute(source_node="A-001", target_node="Server", hop_count=1, signal_strength=-70),
            MeshRoute(source_node="A-001", target_node="Server", hop_count=2, signal_strength=-50),
        ]
        best = select_best_route(routes)
        assert best is not None
        assert best.hop_count == 1

    def test_select_strongest_signal_on_tie(self):
        routes = [
            MeshRoute(source_node="A-001", target_node="Server", hop_count=1, signal_strength=-70),
            MeshRoute(source_node="A-001", target_node="Server", hop_count=1, signal_strength=-50),
        ]
        best = select_best_route(routes)
        assert best is not None
        assert best.signal_strength == -50

    def test_inactive_routes_excluded(self):
        routes = [
            MeshRoute(source_node="A-001", target_node="Server", hop_count=1, signal_strength=-40, active=False),
            MeshRoute(source_node="A-001", target_node="Server", hop_count=3, signal_strength=-70, active=True),
        ]
        best = select_best_route(routes)
        assert best is not None
        assert best.hop_count == 3

    def test_no_active_routes_returns_none(self):
        routes = [
            MeshRoute(source_node="A-001", target_node="Server", hop_count=1, active=False),
        ]
        best = select_best_route(routes)
        assert best is None

    def test_empty_routes_returns_none(self):
        best = select_best_route([])
        assert best is None
