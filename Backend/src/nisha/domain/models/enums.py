"""Domain enums for the NISHA Agent Management System."""

from enum import StrEnum


class AgentStatus(StrEnum):
    NEW = "NEW"
    ACTIVE = "ACTIVE"
    DEGRADED = "DEGRADED"
    OFFLINE = "OFFLINE"
    TAMPERED = "TAMPERED"
    MAINTENANCE = "MAINTENANCE"


class MasterStatus(StrEnum):
    ONLINE = "ONLINE"
    DEGRADED = "DEGRADED"
    OFFLINE = "OFFLINE"
    MAINTENANCE = "MAINTENANCE"


class CommandType(StrEnum):
    REBOOT = "REBOOT"
    UPDATE_CONFIG = "UPDATE_CONFIG"
    START_RECORDING = "START_RECORDING"
    STOP_RECORDING = "STOP_RECORDING"
    CALIBRATE_SENSOR = "CALIBRATE_SENSOR"
    REQUEST_STATUS = "REQUEST_STATUS"


class CommandPriority(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class CommandStatus(StrEnum):
    PENDING = "PENDING"
    DISPATCHED = "DISPATCHED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


class EventType(StrEnum):
    HEARTBEAT = "heartbeat"
    STATE_CHANGE = "state_change"
    ALERT = "alert"
    HANDOFF = "handoff"
    REGISTRATION = "registration"
    COMMAND = "command"
    CONFIG_UPDATE = "config_update"


class MessageType(StrEnum):
    REGISTER_REQ = "REGISTER_REQ"
    REGISTER_ACK = "REGISTER_ACK"
    REGISTER_REDIRECT = "REGISTER_REDIRECT"
    HEARTBEAT = "HEARTBEAT"
    HEARTBEAT_ACK = "HEARTBEAT_ACK"
    HANDOFF_PROBE = "HANDOFF_PROBE"
    HANDOFF_OFFER = "HANDOFF_OFFER"
    HANDOFF_REQUEST = "HANDOFF_REQUEST"
    HANDOFF_CONFIRM = "HANDOFF_CONFIRM"
    COMMAND = "COMMAND"
    COMMAND_ACK = "COMMAND_ACK"
    ALERT = "ALERT"
    TOPOLOGY_UPDATE = "TOPOLOGY_UPDATE"


class HealthLevel(StrEnum):
    NORMAL = "NORMAL"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class AudioEventType(StrEnum):
    GUNSHOT = "gunshot"
    EXPLOSION = "explosion"
    GLASS_BREAK = "glass_break"
    ALARM = "alarm"
    SCREAM = "scream"
    SPEECH = "speech"
    EMERGENCY = "emergency"
    SOS = "sos"
    AMBIENT = "ambient"


class AudioLanguage(StrEnum):
    ENGLISH = "en"
    IGBO = "ig"
    HAUSA = "ha"
    YORUBA = "yo"


class AudioPriority(StrEnum):
    CRITICAL = "1"
    HIGH = "2"
    MEDIUM = "3"
    LOW = "4"


class AudioStreamingMode(StrEnum):
    PRIORITY_DRIVEN = "PRIORITY_DRIVEN"
    CONTINUOUS = "CONTINUOUS"
    OFF = "OFF"


class BehaviorClass(StrEnum):
    NORMAL = "normal"
    VIOLENCE = "violence"
    SUSPICIOUS = "suspicious"
    PANIC = "panic"


class VideoPriority(StrEnum):
    CRITICAL = "1"
    HIGH = "2"
    MEDIUM = "3"
    LOW = "4"
