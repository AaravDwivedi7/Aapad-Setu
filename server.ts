import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

interface VictimProfile {
  name?: string;
  bloodGroup?: string;
  healthIssues?: string;
  emergencyContact?: string;
  notes?: string;
}

interface MeshPeer {
  id: string;
  shortId: string;
  name?: string;
  role: 'VICTIM' | 'RESPONDER' | 'GATEWAY';
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  battery?: number;
  status: 'CRITICAL - TRAPPED' | 'INJURED' | 'SAFE' | 'SEARCHING' | 'RESCUING';
  isSosActive: boolean;
  medicalInfo?: string;
  victimProfile?: VictimProfile;
  lastSeen: number;
}

interface SosPacket {
  id?: string;
  uuid: string;
  origin_node: string;
  deviceId: string;
  callsign?: string;
  victimName?: string;
  victimProfile?: VictimProfile;
  lat: number;
  lng: number;
  lon?: number;
  accuracy: number;
  altitude: number;
  battery: string | number;
  status: string;
  targetRole?: string;
  voiceNote?: string;
  medical?: any;
  hops: number;
  ttl: number;
  timestamp: string;
  payload?: {
    msg: string;
    level: string;
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory real-time state for connected disaster mesh nodes
  const activePeers: Map<string, MeshPeer> = new Map();
  const activePackets: Map<string, SosPacket> = new Map();
  const sseClients: Set<express.Response> = new Set();

  // Helper to notify all connected devices in real time
  function broadcastSSE(type: string, data: any) {
    const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch (err) {
        sseClients.delete(client);
      }
    }
  }

  // Cleanup stale peers inactive for > 60 seconds
  setInterval(() => {
    const now = Date.now();
    let cleaned = false;
    for (const [id, peer] of activePeers.entries()) {
      if (now - peer.lastSeen > 60000 && !peer.isSosActive) {
        activePeers.delete(id);
        cleaned = true;
      }
    }
    if (cleaned) {
      broadcastSSE('PEERS_UPDATE', Array.from(activePeers.values()));
    }
  }, 10000);

  // 1. Healthcheck
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      connectedClients: sseClients.size,
      activePeersCount: activePeers.size,
      activeSosCount: activePackets.size
    });
  });

  // 2. Server-Sent Events (SSE) stream for real-time inter-device communication
  app.get('/api/mesh/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);

    // Send initial snapshot immediately to the newly connected device
    const initialData = {
      peers: Array.from(activePeers.values()),
      packets: Array.from(activePackets.values())
    };
    res.write(`event: INIT_SYNC\ndata: ${JSON.stringify(initialData)}\n\n`);

    // Notify all peers of the updated mesh client count
    broadcastSSE('PEERS_UPDATE', Array.from(activePeers.values()));

    req.on('close', () => {
      sseClients.delete(res);
      broadcastSSE('PEERS_UPDATE', Array.from(activePeers.values()));
    });
  });

  // 3. Full Mesh State Snapshot
  app.get('/api/mesh/state', (req, res) => {
    res.json({
      peers: Array.from(activePeers.values()),
      packets: Array.from(activePackets.values()),
      connectedClients: sseClients.size,
      timestamp: new Date().toISOString()
    });
  });

  // 4. Live Device Heartbeat (transmits GPS & Status automatically)
  app.post('/api/mesh/heartbeat', (req, res) => {
    const { deviceId, shortId, name, role, lat, lng, accuracy, altitude, heading, battery, status, isSosActive, medicalInfo, victimProfile } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId required' });
    }

    const peer: MeshPeer = {
      id: deviceId,
      shortId: shortId || deviceId.substring(0, 8),
      name: (victimProfile?.name && victimProfile.name.trim()) || name || 'Citizen Node',
      role: role || 'VICTIM',
      lat: typeof lat === 'number' ? lat : 19.0760,
      lng: typeof lng === 'number' ? lng : 72.8777,
      accuracy: accuracy || 5,
      altitude: altitude || 15,
      heading: heading || 0,
      battery: typeof battery === 'number' ? battery : 90,
      status: status || 'SAFE',
      isSosActive: Boolean(isSosActive),
      medicalInfo: medicalInfo || (victimProfile?.healthIssues ? `Blood: ${victimProfile?.bloodGroup || 'N/A'}, Medical: ${victimProfile?.healthIssues}` : ''),
      victimProfile: victimProfile || undefined,
      lastSeen: Date.now()
    };

    const isNewPeer = !activePeers.has(deviceId);
    activePeers.set(deviceId, peer);
    broadcastSSE('PEER_HEARTBEAT', peer);
    if (isNewPeer) {
      broadcastSSE('PEERS_UPDATE', Array.from(activePeers.values()));
    }

    res.json({ success: true, peer, totalPeers: activePeers.size });
  });

  // 5. Emergency SOS Broadcast (Instant broadcast across all connected phones)
  app.post('/api/mesh/sos', (req, res) => {
    const { packet, deviceId } = req.body;
    if (!packet || (!packet.uuid && !packet.id)) {
      return res.status(400).json({ error: 'Invalid packet payload' });
    }

    const nodeOrigin = packet.origin_node || packet.originNode || (deviceId ? `Node-${deviceId}` : 'Citizen Device');
    const persistentId = packet.id || deviceId || nodeOrigin;
    const packetId = packet.uuid || ('SOS_' + persistentId + '_' + Date.now());
    const latitude = Number(packet.lat) || 19.0760;
    const longitude = Number(packet.lon ?? packet.lng) || 72.8777;

    const sosPacket: SosPacket = {
      uuid: packetId,
      id: persistentId,
      origin_node: nodeOrigin,
      deviceId: deviceId || persistentId,
      callsign: packet.callsign || nodeOrigin,
      victimName: packet.victimName || packet.victimProfile?.name || undefined,
      victimProfile: packet.victimProfile || undefined,
      lat: latitude,
      lng: longitude,
      lon: longitude,
      accuracy: Number(packet.accuracy) || 5,
      altitude: Number(packet.altitude) || 15,
      battery: packet.battery ?? 85,
      status: packet.status || 'CRITICAL',
      targetRole: packet.targetRole || 'RESPONDER_ONLY',
      voiceNote: packet.voiceNote || '',
      medical: packet.medical || packet.victimProfile?.healthIssues || '',
      hops: Number(packet.hops) || 0,
      ttl: Number(packet.ttl) || 5,
      timestamp: packet.timestamp || new Date().toISOString(),
      payload: packet.payload || {
        msg: packet.distressMessage || '🚨 SOS: Citizen in distress! Immediate extraction required.',
        level: 'CRITICAL'
      }
    };

    // Store exactly ONE active packet record per device to eliminate duplicate victims
    const packetStoreKey = deviceId || persistentId || sosPacket.uuid;
    activePackets.set(packetStoreKey, sosPacket);

    // Update peer state as SOS active
    if (deviceId && activePeers.has(deviceId)) {
      const p = activePeers.get(deviceId)!;
      p.isSosActive = true;
      p.status = (sosPacket.status as any) || 'CRITICAL - TRAPPED';
      if (sosPacket.victimProfile) p.victimProfile = sosPacket.victimProfile;
      p.lastSeen = Date.now();
      activePeers.set(deviceId, p);
    }

    // Broadcast urgent SOS event to all devices immediately!
    broadcastSSE('SOS_ALERT', {
      packet: sosPacket,
      senderDeviceId: deviceId
    });

    res.json({ success: true, packet: sosPacket });
  });

  // 6. Update Victim / Incident Status (e.g. Rescued / Safe)
  app.post('/api/mesh/status', (req, res) => {
    const { uuid, deviceId, status } = req.body;
    
    // Update matching packets across activePackets
    for (const [key, pkt] of activePackets.entries()) {
      if (pkt.uuid === uuid || pkt.id === uuid || pkt.id === deviceId || pkt.deviceId === deviceId || key === deviceId) {
        pkt.status = status;
        if (status === 'SAFE') {
          // Keep it marked safe
          pkt.status = 'SAFE';
        }
      }
    }

    if (deviceId && activePeers.has(deviceId)) {
      const p = activePeers.get(deviceId)!;
      p.status = status;
      if (status === 'SAFE') {
        p.isSosActive = false;
      }
      activePeers.set(deviceId, p);
    }

    broadcastSSE('STATUS_UPDATE', { uuid, deviceId, status });
    res.json({ success: true });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Disaster Mesh Hub server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
