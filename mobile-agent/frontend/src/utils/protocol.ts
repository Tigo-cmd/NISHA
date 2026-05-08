/**
 * NISHA Frame Protocol implementation for Mobile.
 * Handles binary header construction for streaming packets to the Master node.
 */

export enum StreamType {
  TELEMETRY = 0x01,
  VIDEO = 0x02,
  AUDIO = 0x03,
  LOCATION = 0x04,
  CONTROL = 0xFF,
}

export enum Priority {
  LOW = 0x00,
  HIGH = 0x01,
}

export class NISHAFrame {
  static encode(
    streamType: StreamType,
    priority: Priority,
    sequence: number,
    rssi: number,
    battery: number,
    payload: Uint8Array,
    customMetadata: object = {}
  ): Uint8Array {
    const metadata = { rssi, battery, ...customMetadata };
    const metaJson = JSON.stringify(metadata);
    const metaBytes = new TextEncoder().encode(metaJson);


    const HEADER_SIZE = 24;
    const frameSize = HEADER_SIZE + metaBytes.length + payload.length;
    const buffer = new Uint8Array(frameSize);
    const view = new DataView(buffer.buffer);

    // [0-1] Magic 'NI'
    view.setUint8(0, 0x4E); // 'N'
    view.setUint8(1, 0x49); // 'I'

    // [2] Version
    view.setUint8(2, 0x01);

    // [3] Stream Type
    view.setUint8(3, streamType);

    // [4] Priority
    view.setUint8(4, priority);

    // [5] Reserved
    view.setUint8(5, 0x00);

    // [6-9] Sequence (uint32)
    view.setUint32(6, sequence, false);

    // [10-17] Timestamp (uint64)
    const ts = BigInt(Date.now());
    view.setBigUint64(10, ts, false);

    // [18-21] Payload Len (uint32)
    view.setUint32(18, payload.length, false);

    // [22-23] Meta Len (uint16)
    view.setUint16(22, metaBytes.length, false);

    // Fill metadata starting at index 24 (HEADER_SIZE)
    buffer.set(metaBytes, HEADER_SIZE);

    // Fill payload starting after metadata
    buffer.set(payload, HEADER_SIZE + metaBytes.length);

    return buffer;
  }
}
