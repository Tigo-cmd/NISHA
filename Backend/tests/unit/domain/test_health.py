"""Tests for health threshold evaluation."""

import pytest

from nisha.domain.models.agent import AgentMetrics
from nisha.domain.models.enums import HealthLevel
from nisha.domain.services.health import evaluate_health


class TestHealthEvaluation:
    def test_all_normal(self, healthy_metrics: AgentMetrics):
        report = evaluate_health("A-001", healthy_metrics)
        assert report.overall == HealthLevel.NORMAL
        assert not report.has_warnings
        assert not report.has_critical

    def test_all_critical(self, critical_metrics: AgentMetrics):
        report = evaluate_health("A-001", critical_metrics)
        assert report.overall == HealthLevel.CRITICAL
        assert report.has_critical

    def test_battery_warning(self):
        metrics = AgentMetrics(battery_level=15)
        report = evaluate_health("A-001", metrics)
        assert report.has_warnings
        battery_check = next(c for c in report.checks if c.metric == "battery_level")
        assert battery_check.level == HealthLevel.WARNING

    def test_battery_critical(self):
        metrics = AgentMetrics(battery_level=5)
        report = evaluate_health("A-001", metrics)
        battery_check = next(c for c in report.checks if c.metric == "battery_level")
        assert battery_check.level == HealthLevel.CRITICAL

    def test_signal_warning(self):
        metrics = AgentMetrics(signal_strength=-90)
        report = evaluate_health("A-001", metrics)
        signal_check = next(c for c in report.checks if c.metric == "signal_strength")
        assert signal_check.level == HealthLevel.WARNING

    def test_signal_critical(self):
        metrics = AgentMetrics(signal_strength=-100)
        report = evaluate_health("A-001", metrics)
        signal_check = next(c for c in report.checks if c.metric == "signal_strength")
        assert signal_check.level == HealthLevel.CRITICAL

    def test_temperature_warning(self):
        metrics = AgentMetrics(temperature_c=75.0)
        report = evaluate_health("A-001", metrics)
        temp_check = next(c for c in report.checks if c.metric == "temperature_c")
        assert temp_check.level == HealthLevel.WARNING

    def test_temperature_critical(self):
        metrics = AgentMetrics(temperature_c=90.0)
        report = evaluate_health("A-001", metrics)
        temp_check = next(c for c in report.checks if c.metric == "temperature_c")
        assert temp_check.level == HealthLevel.CRITICAL

    def test_heap_warning(self):
        metrics = AgentMetrics(free_heap_bytes=20000)  # ~20KB
        report = evaluate_health("A-001", metrics)
        heap_check = next(c for c in report.checks if c.metric == "free_heap_bytes")
        assert heap_check.level == HealthLevel.WARNING

    def test_heap_critical(self):
        metrics = AgentMetrics(free_heap_bytes=5000)  # ~5KB
        report = evaluate_health("A-001", metrics)
        heap_check = next(c for c in report.checks if c.metric == "free_heap_bytes")
        assert heap_check.level == HealthLevel.CRITICAL

    def test_mixed_levels_worst_wins(self):
        metrics = AgentMetrics(battery_level=15, signal_strength=-100)
        report = evaluate_health("A-001", metrics)
        assert report.overall == HealthLevel.CRITICAL
        assert report.has_warnings
        assert report.has_critical

    def test_report_always_has_four_checks(self):
        metrics = AgentMetrics()
        report = evaluate_health("A-001", metrics)
        assert len(report.checks) == 4
