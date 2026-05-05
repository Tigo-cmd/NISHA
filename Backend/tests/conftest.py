"""Shared test fixtures."""

import pytest
from nisha.domain.models.agent import Agent, AgentMetrics
from nisha.domain.models.master import Master


@pytest.fixture
def sample_agent() -> Agent:
    return Agent(
        agent_id="A4CF12001122",
        short_id="A-001",
        status="ACTIVE",
        master_id="M-001",
        capabilities={"audio": True, "video": True},
        config={"sensors": {"audio": {"enabled": True}}},
        location_zone="perimeter_north",
        firmware_version="1.0.0",
    )


@pytest.fixture
def sample_master() -> Master:
    return Master(
        master_id="M-001",
        name="Master North",
        ip_address="192.168.1.10",
        max_agents=50,
        current_agent_count=10,
        status="ONLINE",
        location_zone="perimeter_north",
    )


@pytest.fixture
def healthy_metrics() -> AgentMetrics:
    return AgentMetrics(
        battery_level=85,
        signal_strength=-55,
        temperature_c=35.0,
        free_heap_bytes=50000,
        cpu_usage_percent=20,
    )


@pytest.fixture
def critical_metrics() -> AgentMetrics:
    return AgentMetrics(
        battery_level=5,
        signal_strength=-98,
        temperature_c=90.0,
        free_heap_bytes=5000,
        cpu_usage_percent=95,
    )
