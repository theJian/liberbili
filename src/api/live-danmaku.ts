import { inflate } from 'pako';

import { Danmaku } from './types';

const SOCKET_URL = 'wss://broadcastlv.chat.bilibili.com/sub';

function packet(payload: string, operation: number) {
  const body = new TextEncoder().encode(payload);
  const result = new Uint8Array(16 + body.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, result.length);
  view.setUint16(4, 16);
  view.setUint16(6, 1);
  view.setUint32(8, operation);
  view.setUint32(12, 1);
  result.set(body, 16);
  return result;
}

function normalize(message: Record<string, any>, startedAt: number): Danmaku | undefined {
  const command = String(message.cmd ?? '');
  if (command.startsWith('DANMU_MSG')) {
    const info = message.info ?? [];
    const metadata = info[0] ?? [];
    const mode = Number(metadata[1]);
    return { text: String(info[1] ?? ''), color: 0xff000000 + Number(metadata[3] ?? 0xffffff), position: mode === 4 ? 'bottom' : mode === 1 ? 'regular' : 'top', fontScale: 0.64, time: 0, live: true };
  }
  if (command.includes('SUPER_CHAT_MESSAGE')) {
    const data = message.data ?? {};
    return { text: `(¥${data.price}) ${data.message}`, color: 0xff000000 + Number.parseInt(String(data.background_bottom_color ?? '#ffffff').slice(1), 16), position: 'superchat', fontScale: 0.64, time: Number(data.start_time ?? startedAt) - startedAt, live: true };
  }
}

function decodePackets(bytes: Uint8Array): Record<string, any>[] {
  const messages: Record<string, any>[] = [];
  for (let offset = 0; offset + 16 <= bytes.length;) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
    const length = view.getUint32(0);
    const headerLength = view.getUint16(4);
    const protocol = view.getUint16(6);
    const operation = view.getUint32(8);
    if (length < headerLength || offset + length > bytes.length) break;
    const body = bytes.slice(offset + headerLength, offset + length);
    if (operation === 5) {
      if (protocol === 2) messages.push(...decodePackets(inflate(body)));
      else {
        try { messages.push(JSON.parse(new TextDecoder().decode(body))); } catch { /* heartbeat and malformed frames are ignored */ }
      }
    }
    offset += length;
  }
  return messages;
}

export class BilibiliLiveDanmakuClient {
  private socket?: WebSocket;
  private heartbeat?: ReturnType<typeof setInterval>;
  private stopped = false;

  constructor(
    private roomId: number,
    private token: string,
    private startedAt: number,
    private onMessage: (message: Danmaku) => void,
  ) {}

  connect() {
    this.stopped = false;
    const Socket = WebSocket as unknown as new (url: string, protocols?: string | string[], options?: object) => WebSocket;
    const socket = new Socket(SOCKET_URL, undefined, {
      headers: { Origin: 'https://www.bilibili.com', 'User-Agent': 'Mozilla/5.0' },
    });
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => {
      socket.send(packet(JSON.stringify({ uid: 0, roomid: this.roomId, protover: 2, platform: 'web', clientver: '1.4.0', type: 2, key: this.token }), 7));
      this.heartbeat = setInterval(() => socket.send(packet('', 2)), 30_000);
    };
    socket.onmessage = async (event) => {
      const bytes = event.data instanceof ArrayBuffer
        ? new Uint8Array(event.data)
        : event.data instanceof Blob
          ? new Uint8Array(await event.data.arrayBuffer())
          : new TextEncoder().encode(String(event.data));
      for (const raw of decodePackets(bytes)) {
        const message = normalize(raw, this.startedAt);
        if (message) this.onMessage(message);
      }
    };
    socket.onclose = () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      if (!this.stopped) setTimeout(() => this.connect(), 1_500);
    };
    this.socket = socket;
  }

  disconnect() {
    this.stopped = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.socket?.close();
  }
}

