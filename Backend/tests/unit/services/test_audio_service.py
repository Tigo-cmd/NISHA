"""Unit tests for AudioService."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone
import uuid

from nisha.domain.models.enums import AudioEventType, AudioPriority
from nisha.services.audio_service import AudioService
from nisha.domain.models.audio import AudioEvent


@pytest.fixture
def mock_audio_repo():
    return AsyncMock()


@pytest.fixture
def mock_agent_repo():
    repo = AsyncMock()
    # Mock an agent
    agent = MagicMock()
    agent.agent_id = "A4CF12001122"
    agent.location_zone = "Main Lobby"
    repo.get_by_id.return_value = agent
    return repo


@pytest.fixture
def mock_event_bus():
    return AsyncMock()


@pytest.fixture
def audio_service(mock_audio_repo, mock_agent_repo, mock_event_bus):
    return AudioService(mock_audio_repo, mock_agent_repo, mock_event_bus)


@pytest.mark.asyncio
async def test_process_audio_packet(audio_service, mock_audio_repo, mock_agent_repo, mock_event_bus):
    # Prepare test data
    agent_id = "A4CF12001122"
    timestamp = datetime.now(timezone.utc)
    priority = AudioPriority.CRITICAL
    detection_data = {
        "type": "HARMFUL_SOUND",
        "class": "gunshot",
        "confidence": 0.95,
        "features": {
            "spectral_centroid": 3500.0,
            "zero_crossing_rate": 0.15,
            "energy_db": -25.0
        }
    }

    # Mock save_event to return the event
    mock_audio_repo.save_event.side_effect = lambda e: e

    # Execute
    event = await audio_service.process_audio_packet(
        agent_id=agent_id,
        timestamp=timestamp,
        priority=priority,
        detection_data=detection_data
    )

    # Assertions
    assert event.agent_id == agent_id
    assert event.priority == priority
    assert event.detection.class_name == AudioEventType.GUNSHOT
    assert event.detection.confidence == 0.95
    assert event.location_zone == "Main Lobby"
    
    mock_audio_repo.save_event.assert_called_once()
    mock_agent_repo.record_event.assert_called_once()
    mock_event_bus.publish.assert_called_once()


@pytest.mark.asyncio
async def test_confirm_event(audio_service, mock_audio_repo):
    event_id = str(uuid.uuid4())
    mock_audio_repo.update_event_status.return_value = True

    result = await audio_service.confirm_event(event_id, True)

    assert result is True
    mock_audio_repo.update_event_status.assert_called_once_with(event_id, True)
