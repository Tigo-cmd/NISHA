"""NISHA Binary Frame Protocol implementation."""

import struct
import json
from typing import Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class NISHAFrame:
    """Binary frame protocol for NISHA streams."""
    
    MAGIC = b'NI'
    VERSION = 1
    
    # Stream types
    TELEMETRY = 0x01
    VIDEO = 0x02
    AUDIO = 0x03
    LOCATION = 0x04
    
    # Priorities
    CRITICAL = 1
    EVENT = 2
    CONTINUOUS = 3
    BACKGROUND = 4
    
    magic: bytes
    version: int
    stream_type: int
    priority: int
    sequence: int
    timestamp: int
    payload_len: int
    metadata: Dict[str, Any]
    payload: bytes

    @classmethod
    def from_bytes(cls, data: bytes) -> 'NISHAFrame':
        """Parse raw bytes into a NISHAFrame."""
        if len(data) < 16:
            raise ValueError("Data too short for NISHA header")
            
        offset = 0
        
        # Header (16 bytes)
        magic = data[offset:offset+2]; offset += 2
        if magic != cls.MAGIC:
            raise ValueError(f"Invalid magic: {magic}")
            
        version = data[offset]; offset += 1
        if version != cls.VERSION:
            raise ValueError(f"Unsupported version: {version}")
            
        stream_type = data[offset]; offset += 1
        priority = data[offset]; offset += 1
        # Skip reserved byte
        offset += 1
        
        sequence = struct.unpack('>I', data[offset:offset+4])[0]; offset += 4
        timestamp = struct.unpack('>Q', data[offset:offset+8])[0]; offset += 8
        payload_len = struct.unpack('>I', data[offset:offset+4])[0]; offset += 4
        
        # Metadata (2 bytes length + JSON payload)
        if len(data) < offset + 2:
            raise ValueError("Metadata length missing")
        meta_len = struct.unpack('>H', data[offset:offset+2])[0]; offset += 2
        
        if len(data) < offset + meta_len:
            raise ValueError("Metadata content truncated")
        meta_json = data[offset:offset+meta_len].decode('utf-8')
        metadata = json.loads(meta_json); offset += meta_len
        
        # Payload
        payload = data[offset:offset+payload_len]
        
        return cls(
            magic=magic,
            version=version,
            stream_type=stream_type,
            priority=priority,
            sequence=sequence,
            timestamp=timestamp,
            payload_len=payload_len,
            metadata=metadata,
            payload=payload
        )

    def to_bytes(self) -> bytes:
        """Serialize NISHAFrame to bytes."""
        meta_json = json.dumps(self.metadata).encode('utf-8')
        meta_len = len(meta_json)
        
        header = struct.pack(
            '>2sBBBB I Q I',
            self.MAGIC,
            self.VERSION,
            self.stream_type,
            self.priority,
            0, # reserved
            self.sequence,
            self.timestamp,
            len(self.payload)
        )
        
        return header + struct.pack('>H', meta_len) + meta_json + self.payload
