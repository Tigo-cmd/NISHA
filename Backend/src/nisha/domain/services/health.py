"""Health threshold evaluation.

Evaluates agent metrics against PRD-defined thresholds.
Pure domain logic -- no infrastructure dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass

from nisha.domain.models.agent import AgentMetrics
from nisha.domain.models.enums import HealthLevel


@dataclass(frozen=True)
class ThresholdResult:
    metric: str
    level: HealthLevel
    value: float
    message: str


@dataclass(frozen=True)
class HealthReport:
    agent_id: str
    overall: HealthLevel
    checks: list[ThresholdResult]

    @property
    def has_warnings(self) -> bool:
        return any(c.level == HealthLevel.WARNING for c in self.checks)

    @property
    def has_critical(self) -> bool:
        return any(c.level == HealthLevel.CRITICAL for c in self.checks)


def _check_battery(level: int) -> ThresholdResult:
    if level < 10:
        return ThresholdResult("battery_level", HealthLevel.CRITICAL, level, "Battery critical — low power mode required")
    elif level < 20:
        return ThresholdResult("battery_level", HealthLevel.WARNING, level, "Battery low")
    return ThresholdResult("battery_level", HealthLevel.NORMAL, level, "Battery OK")


def _check_signal(strength: int) -> ThresholdResult:
    if strength < -95:
        return ThresholdResult("signal_strength", HealthLevel.CRITICAL, strength, "Signal critical — consider handoff")
    elif strength < -85:
        return ThresholdResult("signal_strength", HealthLevel.WARNING, strength, "Signal weak")
    return ThresholdResult("signal_strength", HealthLevel.NORMAL, strength, "Signal OK")


def _check_temperature(temp_c: float) -> ThresholdResult:
    if temp_c > 85:
        return ThresholdResult("temperature_c", HealthLevel.CRITICAL, temp_c, "Temperature critical — thermal throttling")
    elif temp_c > 70:
        return ThresholdResult("temperature_c", HealthLevel.WARNING, temp_c, "Temperature elevated")
    return ThresholdResult("temperature_c", HealthLevel.NORMAL, temp_c, "Temperature OK")


def _check_heap(free_bytes: int) -> ThresholdResult:
    kb = free_bytes / 1024
    if kb < 10:
        return ThresholdResult("free_heap_bytes", HealthLevel.CRITICAL, free_bytes, "Heap critical — restart required")
    elif kb < 30:
        return ThresholdResult("free_heap_bytes", HealthLevel.WARNING, free_bytes, "Heap low")
    return ThresholdResult("free_heap_bytes", HealthLevel.NORMAL, free_bytes, "Heap OK")


def evaluate_health(agent_id: str, metrics: AgentMetrics) -> HealthReport:
    checks = [
        _check_battery(metrics.battery_level),
        _check_signal(metrics.signal_strength),
        _check_temperature(metrics.temperature_c),
        _check_heap(metrics.free_heap_bytes),
    ]

    if any(c.level == HealthLevel.CRITICAL for c in checks):
        overall = HealthLevel.CRITICAL
    elif any(c.level == HealthLevel.WARNING for c in checks):
        overall = HealthLevel.WARNING
    else:
        overall = HealthLevel.NORMAL

    return HealthReport(agent_id=agent_id, overall=overall, checks=checks)
