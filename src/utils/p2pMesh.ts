/**
 * Aapad Setu — Real Offline Peer-to-Peer Mesh & Acoustic Modem Network Engine
 * Integrates WebRTC P2P DataChannels, Cross-Device BroadcastChannels, PeerJS Mesh Clustering, and
 * Acoustic Audio Modem (Sound-based FSK data transmission) for zero-infrastructure survival.
 */

export interface DisasterPacket {
  id?: string;
  uuid: string;
  origin_node: string;
  timestamp: string;
  hop_count?: number;
  hops?: number;
  max_hops?: number;
  ttl?: number;
  lat: number;
  lon?: number;
  lng: number;
  accuracy: number;
  altitude?: number;
  battery_level?: number;
  battery?: string | number;
  status: string;
  targetRole?: string;
  voiceNote?: string;
  triage_level?: 'RED' | 'YELLOW' | 'GREEN';
  victim_name?: string;
  blood_group?: string;
  medical_notes?: string;
  medical?: string;
  emergency_contacts?: string;
  rssi?: number;
  checksum?: string;
  [key: string]: any;
}

// CRC-16-CCITT for packet integrity verification
export function calculateCRC16(dataStr: string): string {
  let crc = 0xffff;
  for (let i = 0; i < dataStr.length; i++) {
    const c = dataStr.charCodeAt(i);
    crc ^= c << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * PeerJS WebRTC Dynamic Mesh Manager for Room "AAPAD_SETU_MESH_ZONE_1"
 */
export class PeerJSMeshManager {
  public peer: any = null;
  public peerId: string = '';
  public roomName: string = 'AAPAD_SETU_MESH_ZONE_1';
  public connections: Map<string, any> = new Map();
  public isConnected: boolean = false;
  private onPacketReceived: ((packet: DisasterPacket, senderId: string) => void) | null = null;
  private onPeersChange: ((peers: string[]) => void) | null = null;
  private onLog: ((tag: string, msg: string) => void) | null = null;
  private heartbeatTimer: any = null;

  constructor(
    room: string = 'AAPAD_SETU_MESH_ZONE_1',
    onPacket?: (packet: DisasterPacket, senderId: string) => void,
    onPeers?: (peers: string[]) => void,
    onLog?: (tag: string, msg: string) => void
  ) {
    this.roomName = room;
    if (onPacket) this.onPacketReceived = onPacket;
    if (onPeers) this.onPeersChange = onPeers;
    if (onLog) this.onLog = onLog;
  }

  private log(tag: string, msg: string) {
    if (this.onLog) this.onLog(tag, msg);
  }

  public init(customNodeId?: string) {
    try {
      const PeerClass = (window as any).Peer || (typeof window !== 'undefined' ? (window as any).peerjs?.Peer : null);
      
      const cleanNodeId = (customNodeId || 'node-' + Math.random().toString(36).substring(2, 7)).toLowerCase().replace(/[^a-z0-9]/g, '');
      const assignedId = `aapad-zone1-${cleanNodeId}`;

      if (!PeerClass) {
        this.log('P2P', 'ℹ️ PeerJS library loading from CDN...');
        return;
      }

      this.peer = new PeerClass(assignedId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id: string) => {
        this.peerId = id;
        this.isConnected = true;
        this.log('P2P', `🌐 WebRTC PeerJS Mesh Node initialized. ID: [${id}] in Room: ${this.roomName}`);
        this.notifyPeers();
      });

      this.peer.on('connection', (conn: any) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err: any) => {
        // If ID is already taken, try with random suffix
        if (err.type === 'unavailable-id') {
          const fallbackId = `aapad-zone1-${cleanNodeId}-${Math.floor(Math.random() * 1000)}`;
          try {
            this.peer = new PeerClass(fallbackId);
            this.peer.on('open', (id: string) => {
              this.peerId = id;
              this.isConnected = true;
              this.log('P2P', `🌐 WebRTC PeerJS Mesh Node re-registered with ID: [${id}]`);
              this.notifyPeers();
            });
            this.peer.on('connection', (c: any) => this.setupConnection(c));
          } catch (e) {}
        } else {
          console.warn('PeerJS connection notice:', err);
        }
      });

    } catch (e) {
      console.warn('PeerJS init fallback:', e);
    }
  }

  public connectToPeer(targetPeerId: string) {
    if (!this.peer || !targetPeerId || targetPeerId === this.peerId) return;
    if (this.connections.has(targetPeerId)) return;

    try {
      const conn = this.peer.connect(targetPeerId, { reliable: true });
      this.setupConnection(conn);
    } catch (e) {
      console.warn('P2P Connect error:', e);
    }
  }

  private setupConnection(conn: any) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.log('P2P', `🔗 WebRTC DataChannel link open with Peer [${conn.peer}].`);
      this.notifyPeers();
    });

    conn.on('data', (data: any) => {
      try {
        const packet = typeof data === 'string' ? JSON.parse(data) : data;
        if (this.onPacketReceived) {
          this.onPacketReceived(packet, conn.peer);
        }
      } catch (e) {
        console.warn('P2P parse error:', e);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.log('P2P', `⚠️ P2P DataChannel closed with Peer [${conn.peer}].`);
      this.notifyPeers();
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
      this.notifyPeers();
    });
  }

  public broadcast(packet: DisasterPacket): number {
    let sentCount = 0;
    const serialized = JSON.stringify(packet);

    for (const [peerId, conn] of this.connections.entries()) {
      if (conn && conn.open) {
        try {
          conn.send(serialized);
          sentCount++;
        } catch (e) {
          console.warn('P2P send failed to peer', peerId, e);
        }
      }
    }
    return sentCount;
  }

  private notifyPeers() {
    const list = Array.from(this.connections.keys());
    if (this.onPeersChange) {
      this.onPeersChange(list);
    }
  }

  public getConnectedCount(): number {
    return this.connections.size;
  }

  public destroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const conn of this.connections.values()) {
      try { conn.close(); } catch (e) {}
    }
    this.connections.clear();
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.isConnected = false;
  }
}

/**
 * Real WebRTC Peer-to-Peer Direct Connection Manager (Works offline over local Wi-Fi / Hotspot)
 */
export class WebRTCPeerMesh {
  public peerConnection: RTCPeerConnection | null = null;
  public dataChannel: RTCDataChannel | null = null;
  public connectionState: 'DISCONNECTED' | 'OFFERING' | 'ANSWERING' | 'CONNECTED' = 'DISCONNECTED';
  private onPacketReceived: ((packet: DisasterPacket) => void) | null = null;
  private onStateChange: ((state: string) => void) | null = null;
  private onLog: ((tag: string, msg: string) => void) | null = null;

  constructor(
    onPacket?: (packet: DisasterPacket) => void,
    onState?: (state: string) => void,
    onLog?: (tag: string, msg: string) => void
  ) {
    if (onPacket) this.onPacketReceived = onPacket;
    if (onState) this.onStateChange = onState;
    if (onLog) this.onLog = onLog;
  }

  private log(tag: string, msg: string) {
    if (this.onLog) this.onLog(tag, msg);
  }

  private setState(state: 'DISCONNECTED' | 'OFFERING' | 'ANSWERING' | 'CONNECTED') {
    this.connectionState = state;
    if (this.onStateChange) this.onStateChange(state);
  }

  /**
   * Node 1 (Host / Offer Creator): Generates WebRTC Offer Session String
   */
  public async createOffer(): Promise<string> {
    this.close();
    this.setState('OFFERING');
    this.log('P2P', '📡 Creating offline WebRTC DataChannel Offer for physical phone pairing...');

    const pc = new RTCPeerConnection({
      iceServers: [] // Zero-internet local ICE
    });
    this.peerConnection = pc;

    const dc = pc.createDataChannel('aapad_setu_mesh', {
      ordered: true
    });
    this.setupDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    return new Promise((resolve) => {
      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          const sessionPayload = JSON.stringify(pc.localDescription);
          this.log('P2P', '✅ WebRTC Offer generated. Ready for QR Code scan or session copy.');
          resolve(btoa(sessionPayload));
        }
      };

      setTimeout(() => {
        if (pc.localDescription) {
          resolve(btoa(JSON.stringify(pc.localDescription)));
        }
      }, 1200);
    });
  }

  /**
   * Node 2 (Joiner / Answer Creator): Accepts Offer and produces Answer Session String
   */
  public async createAnswerFromOffer(offerBase64: string): Promise<string> {
    this.close();
    this.setState('ANSWERING');
    this.log('P2P', '📥 Parsing Offer payload from remote peer device...');

    const offerDesc = JSON.parse(atob(offerBase64));
    const pc = new RTCPeerConnection({
      iceServers: []
    });
    this.peerConnection = pc;

    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    return new Promise((resolve) => {
      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          const answerPayload = JSON.stringify(pc.localDescription);
          this.log('P2P', '✅ WebRTC Answer generated. Provide to host phone to finalize P2P bridge.');
          resolve(btoa(answerPayload));
        }
      };

      setTimeout(() => {
        if (pc.localDescription) {
          resolve(btoa(JSON.stringify(pc.localDescription)));
        }
      }, 1200);
    });
  }

  /**
   * Node 1 (Host): Finalizes P2P link with the Answer String from Node 2
   */
  public async finalizeWithAnswer(answerBase64: string): Promise<void> {
    if (!this.peerConnection) throw new Error('No active peer connection initialized.');
    this.log('P2P', '🔗 Applying WebRTC Answer. Establishing direct offline P2P DataChannel...');
    const answerDesc = JSON.parse(atob(answerBase64));
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerDesc));
  }

  private setupDataChannel(dc: RTCDataChannel) {
    this.dataChannel = dc;

    dc.onopen = () => {
      this.setState('CONNECTED');
      this.log('P2P', '🎉 DIRECT HARDWARE P2P DATACHANNEL CONNECTED! Zero internet required.');
    };

    dc.onclose = () => {
      this.setState('DISCONNECTED');
      this.log('P2P', '⚠️ P2P DataChannel closed.');
    };

    dc.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (this.onPacketReceived) {
          this.onPacketReceived(parsed);
        }
        this.log('P2P', `📦 Real P2P Packet Received: [${parsed.uuid || 'TELEMETRY'}] via WebRTC DataChannel.`);
      } catch (e) {
        console.warn('P2P Message parse error:', e);
      }
    };
  }

  public sendPacket(packet: DisasterPacket): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(packet));
        this.log('P2P', `📤 Dispatched packet [${packet.uuid}] directly across physical WebRTC P2P link.`);
        return true;
      } catch (e) {
        console.warn('P2P Send error:', e);
      }
    }
    return false;
  }

  public close() {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }
    this.setState('DISCONNECTED');
  }
}

/**
 * Ultrasonic / Acoustic Sound Modem Engine
 * Transmits short binary distress telemetry over audio frequencies (1800Hz / 2200Hz FSK)
 */
export class AcousticSoundModem {
  private audioCtx: AudioContext | null = null;
  private isTransmitting = false;

  private initCtx() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * Transmits a short SOS coordinate burst using Frequency-Shift Keying audio chirps
   */
  public async transmitAcousticBurst(lat: number, lng: number, status: string): Promise<void> {
    if (this.isTransmitting) return;
    this.isTransmitting = true;
    this.initCtx();
    if (!this.audioCtx) {
      this.isTransmitting = false;
      return;
    }

    try {
      // 1800Hz (Mark / Bit 1), 2200Hz (Space / Bit 0)
      const bitDuration = 0.05; // 50ms per bit
      const now = this.audioCtx.currentTime;

      // Encode concise packet signature: "SOS" + rounded lat + rounded lng
      const message = `SOS:${lat.toFixed(4)},${lng.toFixed(4)}`;
      let currentOffset = now;

      // Leading preamble tone (2400Hz alert burst)
      const preOsc = this.audioCtx.createOscillator();
      const preGain = this.audioCtx.createGain();
      preOsc.frequency.setValueAtTime(2400, currentOffset);
      preGain.gain.setValueAtTime(0.3, currentOffset);
      preGain.gain.exponentialRampToValueAtTime(0.001, currentOffset + 0.15);
      preOsc.connect(preGain);
      preGain.connect(this.audioCtx.destination);
      preOsc.start(currentOffset);
      preOsc.stop(currentOffset + 0.15);

      currentOffset += 0.18;

      for (let i = 0; i < message.length; i++) {
        const charCode = message.charCodeAt(i);
        for (let bit = 7; bit >= 0; bit--) {
          const isOne = ((charCode >> bit) & 1) === 1;
          const freq = isOne ? 1800 : 2200;

          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, currentOffset);

          gain.gain.setValueAtTime(0.001, currentOffset);
          gain.gain.linearRampToValueAtTime(0.2, currentOffset + 0.005);
          gain.gain.linearRampToValueAtTime(0.001, currentOffset + bitDuration - 0.005);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(currentOffset);
          osc.stop(currentOffset + bitDuration);

          currentOffset += bitDuration;
        }
      }

      const totalDuration = (currentOffset - now) * 1000;
      setTimeout(() => {
        this.isTransmitting = false;
      }, totalDuration + 100);
    } catch (e) {
      console.warn('Acoustic transmission error:', e);
      this.isTransmitting = false;
    }
  }
}

