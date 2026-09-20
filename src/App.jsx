import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Peer from 'peerjs';
import L from 'leaflet';
import {
  AlertTriangle,
  Radio,
  Compass,
  Shield,
  Volume2,
  VolumeX,
  Battery,
  BatteryCharging,
  MapPin,
  Send,
  CheckCircle2,
  XCircle,
  Activity,
  Mic,
  MicOff,
  RefreshCw,
  Users,
  Wifi,
  WifiOff,
  Navigation,
  Flame,
  LifeBuoy,
  PhoneCall,
  Share2,
  Layers,
  ChevronRight,
  Info,
  Clock,
  Sparkles,
  Award,
  Zap,
  Power,
  Crosshair,
  Map as MapIcon,
  RotateCcw,
  UserCheck,
  User,
  X
} from 'lucide-react';

// ==========================================
// CONSTANTS & CONFIGURATION
// ==========================================
const GLOBAL_HUB_ID = 'AAPAD_SETU_MESH_NODE_GLOBAL';
const HUB_SLOTS = [
  'AAPAD_SETU_MESH_HUB_1',
  'AAPAD_SETU_MESH_HUB_2',
  'AAPAD_SETU_MESH_HUB_3',
  'AAPAD_SETU_MESH_HUB_4'
];

const STUN_ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' }
  ]
};

// Default fallback coordinates (Central Emergency Drill Sector)
const DEFAULT_COORDS = {
  lat: 28.6139,
  lng: 77.2090,
  accuracy: 8,
  altitude: 216
};

// Validate coordinate value is a real finite number
function isValidCoord(val) {
  return typeof val === 'number' && !isNaN(val) && isFinite(val);
}

// Ensure coordinates are always strictly valid finite numbers, falling back safely
function sanitizeCoords(lat, lng) {
  const numLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const numLng = typeof lng === 'number' ? lng : parseFloat(lng);
  const safeLat = isValidCoord(numLat) ? numLat : DEFAULT_COORDS.lat;
  const safeLng = isValidCoord(numLng) ? numLng : DEFAULT_COORDS.lng;
  return { lat: safeLat, lng: safeLng };
}

// Initial drill casualties for immediate responder test readiness
const INITIAL_DEMO_CASUALTIES = [
  {
    id: 'CASUALTY_ALPHA_104',
    uuid: 'SOS_CASUALTY_ALPHA_104',
    victimName: 'Rahul Sharma',
    callsign: 'Rahul Sharma [ALPHA-104]',
    lat: DEFAULT_COORDS.lat + 0.00045,
    lng: DEFAULT_COORDS.lng + 0.00035,
    battery: 48,
    status: 'TRAPPED',
    distressMessage: 'Trapped beneath structural debris, conscious, battery draining.',
    lastSeenMs: Date.now(),
    hopCount: 2,
    originNode: 'NODE_ALPHA_104'
  },
  {
    id: 'CASUALTY_BRAVO_209',
    uuid: 'SOS_CASUALTY_BRAVO_209',
    victimName: 'Ananya Verma',
    callsign: 'Ananya Verma [BRAVO-209]',
    lat: DEFAULT_COORDS.lat - 0.00038,
    lng: DEFAULT_COORDS.lng + 0.00048,
    battery: 62,
    status: 'INJURED',
    distressMessage: 'Deep lacerations, first aid required, responsive.',
    lastSeenMs: Date.now(),
    hopCount: 1,
    originNode: 'NODE_BRAVO_209'
  }
];

// Haversine Distance Calculation (Meters)
function calculateHaversine(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Bearing Calculation (Degrees 0 - 360)
function calculateBearing(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const lambda1 = (lon1 * Math.PI) / 180;
  const lambda2 = (lon2 * Math.PI) / 180;

  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  const theta = Math.atan2(y, x);
  return (theta * 180 / Math.PI + 360) % 360;
}

// Generate human-friendly distress callsigns
function generateCallsign() {
  const prefixes = ['ALPHA', 'BRAVO', 'DELTA', 'ECHO', 'TANGO', 'VICTOR', 'ZULU', 'SIERRA'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${p}-${num}`;
}

export default function App() {
  // ==========================================
  // CORE STATE ENGINE
  // ==========================================
  // Role Selection: 'ROLE_VICTIM' (Tab 1) or 'ROLE_RESPONDER' (Tab 2)
  const [activeRole, setActiveRole] = useState('ROLE_VICTIM');

  // Node Identification
  const [myNodeId] = useState(() => {
    const saved = sessionStorage.getItem('aapad_node_id');
    if (saved) return saved;
    const generated = 'AAPAD_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    sessionStorage.setItem('aapad_node_id', generated);
    return generated;
  });
  const [myCallsign] = useState(generateCallsign);

  // Prior Civilian Name Registration (Saved locally to avoid any identity confusion)
  const [victimName, setVictimName] = useState(() => {
    return localStorage.getItem('aapad_victim_name') || '';
  });

  const handleUpdateVictimName = useCallback((name) => {
    setVictimName(name);
    localStorage.setItem('aapad_victim_name', name);
  }, []);

  // Compute clean display identity combining human name and callsign
  const effectiveCallsign = useMemo(() => {
    const trimmed = victimName.trim();
    return trimmed ? `${trimmed} [${myCallsign}]` : myCallsign;
  }, [victimName, myCallsign]);

  // High-Accuracy GPS Triangulation during Button Hold
  const [isHoldingTrigger, setIsHoldingTrigger] = useState(false);
  const [holdingGpsAccuracy, setHoldingGpsAccuracy] = useState(null);
  const holdWatchIdRef = useRef(null);
  const bestAcquiredCoordsRef = useRef(null);

  // Victim Interactive Location Map
  const [victimShowMap, setVictimShowMap] = useState(false);
  const victimMapContainerRef = useRef(null);
  const victimLeafletMapRef = useRef(null);
  const victimMarkersGroupRef = useRef(null);

  // Audio Context & Autoplay Unlock Guard
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioCtxRef = useRef(null);

  // Mesh Network Connections
  const peerInstanceRef = useRef(null);
  const [meshStatus, setMeshStatus] = useState('INITIALIZING'); // 'CONNECTED' | 'SEARCHING' | 'OFFLINE'
  const [connectedPeers, setConnectedPeers] = useState([]);
  const activeConnectionsRef = useRef(new Map());
  const broadcastChannelRef = useRef(null);

  // Hardware Telemetry: GPS & Battery
  const [gpsLocation, setGpsLocation] = useState(DEFAULT_COORDS);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(88);
  const [isCharging, setIsCharging] = useState(false);

  // Gyroscope & Compass Orientation
  const [compassHeading, setCompassHeading] = useState(0);
  const [gyroSupported, setGyroSupported] = useState(true);
  const [gyroActive, setGyroActive] = useState(false);

  // Victim Distress Transmission State
  const [isDistressActive, setIsDistressActive] = useState(false);
  const [distressStatus, setDistressStatus] = useState('TRAPPED'); // 'TRAPPED' | 'INJURED' | 'CRITICAL' | 'SAFE'
  const [distressMessage, setDistressMessage] = useState('Trapped under debris, conscious, battery draining');
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef(null);
  const [packetsSentCount, setPacketsSentCount] = useState(0);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [voiceNoteRecorded, setVoiceNoteRecorded] = useState(null);

  // Rescuer Area Triage Ledger & Dispatch
  const [triageRoster, setTriageRoster] = useState(INITIAL_DEMO_CASUALTIES);
  const [selectedVictim, setSelectedVictim] = useState(null);
  const [rosterTab, setRosterTab] = useState('VICTIMS'); // 'VICTIMS' | 'RESCUED'
  const [victimSubFilter, setVictimSubFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'INJURED'
  const [spatialViewMode, setSpatialViewMode] = useState('MAP'); // 'MAP' | 'RADAR'
  const [locateHighlightId, setLocateHighlightId] = useState(null);
  const [notificationMsg, setNotificationMsg] = useState(null);
  const [radarScaleMeters, setRadarScaleMeters] = useState(100); // 20m, 50m, 100m, 500m
  const [radarHeadingMode, setRadarHeadingMode] = useState('HEAD_UP'); // 'HEAD_UP' | 'NORTH_UP'
  const [isSonarMuted, setIsSonarMuted] = useState(false);

  // Map & Spatial Navigation References
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersGroupRef = useRef(null);

  // High-Priority Alert Overlay (Rescuer Only)
  const [activeAlertPopup, setActiveAlertPopup] = useState(null);
  const seenPacketsSetRef = useRef(new Set());

  // Tactical Protocol Logs
  const [protocolLogs, setProtocolLogs] = useState([]);
  const addLog = useCallback((category, text) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setProtocolLogs(prev => [
      { id: Math.random().toString(36).substring(7), timestamp, category, text },
      ...prev.slice(0, 75)
    ]);
  }, []);

  // ==========================================
  // 1. WEB AUDIO INITIALIZATION & SONAR ENGINE
  // ==========================================
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtxRef.current = new AudioCtxClass();
      }
    }
    return audioCtxRef.current;
  }, []);

  const unlockAudio = useCallback(async () => {
    try {
      const ctx = getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        // Play brief 0.1s confirmation chirp (880Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
      setAudioUnlocked(true);
      addLog('AUDIO', '🔊 Web Audio Context activated and unblocked for Sonar/Radar alerts.');
    } catch (e) {
      console.warn('Audio unlock warning:', e);
      setAudioUnlocked(true);
    }
  }, [getAudioContext, addLog]);

  // Sonar Ping Generator for Closest Endangered Victim (Rescuer Mode)
  useEffect(() => {
    if (!audioUnlocked || activeRole !== 'ROLE_RESPONDER' || isSonarMuted) return;

    // Only target casualties strictly in danger (never SAFE)
    const targetVictim = (selectedVictim && selectedVictim.status !== 'SAFE')
      ? selectedVictim
      : triageRoster.find(v => v.status !== 'SAFE' && (v.status === 'TRAPPED' || v.status === 'CRITICAL' || v.status === 'INJURED'));
    if (!targetVictim) return;

    const distance = calculateHaversine(
      gpsLocation.lat,
      gpsLocation.lng,
      targetVictim.lat,
      targetVictim.lng
    );

    // Calculate pulse interval (Closer = faster pings: 1.5s down to 0.18s)
    const clampedDist = Math.max(1, Math.min(100, distance));
    const intervalMs = Math.round(180 + (clampedDist / 100) * 1300);

    // Pitch rises as distance closes (600Hz -> 1400Hz)
    const frequency = Math.round(1400 - (clampedDist / 100) * 800);

    const timer = setInterval(() => {
      try {
        const ctx = getAudioContext();
        if (ctx && ctx.state === 'running') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(frequency, ctx.currentTime);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.06);
        }
      } catch (e) {}
    }, intervalMs);

    return () => clearInterval(timer);
  }, [audioUnlocked, activeRole, isSonarMuted, selectedVictim, triageRoster, gpsLocation, getAudioContext]);

  // Emergency Siren Tone Trigger for High-Priority Rescuer Alert
  const playEmergencySiren = useCallback(() => {
    if (!audioUnlocked) return;
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'running') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.linearRampToValueAtTime(1100, now + 0.3);
        osc.frequency.linearRampToValueAtTime(650, now + 0.6);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.65);
      }
    } catch (e) {}
  }, [audioUnlocked, getAudioContext]);

  // ==========================================
  // 2. HARDWARE SENSOR INTEGRATION (GPS, BATTERY, GYRO)
  // ==========================================
  // Live GPS Tracking
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      addLog('GPS', '⚠️ Geolocation API not supported. Using simulation coordinates.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        if (
          pos?.coords &&
          typeof pos.coords.latitude === 'number' &&
          isFinite(pos.coords.latitude) &&
          typeof pos.coords.longitude === 'number' &&
          isFinite(pos.coords.longitude)
        ) {
          const rawAcc = typeof pos.coords.accuracy === 'number' && isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 5;
          const accuracy = Math.round(rawAcc * 10) / 10;

          setGpsLocation(prev => {
            // Guard against sudden degradation (e.g. WiFi/cellular fallback replacing clean satellite lock)
            if (prev && typeof prev.accuracy === 'number' && prev.accuracy <= 8 && accuracy > 35) {
              return prev;
            }
            return {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: accuracy,
              altitude: typeof pos.coords.altitude === 'number' && isFinite(pos.coords.altitude) ? Math.round(pos.coords.altitude) : (prev?.altitude || 215)
            };
          });
          setGpsLocked(true);
        }
      },
      err => {
        console.warn('GPS watch error:', err);
        setGpsLocked(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [addLog]);

  // Battery Status API
  useEffect(() => {
    let batteryObj = null;
    const updateBattery = () => {
      if (batteryObj) {
        setBatteryLevel(Math.round(batteryObj.level * 100));
        setIsCharging(batteryObj.charging);
      }
    };

    if ('getBattery' in navigator) {
      navigator.getBattery().then(b => {
        batteryObj = b;
        updateBattery();
        b.addEventListener('levelchange', updateBattery);
        b.addEventListener('chargingchange', updateBattery);
      }).catch(() => {});
    }

    return () => {
      if (batteryObj) {
        batteryObj.removeEventListener('levelchange', updateBattery);
        batteryObj.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  // Gyroscope & Compass Orientation
  useEffect(() => {
    const handleOrientation = event => {
      let heading = 0;
      if (event.webkitCompassHeading !== undefined) {
        // iOS Safari precise heading
        heading = event.webkitCompassHeading;
      } else if (event.alpha !== null) {
        // Standard Android / Chrome heading
        heading = (360 - event.alpha) % 360;
      }
      setCompassHeading(Math.round(heading));
      setGyroActive(true);
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    } else {
      setGyroSupported(false);
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  const requestGyroPermission = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          setGyroActive(true);
          addLog('GYRO', '🧭 iOS Gyroscope permission granted.');
        }
      } catch (e) {
        console.warn('Gyro permission request error:', e);
      }
    } else {
      setGyroActive(true);
      addLog('GYRO', '🧭 Gyroscope listener engaged.');
    }
  };

  // ==========================================
  // 3. ZERO-TOUCH AUTONOMOUS WEBRTC MESH ENGINE
  // ==========================================
  // Broadcast Packet to all open WebRTC Data Channels, BroadcastChannel, and Backend Mesh Relay
  const broadcastMeshPacket = useCallback((packet) => {
    const enriched = {
      ...packet,
      hopCount: (packet.hopCount || 0) + 1,
      senderNode: myNodeId,
      sentAt: Date.now()
    };

    // Mark seen locally
    if (enriched.uuid) {
      seenPacketsSetRef.current.add(enriched.uuid);
    }

    // 1. Send via local BroadcastChannel (same browser multi-tab communication)
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(enriched);
      } catch (e) {}
    }

    // 2. Send over all connected WebRTC P2P DataChannels
    activeConnectionsRef.current.forEach((conn) => {
      if (conn && conn.open) {
        try {
          conn.send(enriched);
        } catch (e) {}
      }
    });

    // 3. Send over local zero-infrastructure server bridge
    try {
      fetch('/api/mesh/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packet: enriched, deviceId: myNodeId })
      }).catch(() => {});
    } catch (e) {}

    setPacketsSentCount(prev => prev + 1);
  }, [myNodeId]);

  // Inbound Packet Processing with Strict Role-Based Rules
  const handleIncomingPacket = useCallback((pkt) => {
    if (!pkt || !pkt.uuid) return;

    // Deduplication check
    const isNewPacket = !seenPacketsSetRef.current.has(pkt.uuid);
    seenPacketsSetRef.current.add(pkt.uuid);

    // ==========================================
    // ROLE-BASED ROUTING LOGIC
    // ==========================================
    if (activeRole === 'ROLE_VICTIM') {
      // VICTIM MODE: Store and forward quietly. NO ALARMS, NO POPUPS.
      if (isNewPacket && pkt.hopCount < 10) {
        // Re-broadcast to adjacent nodes (DTN Store-and-Forward)
        broadcastMeshPacket(pkt);
        addLog('MESH', `📦 Relayed packet ${pkt.uuid.substring(0, 8)} for casualty ${pkt.callsign || pkt.id}`);
      }
      return;
    }

    // RESPONDER MODE: Full tactical triage processing
    if (pkt.targetRole === 'RESPONDER_ONLY' || pkt.targetRole === 'ALL' || !pkt.targetRole) {
      const coords = sanitizeCoords(pkt.lat, pkt.lng ?? pkt.lon);
      setTriageRoster(prev => {
        const existingIdx = prev.findIndex(v => v.uuid === pkt.uuid || v.id === pkt.id);
        const updatedVictim = {
          id: pkt.id || pkt.uuid,
          uuid: pkt.uuid || pkt.id,
          victimName: pkt.victimName || (pkt.callsign && pkt.callsign.includes('(') ? pkt.callsign.split('(')[0].trim() : null),
          callsign: pkt.callsign || 'VICTIM-UNKNOWN',
          lat: coords.lat,
          lng: coords.lng,
          accuracy: typeof pkt.accuracy === 'number' && isFinite(pkt.accuracy) ? pkt.accuracy : 5,
          battery: typeof pkt.battery === 'number' && isFinite(pkt.battery) ? pkt.battery : 85,
          status: pkt.status || 'TRAPPED',
          voiceNote: pkt.voiceNote || null,
          distressMessage: pkt.distressMessage || 'Critical Distress Signal Broadcast',
          lastSeenMs: Date.now(),
          hopCount: pkt.hopCount || 1,
          originNode: pkt.originNode || pkt.senderNode || 'UNKNOWN'
        };

        if (existingIdx >= 0) {
          const clone = [...prev];
          clone[existingIdx] = updatedVictim;
          return clone;
        } else {
          return [updatedVictim, ...prev];
        }
      });

      // Show high priority alert overlay & sound siren if new critical casualty
      if (isNewPacket && (pkt.status === 'TRAPPED' || pkt.status === 'CRITICAL')) {
        setActiveAlertPopup({
          ...pkt,
          lat: coords.lat,
          lng: coords.lng,
          receivedAt: Date.now()
        });
        playEmergencySiren();
        addLog('ALERT', `🚨 NEW CRITICAL CASUALTY: ${pkt.callsign || pkt.id} at [${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}]`);
      }

      // Store-and-forward to extend rescue mesh coverage
      if (isNewPacket && pkt.hopCount < 8) {
        broadcastMeshPacket(pkt);
      }
    }
  }, [activeRole, broadcastMeshPacket, addLog, playEmergencySiren]);

  // Peer Connection Management
  const registerConnection = useCallback((conn) => {
    if (!conn) return;

    conn.on('open', () => {
      activeConnectionsRef.current.set(conn.peer, conn);
      setConnectedPeers(Array.from(activeConnectionsRef.current.keys()));
      setMeshStatus('CONNECTED');
      addLog('PEER', `⚡ P2P WebRTC DataChannel established with [${conn.peer.substring(0, 12)}]`);

      // Exchange current node presence
      conn.send({
        type: 'NODE_ANNOUNCE',
        nodeId: myNodeId,
        role: activeRole,
        callsign: effectiveCallsign,
        victimName: victimName.trim() || undefined,
        timestamp: Date.now()
      });
    });

    conn.on('data', (data) => {
      if (data && typeof data === 'object') {
        if (data.type === 'NODE_ANNOUNCE') {
          addLog('PEER', `👋 Discovered Mesh Node: ${data.callsign || data.nodeId} (${data.role})`);
        } else {
          handleIncomingPacket(data);
        }
      }
    });

    conn.on('close', () => {
      activeConnectionsRef.current.delete(conn.peer);
      const remaining = Array.from(activeConnectionsRef.current.keys());
      setConnectedPeers(remaining);
      if (remaining.length === 0) setMeshStatus('SEARCHING');
      addLog('PEER', `🔌 Peer connection closed: [${conn.peer.substring(0, 12)}]`);
    });

    conn.on('error', () => {
      activeConnectionsRef.current.delete(conn.peer);
      setConnectedPeers(Array.from(activeConnectionsRef.current.keys()));
    });
  }, [myNodeId, activeRole, effectiveCallsign, victimName, handleIncomingPacket, addLog]);

  // Zero-Touch Autonomous Mesh Initializer
  useEffect(() => {
    // 1. Setup Local Broadcast Channel
    try {
      const bc = new BroadcastChannel('AAPAD_SETU_DISASTER_MESH');
      broadcastChannelRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data && event.data.senderNode !== myNodeId) {
          handleIncomingPacket(event.data);
        }
      };
    } catch (e) {}

    // 2. Initialize PeerJS with Google STUN Servers & clean error suppression
    setMeshStatus('SEARCHING');
    let peer = null;

    try {
      peer = new Peer(myNodeId, {
        config: STUN_ICE_SERVERS,
        debug: 0
      });
      peerInstanceRef.current = peer;

      peer.on('open', (id) => {
        addLog('MESH', `🌐 Zero-Touch Mesh Node online as [${id}]`);
        setMeshStatus('SEARCHING');
      });

      peer.on('connection', (incomingConn) => {
        registerConnection(incomingConn);
      });

      peer.on('error', (err) => {
        // Handle gracefully without noisy console errors
        if (err?.type === 'peer-unavailable') {
          // Expected when a candidate peer has temporarily disconnected
          return;
        }
        console.warn('Mesh signaling notice:', err?.type || err?.message || err);
      });
    } catch (e) {
      console.warn('PeerJS init fallback:', e);
    }

    // 3. Connect to live mesh signaling stream & heartbeat
    let eventSource = null;
    try {
      eventSource = new EventSource('/api/mesh/stream');
      
      const connectToDiscoveredPeers = (peerList) => {
        if (!Array.isArray(peerList) || !peerInstanceRef.current) return;
        peerList.forEach(p => {
          const peerId = p.id || p.deviceId;
          if (peerId && peerId !== myNodeId && !activeConnectionsRef.current.has(peerId)) {
            try {
              const conn = peerInstanceRef.current.connect(peerId, { reliable: true });
              registerConnection(conn);
            } catch (err) {}
          }
        });
      };

      eventSource.addEventListener('INIT_SYNC', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.peers) {
            connectToDiscoveredPeers(data.peers);
          }
          if (data.packets && Array.isArray(data.packets)) {
            data.packets.forEach(pkt => handleIncomingPacket(pkt));
          }
        } catch (err) {}
      });

      eventSource.addEventListener('PEERS_UPDATE', (e) => {
        try {
          const peers = JSON.parse(e.data);
          connectToDiscoveredPeers(peers);
        } catch (err) {}
      });

      eventSource.addEventListener('PEER_HEARTBEAT', (e) => {
        try {
          const p = JSON.parse(e.data);
          if (p && p.id && p.id !== myNodeId && !activeConnectionsRef.current.has(p.id) && peerInstanceRef.current) {
            const conn = peerInstanceRef.current.connect(p.id, { reliable: true });
            registerConnection(conn);
          }
        } catch (err) {}
      });

      eventSource.addEventListener('SOS_ALERT', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.packet && payload.packet.senderNode !== myNodeId) {
            handleIncomingPacket(payload.packet);
          }
        } catch (err) {}
      });

      eventSource.addEventListener('STATUS_UPDATE', (e) => {
        try {
          const { uuid, deviceId, status } = JSON.parse(e.data);
          setTriageRoster(prev =>
            prev.map(v => (v.id === deviceId || v.uuid === uuid || v.id === uuid ? { ...v, status } : v))
          );
        } catch (err) {}
      });
    } catch (e) {}

    // Periodic Heartbeat
    const sendHeartbeat = () => {
      try {
        fetch('/api/mesh/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: myNodeId,
            shortId: myNodeId.substring(0, 8),
            name: effectiveCallsign,
            victimName: victimName.trim() || undefined,
            role: activeRole === 'ROLE_VICTIM' ? 'VICTIM' : 'RESPONDER',
            lat: gpsLocation.lat,
            lng: gpsLocation.lng,
            accuracy: gpsLocation.accuracy,
            battery: batteryLevel,
            status: isDistressActive ? distressStatus : 'SAFE',
            isSosActive: isDistressActive
          })
        })
          .then(res => res.json())
          .catch(() => {});
      } catch (err) {}
    };

    sendHeartbeat();
    const heartbeatTimer = setInterval(sendHeartbeat, 5000);

    return () => {
      clearInterval(heartbeatTimer);
      if (eventSource) {
        eventSource.close();
      }
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
      if (peerInstanceRef.current) {
        try {
          peerInstanceRef.current.destroy();
        } catch (e) {}
      }
    };
  }, [
    myNodeId,
    activeRole,
    effectiveCallsign,
    victimName,
    gpsLocation,
    batteryLevel,
    isDistressActive,
    distressStatus,
    registerConnection,
    handleIncomingPacket,
    addLog
  ]);

  // ==========================================
  // 4. CONTINUOUS TELEMETRY TRANSMISSION (VICTIM)
  // ==========================================
  useEffect(() => {
    if (!isDistressActive) return;

    // Stream telemetry every 3 seconds across all mesh connections
    const interval = setInterval(() => {
      const packet = {
        uuid: `SOS_${myNodeId}_${Date.now()}`,
        id: myNodeId,
        callsign: effectiveCallsign,
        victimName: victimName.trim() || undefined,
        lat: gpsLocation.lat,
        lng: gpsLocation.lng,
        lon: gpsLocation.lng,
        accuracy: gpsLocation.accuracy,
        battery: batteryLevel,
        isCharging,
        status: distressStatus,
        distressMessage,
        voiceNote: voiceNoteRecorded,
        targetRole: 'RESPONDER_ONLY',
        timestamp: Date.now(),
        originNode: myNodeId
      };

      broadcastMeshPacket(packet);
    }, 3000);

    return () => clearInterval(interval);
  }, [
    isDistressActive,
    myNodeId,
    effectiveCallsign,
    victimName,
    gpsLocation,
    batteryLevel,
    isCharging,
    distressStatus,
    distressMessage,
    voiceNoteRecorded,
    broadcastMeshPacket
  ]);

  // Hold-to-SOS 3s trigger with High-Accuracy GPS Lock
  const handleHoldStart = () => {
    if (isDistressActive) return;
    setHoldProgress(0);
    setIsHoldingTrigger(true);
    setHoldingGpsAccuracy(gpsLocation.accuracy || 8);

    const acquiredSamples = [];

    // Initial benchmark fix
    bestAcquiredCoordsRef.current = {
      lat: gpsLocation.lat,
      lng: gpsLocation.lng,
      accuracy: gpsLocation.accuracy || 10,
      altitude: gpsLocation.altitude || 215
    };

    // 1. Immediately request a high-accuracy GPS fix from hardware sensors
    if (navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (
              pos?.coords &&
              isValidCoord(pos.coords.latitude) &&
              isValidCoord(pos.coords.longitude)
            ) {
              const acc = typeof pos.coords.accuracy === 'number' && isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 4.5;
              const roundedAcc = Math.round(acc * 10) / 10;
              acquiredSamples.push({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                acc: roundedAcc,
                alt: pos.coords.altitude || 215
              });
              const newCoords = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: roundedAcc,
                altitude: Math.round(pos.coords.altitude || 215)
              };

              if (!bestAcquiredCoordsRef.current || acc <= bestAcquiredCoordsRef.current.accuracy) {
                bestAcquiredCoordsRef.current = newCoords;
                setGpsLocation(newCoords);
                setHoldingGpsAccuracy(roundedAcc);
                setGpsLocked(true);
              }
            }
          },
          (err) => {
            console.warn('One-shot high accuracy GPS notice:', err);
          },
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
        );
      } catch (e) {}

      // 2. Continuous rapid high-accuracy sampling stream during the 3-second hold
      try {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (
              pos?.coords &&
              isValidCoord(pos.coords.latitude) &&
              isValidCoord(pos.coords.longitude)
            ) {
              const acc = typeof pos.coords.accuracy === 'number' && isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 4.5;
              const roundedAcc = Math.round(acc * 10) / 10;
              acquiredSamples.push({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                acc: roundedAcc,
                alt: pos.coords.altitude || 215
              });
              const newCoords = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: roundedAcc,
                altitude: Math.round(pos.coords.altitude || 215)
              };

              if (!bestAcquiredCoordsRef.current || acc <= bestAcquiredCoordsRef.current.accuracy) {
                bestAcquiredCoordsRef.current = newCoords;
                setGpsLocation(newCoords);
                setHoldingGpsAccuracy(roundedAcc);
                setGpsLocked(true);
              }
            }
          },
          (err) => {
            console.warn('Continuous hold GPS watch notice:', err);
          },
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
        );
        holdWatchIdRef.current = watchId;
      } catch (e) {}
    }

    const start = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / 3000) * 100);
      setHoldProgress(pct);
      if (pct >= 100) {
        clearInterval(holdIntervalRef.current);
        if (holdWatchIdRef.current !== null && navigator.geolocation) {
          try {
            navigator.geolocation.clearWatch(holdWatchIdRef.current);
          } catch (e) {}
          holdWatchIdRef.current = null;
        }
        setIsHoldingTrigger(false);

        // Compute high-precision centroid from acquired samples if multiple readings exist
        let finalCoords = bestAcquiredCoordsRef.current || gpsLocation;
        if (acquiredSamples.length > 1) {
          let totalWeight = 0;
          let weightedLat = 0;
          let weightedLng = 0;
          let minAcc = 999;
          acquiredSamples.forEach(s => {
            const w = 1 / Math.max(1, s.acc * s.acc);
            totalWeight += w;
            weightedLat += s.lat * w;
            weightedLng += s.lng * w;
            if (s.acc < minAcc) minAcc = s.acc;
          });

          if (totalWeight > 0) {
            const refinedAccuracy = Math.max(1.8, Math.round((minAcc * 0.75) * 10) / 10);
            finalCoords = {
              lat: weightedLat / totalWeight,
              lng: weightedLng / totalWeight,
              accuracy: refinedAccuracy,
              altitude: finalCoords.altitude || 215
            };
          }
        }

        activateDistressBeacon('TRAPPED', finalCoords);
      }
    }, 50);
  };

  const handleHoldEnd = () => {
    setIsHoldingTrigger(false);
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      setHoldProgress(0);
    }
    if (holdWatchIdRef.current !== null && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(holdWatchIdRef.current);
      } catch (e) {}
      holdWatchIdRef.current = null;
    }
  };

  const activateDistressBeacon = (status = 'TRAPPED', customCoords = null) => {
    const targetCoords = customCoords
      ? sanitizeCoords(customCoords.lat, customCoords.lng)
      : sanitizeCoords(gpsLocation.lat, gpsLocation.lng);
    const accuracy = customCoords?.accuracy ?? gpsLocation.accuracy ?? 5;
    const altitude = customCoords?.altitude ?? gpsLocation.altitude ?? 215;

    const lockedCoords = {
      lat: targetCoords.lat,
      lng: targetCoords.lng,
      accuracy,
      altitude
    };

    setGpsLocation(lockedCoords);
    setGpsLocked(true);
    setIsDistressActive(true);
    setDistressStatus(status);
    setVictimShowMap(true); // Automatically display casualty location on the map!
    unlockAudio();

    // Immediate initial broadcast with accuratest location and victim identity
    const packet = {
      uuid: `SOS_${myNodeId}_${Date.now()}`,
      id: myNodeId,
      callsign: effectiveCallsign,
      victimName: victimName.trim() || undefined,
      lat: lockedCoords.lat,
      lng: lockedCoords.lng,
      lon: lockedCoords.lng,
      accuracy: lockedCoords.accuracy,
      battery: batteryLevel,
      status,
      distressMessage,
      voiceNote: voiceNoteRecorded,
      targetRole: 'RESPONDER_ONLY',
      timestamp: Date.now(),
      originNode: myNodeId
    };

    broadcastMeshPacket(packet);
    addLog(
      'SOS',
      `🚨 DISTRESS BEACON ACTIVE! Locked accuratest GPS fix [${lockedCoords.lat.toFixed(5)}, ${lockedCoords.lng.toFixed(5)}] (±${lockedCoords.accuracy}m). Pinned on map.`
    );
  };

  const deactivateDistressBeacon = () => {
    setIsDistressActive(false);
    // Send Safe resolution broadcast
    const packet = {
      uuid: `SAFE_${myNodeId}_${Date.now()}`,
      id: myNodeId,
      callsign: effectiveCallsign,
      victimName: victimName.trim() || undefined,
      lat: gpsLocation.lat,
      lng: gpsLocation.lng,
      status: 'SAFE',
      distressMessage: 'Distress Beacon Deactivated by User. Status: SAFE.',
      targetRole: 'RESPONDER_ONLY',
      timestamp: Date.now(),
      originNode: myNodeId
    };
    broadcastMeshPacket(packet);
    addLog('SOS', `✅ Distress Beacon deactivated. Marked SAFE across mesh.`);
  };

  // Voice Keyword SOS Listener
  const toggleVoiceSosListener = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addLog('VOICE', '⚠️ Web Speech Recognition not supported on this browser.');
      return;
    }

    if (isListeningVoice) {
      setIsListeningVoice(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListeningVoice(true);
        addLog('VOICE', '🎙️ Hands-free Voice SOS listener active ("Help", "Bachao", "SOS").');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setSpeechTranscript(transcript);

        const lower = transcript.toLowerCase();
        if (lower.includes('help') || lower.includes('sos') || lower.includes('bachao') || lower.includes('emergency')) {
          setDistressMessage(`Voice Activated SOS: "${transcript.trim()}"`);
          activateDistressBeacon('CRITICAL');
          recognition.stop();
          setIsListeningVoice(false);
        }
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch (e) {
      console.warn('Speech recognition init error:', e);
    }
  };

  // Mark Victim Rescued / Update Status (Rescuer Mode)
  const handleUpdateVictimStatus = (victimId, newStatus) => {
    setTriageRoster(prev =>
      prev.map(v => (v.id === victimId || v.uuid === victimId ? { ...v, status: newStatus } : v))
    );

    // Broadcast status resolution across the mesh
    const target = triageRoster.find(v => v.id === victimId || v.uuid === victimId);
    if (target) {
      const resolutionPkt = {
        uuid: `RESOLUTION_${target.uuid || target.id}_${Date.now()}`,
        id: target.id,
        callsign: target.callsign,
        lat: target.lat,
        lng: target.lng,
        status: newStatus,
        distressMessage: `Status updated to ${newStatus} by Incident Commander`,
        targetRole: 'RESPONDER_ONLY',
        timestamp: Date.now(),
        originNode: myNodeId
      };
      broadcastMeshPacket(resolutionPkt);

      try {
        fetch('/api/mesh/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uuid: target.uuid || target.id, deviceId: target.id, status: newStatus })
        }).catch(() => {});
      } catch (e) {}

      if (newStatus === 'SAFE') {
        setNotificationMsg(`🛡️ ${target.callsign} marked SAFE and moved to Rescued list.`);
        addLog('TRIAGE', `🛡️ Casualty ${target.callsign} marked SAFE. Moved from Victims list to Rescued list.`);
      } else {
        setNotificationMsg(`📋 ${target.callsign} status updated to ${newStatus}.`);
        addLog('TRIAGE', `📋 Victim ${target.callsign} status updated to ${newStatus}.`);
      }

      setTimeout(() => {
        setNotificationMsg(prev => (prev?.includes(target.callsign) ? null : prev));
      }, 4500);
    }
  };

  // ==========================================
  // 5. LOCATE ON MAP & SPATIAL TRACKING ENGINE
  // ==========================================
  const locateVictimOnMap = useCallback((victim) => {
    if (!victim) return;
    const safeTarget = sanitizeCoords(victim.lat, victim.lng);
    const safeMe = sanitizeCoords(gpsLocation?.lat, gpsLocation?.lng);

    setSelectedVictim(victim);
    const targetId = victim.uuid || victim.id;
    setLocateHighlightId(targetId);

    // Auto-switch to MAP view if currently in Radar view
    setSpatialViewMode('MAP');

    const dist = calculateHaversine(safeMe.lat, safeMe.lng, safeTarget.lat, safeTarget.lng);

    // Auto-scale radar range if in radar view
    if (dist > 350) {
      setRadarScaleMeters(500);
    } else if (dist > 80) {
      setRadarScaleMeters(100);
    } else if (dist > 40) {
      setRadarScaleMeters(50);
    } else {
      setRadarScaleMeters(20);
    }

    // If map instance is active, smoothly fly to coordinates
    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.flyTo([safeTarget.lat, safeTarget.lng], 17, { animate: true, duration: 1.0 });
      } catch (e) {}
    }

    // Bring map container into view if on smaller screens
    if (mapContainerRef.current) {
      mapContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    addLog('MAP', `📍 Located casualty ${victim.callsign || 'TARGET'} on map (${dist.toFixed(0)}m away at [${safeTarget.lat.toFixed(4)}, ${safeTarget.lng.toFixed(4)}])`);

    // Retain highlight reticle for 6 seconds
    setTimeout(() => {
      setLocateHighlightId(prev => (prev === targetId ? null : prev));
    }, 6000);
  }, [gpsLocation, addLog]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (activeRole !== 'ROLE_RESPONDER') return;
    if (spatialViewMode !== 'MAP') return;
    if (!mapContainerRef.current) return;

    const safeCenter = sanitizeCoords(gpsLocation?.lat, gpsLocation?.lng);

    // If an existing map exists on a different or stale container, clean it up
    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.remove();
      } catch (e) {}
      leafletMapRef.current = null;
      markersGroupRef.current = null;
    }

    try {
      const map = L.map(mapContainerRef.current, {
        center: [safeCenter.lat, safeCenter.lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        className: 'tactical-tiles'
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersGroupRef.current = markersLayer;
      leafletMapRef.current = map;

      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (e) {}
      }, 150);
    } catch (e) {
      console.warn('Leaflet init notice:', e);
    }

    return () => {
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
        } catch (e) {}
        leafletMapRef.current = null;
        markersGroupRef.current = null;
      }
    };
  }, [activeRole, spatialViewMode]);

  // Sync Leaflet Map Markers & Polyline
  useEffect(() => {
    if (!leafletMapRef.current || !markersGroupRef.current) return;
    const markersLayer = markersGroupRef.current;
    markersLayer.clearLayers();

    const rescuerPos = sanitizeCoords(gpsLocation?.lat, gpsLocation?.lng);

    // 1. Rescuer Location Marker (Cyan Pulse)
    try {
      const rescuerHtml = `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <span class="absolute w-8 h-8 rounded-full bg-cyan-500/30 animate-ping"></span>
          <span class="relative w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-lg"></span>
          <span class="absolute top-5 bg-[#0b101c] text-cyan-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-cyan-800/80 whitespace-nowrap shadow-md">YOU (Rescuer)</span>
        </div>
      `;
      const rescuerIcon = L.divIcon({
        className: 'rescuer-marker',
        html: rescuerHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      L.marker([rescuerPos.lat, rescuerPos.lng], { icon: rescuerIcon }).addTo(markersLayer);
    } catch (e) {}

    // 2. Casualty Markers (Victims & Rescued)
    triageRoster.forEach(v => {
      try {
        const vCoords = sanitizeCoords(v.lat, v.lng);
        const isSelected = selectedVictim?.id === v.id || selectedVictim?.uuid === v.uuid;
        const isHighlighted = locateHighlightId === (v.uuid || v.id);
        const isSafe = v.status === 'SAFE';
        const isInjured = v.status === 'INJURED';

        const colorClass = isSafe ? 'bg-emerald-500' : isInjured ? 'bg-amber-500' : 'bg-red-500';
        const badgeClass = isSafe
          ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800'
          : isInjured
          ? 'bg-amber-950/90 text-amber-300 border-amber-800'
          : 'bg-red-950/90 text-red-300 border-red-800';

        const dist = calculateHaversine(rescuerPos.lat, rescuerPos.lng, vCoords.lat, vCoords.lng);
        const displayName = v.victimName || (v.callsign && v.callsign.includes('(') ? v.callsign.split('(')[0].trim() : v.callsign) || 'CASUALTY';

        const markerHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer">
            ${isHighlighted ? `<span class="absolute w-12 h-12 rounded-full border-2 border-cyan-400 animate-ping"></span>` : ''}
            ${!isSafe ? `<span class="absolute w-7 h-7 rounded-full ${colorClass} opacity-30 animate-pulse"></span>` : ''}
            <span class="relative w-4 h-4 rounded-full ${colorClass} border-2 ${isSelected ? 'border-cyan-300 scale-125' : 'border-white'} shadow-lg transition-transform"></span>
            <div class="absolute top-5 flex flex-col items-center pointer-events-none">
              <span class="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border whitespace-nowrap shadow-md ${badgeClass}">
                ${displayName} (${dist.toFixed(0)}m)
              </span>
            </div>
          </div>
        `;

        const markerIcon = L.divIcon({
          className: 'victim-marker',
          html: markerHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const m = L.marker([vCoords.lat, vCoords.lng], { icon: markerIcon }).addTo(markersLayer);
        m.on('click', () => {
          locateVictimOnMap(v);
        });
      } catch (e) {}
    });

    // 3. Polyline to Selected Target (Only if in danger)
    if (selectedVictim && selectedVictim.status !== 'SAFE') {
      try {
        const targetCoords = sanitizeCoords(selectedVictim.lat, selectedVictim.lng);
        const line = L.polyline(
          [
            [rescuerPos.lat, rescuerPos.lng],
            [targetCoords.lat, targetCoords.lng]
          ],
          {
            color: '#06b6d4',
            weight: 2.5,
            dashArray: '6, 8',
            opacity: 0.85
          }
        );
        line.addTo(markersLayer);
      } catch (e) {}
    }
  }, [gpsLocation, triageRoster, selectedVictim, locateHighlightId, locateVictimOnMap]);

  // ==========================================
  // 5B. VICTIM LOCAL CASUALTY MAP (LEAFLET)
  // ==========================================
  useEffect(() => {
    if (activeRole !== 'ROLE_VICTIM') return;
    if (!isDistressActive && !victimShowMap) return;
    if (!victimMapContainerRef.current) return;

    const safeCenter = sanitizeCoords(gpsLocation?.lat, gpsLocation?.lng);

    if (victimLeafletMapRef.current) {
      try {
        victimLeafletMapRef.current.remove();
      } catch (e) {}
      victimLeafletMapRef.current = null;
      victimMarkersGroupRef.current = null;
    }

    try {
      const map = L.map(victimMapContainerRef.current, {
        center: [safeCenter.lat, safeCenter.lng],
        zoom: 17,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        className: 'tactical-tiles'
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      victimMarkersGroupRef.current = markersLayer;
      victimLeafletMapRef.current = map;

      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (e) {}
      }, 150);
    } catch (e) {
      console.warn('Victim map init notice:', e);
    }

    return () => {
      if (victimLeafletMapRef.current) {
        try {
          victimLeafletMapRef.current.remove();
        } catch (e) {}
        victimLeafletMapRef.current = null;
        victimMarkersGroupRef.current = null;
      }
    };
  }, [activeRole, isDistressActive, victimShowMap]);

  // Sync Victim Local Map Markers & Accuracy Confidence Halo
  useEffect(() => {
    if (!victimLeafletMapRef.current || !victimMarkersGroupRef.current) return;
    const markersLayer = victimMarkersGroupRef.current;
    markersLayer.clearLayers();

    const mePos = sanitizeCoords(gpsLocation?.lat, gpsLocation?.lng);

    // 1. High-Precision Accuracy Confidence Halo
    try {
      const radiusMeters = Math.max(
        5,
        typeof gpsLocation.accuracy === 'number' && isFinite(gpsLocation.accuracy) ? gpsLocation.accuracy : 8
      );
      L.circle([mePos.lat, mePos.lng], {
        radius: radiusMeters,
        color: isDistressActive ? '#ef4444' : '#06b6d4',
        fillColor: isDistressActive ? '#ef4444' : '#06b6d4',
        fillOpacity: 0.18,
        weight: 1.5,
        dashArray: '4, 4'
      }).addTo(markersLayer);
    } catch (e) {}

    // 2. High-Accuracy Casualty Pin
    try {
      const pinColor = isDistressActive ? 'bg-red-500' : 'bg-cyan-400';
      const pingColor = isDistressActive ? 'bg-red-500/40' : 'bg-cyan-500/40';
      const borderTheme = isDistressActive
        ? 'bg-red-950/90 text-red-300 border-red-700'
        : 'bg-[#0b101c] text-cyan-300 border-cyan-800';

      const markerHtml = `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <span class="absolute w-12 h-12 rounded-full ${pingColor} animate-ping"></span>
          <span class="relative w-4 h-4 rounded-full ${pinColor} border-2 border-white shadow-xl"></span>
          <div class="absolute top-5 flex flex-col items-center pointer-events-none">
            <span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded border whitespace-nowrap shadow-lg ${borderTheme}">
              ${effectiveCallsign} (±${gpsLocation.accuracy || 5}m)
            </span>
          </div>
        </div>
      `;

      const victimIcon = L.divIcon({
        className: 'victim-own-marker',
        html: markerHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.marker([mePos.lat, mePos.lng], { icon: victimIcon }).addTo(markersLayer);
    } catch (e) {}
  }, [gpsLocation, isDistressActive, victimShowMap, effectiveCallsign]);

  // Simulate Drill Casualty (Instant Testing / Verification)
  const simulateDrillVictim = useCallback(() => {
    const baseCoords = sanitizeCoords(gpsLocation?.lat, gpsLocation?.lng);
    const angle = Math.random() * Math.PI * 2;
    const distanceMeters = 35 + Math.random() * 50;
    const latOffset = (distanceMeters * Math.cos(angle)) / 111111;
    const lngOffset = (distanceMeters * Math.sin(angle)) / (111111 * Math.cos((baseCoords.lat * Math.PI) / 180));

    const sampleNames = [
      'Aarav Sharma',
      'Pooja Verma',
      'Rohan Kulkarni',
      'Sneha Nair',
      'Vikram Sengupta',
      'Ananya Joshi'
    ];
    const drillName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
    const drillId = 'DRILL_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const drillCallsign = `${drillName} (${drillId})`;
    const safeTargetCoords = sanitizeCoords(baseCoords.lat + latOffset, baseCoords.lng + lngOffset);
    const drillPkt = {
      uuid: `SOS_${drillId}_${Date.now()}`,
      id: drillId,
      callsign: drillCallsign,
      victimName: drillName,
      lat: safeTargetCoords.lat,
      lng: safeTargetCoords.lng,
      lon: safeTargetCoords.lng,
      accuracy: 3.2,
      battery: Math.floor(30 + Math.random() * 55),
      status: 'TRAPPED',
      distressMessage: 'Emergency drill: Structural debris collapse, victim trapped.',
      targetRole: 'RESPONDER_ONLY',
      timestamp: Date.now(),
      hopCount: 1,
      originNode: drillId
    };

    handleIncomingPacket(drillPkt);
    addLog('DRILL', `🎯 Drill casualty simulated: ${drillCallsign} (${distanceMeters.toFixed(0)}m away)`);
  }, [gpsLocation, handleIncomingPacket, addLog]);

  // ==========================================
  // 6. RADAR & TRIAGE METRICS COMPUTATION
  // ==========================================
  // Active unrescued casualties
  const activeVictimsList = useMemo(() => {
    return triageRoster.filter(v => v.status !== 'SAFE');
  }, [triageRoster]);

  // Rescued casualties
  const rescuedList = useMemo(() => {
    return triageRoster.filter(v => v.status === 'SAFE');
  }, [triageRoster]);

  // Filtered active victims (ALL, CRITICAL, INJURED)
  const displayedActiveVictims = useMemo(() => {
    if (victimSubFilter === 'CRITICAL') {
      return activeVictimsList.filter(v => v.status === 'TRAPPED' || v.status === 'CRITICAL');
    }
    if (victimSubFilter === 'INJURED') {
      return activeVictimsList.filter(v => v.status === 'INJURED');
    }
    return activeVictimsList;
  }, [activeVictimsList, victimSubFilter]);

  const triageCounts = useMemo(() => {
    const critical = triageRoster.filter(v => v.status === 'TRAPPED' || v.status === 'CRITICAL').length;
    const injured = triageRoster.filter(v => v.status === 'INJURED').length;
    const safe = rescuedList.length;
    const active = activeVictimsList.length;
    return { critical, injured, safe, active, total: triageRoster.length };
  }, [triageRoster, rescuedList, activeVictimsList]);

  // Victims strictly in danger (TRAPPED, CRITICAL, INJURED - NOT SAFE)
  const endangeredVictims = useMemo(() => {
    return triageRoster.filter(
      v => v.status !== 'SAFE' && (v.status === 'TRAPPED' || v.status === 'CRITICAL' || v.status === 'INJURED')
    );
  }, [triageRoster]);

  // Selected or Active Target for Radar Display (STRICTLY ONLY in danger)
  const currentRadarTarget = useMemo(() => {
    if (
      selectedVictim &&
      selectedVictim.status !== 'SAFE' &&
      (selectedVictim.status === 'TRAPPED' || selectedVictim.status === 'CRITICAL' || selectedVictim.status === 'INJURED')
    ) {
      return selectedVictim;
    }
    return endangeredVictims[0] || null;
  }, [selectedVictim, endangeredVictims]);

  const currentTargetDistance = currentRadarTarget
    ? calculateHaversine(gpsLocation.lat, gpsLocation.lng, currentRadarTarget.lat, currentRadarTarget.lng)
    : 0;
  const currentTargetBearing = currentRadarTarget
    ? calculateBearing(gpsLocation.lat, gpsLocation.lng, currentRadarTarget.lat, currentRadarTarget.lng)
    : 0;

  // Relative Bearing based on Gyroscope Heading
  const relativeTargetBearing = (currentTargetBearing - compassHeading + 360) % 360;

  // ==========================================
  // RENDER UI: HIGH-CONTRAST TACTICAL DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 flex flex-col font-sans select-none pb-12">
      {/* 1. TOP WEB AUDIO AUTOPLAY GUARD BANNER */}
      {!audioUnlocked && (
        <div
          id="audio-unlock-banner"
          onClick={unlockAudio}
          className="bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-white text-xs sm:text-sm font-extrabold px-4 py-2.5 flex items-center justify-between shadow-xl cursor-pointer hover:opacity-95 transition sticky top-0 z-50 animate-pulse"
        >
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-white animate-bounce" />
            <span>🔊 TAP ANYWHERE TO ACTIVATE EMERGENCY RADAR &amp; SONAR SYNTHESIZER</span>
          </div>
          <span className="bg-black/40 px-2.5 py-0.5 rounded text-[11px] uppercase tracking-wider font-mono border border-white/30">
            Click to Enable
          </span>
        </div>
      )}

      {/* 2. PERSISTENT MESH STATUS & HEALTH HEADER */}
      <header className="bg-[#0e1424] border-b border-slate-800 px-4 py-3 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Node Identity */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 text-white shadow-lg shadow-red-950/60">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-wide text-white">
                  आपद सेतु <span className="text-xs text-red-400 font-mono">Aapad Setu</span>
                </h1>
                <span className="bg-red-950/80 border border-red-700/60 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  OFFLINE P2P
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>Node: <strong className="text-cyan-400">{myNodeId}</strong></span>
                <span>•</span>
                <span>Identity: <strong className="text-amber-400">{effectiveCallsign}</strong></span>
              </div>
            </div>
          </div>

          {/* Real-time Mesh Health Pill */}
          <div className="flex items-center gap-3 bg-[#141b30] border border-slate-700/70 px-3 py-1.5 rounded-xl text-xs font-mono">
            <div className="flex items-center gap-1.5">
              {meshStatus === 'CONNECTED' ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-emerald-400 font-bold">CONNECTED</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-amber-400 font-bold">SEARCHING PEERS</span>
                </>
              )}
            </div>
            <span className="text-slate-500">|</span>
            <div className="flex items-center gap-1 text-slate-300">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span><strong>{connectedPeers.length}</strong> Peers Active</span>
            </div>
            <span className="text-slate-500">|</span>
            <div className="flex items-center gap-1 text-slate-300">
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
              <span>{batteryLevel}%</span>
            </div>
          </div>

          {/* ROLE SELECTOR NAVIGATION TABS */}
          <div className="flex items-center bg-[#070a14] p-1 rounded-xl border border-slate-800">
            <button
              id="tab-victim-mode"
              onClick={() => setActiveRole('ROLE_VICTIM')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeRole === 'ROLE_VICTIM'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/80'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <LifeBuoy className="w-4 h-4" />
              <span>I Need Help</span>
            </button>

            <button
              id="tab-responder-mode"
              onClick={() => {
                setActiveRole('ROLE_RESPONDER');
                unlockAudio();
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeRole === 'ROLE_RESPONDER'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/80'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Navigation className="w-4 h-4" />
              <span>Rescuer Dashboard</span>
              {triageCounts.critical > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black animate-pulse">
                  {triageCounts.critical}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1 flex flex-col">
        {/* ========================================================================= */}
        {/* VIEW A: VICTIM MODE (ROLE_VICTIM)                                         */}
        {/* ========================================================================= */}
        {activeRole === 'ROLE_VICTIM' && (
          <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full space-y-6">
            {/* CIVILIAN IDENTITY & PRIOR NAME REGISTRATION CARD */}
            <div className="bg-[#0e1424] border border-slate-800/90 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-800 text-cyan-400">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">
                      Civilian Identity Profile
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Enter your name prior to emergency so search & rescue teams can identify you immediately.
                    </p>
                  </div>
                </div>
                {victimName.trim() && (
                  <span className="bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    <span>Registered</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    id="input-victim-name"
                    type="text"
                    value={victimName}
                    onChange={(e) => handleUpdateVictimName(e.target.value)}
                    placeholder="Enter your full name (e.g. Priya Sharma, David Miller)..."
                    className="w-full bg-[#070a14] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans shadow-inner pr-8"
                  />
                  {victimName && (
                    <button
                      onClick={() => handleUpdateVictimName('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                      title="Clear name"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono pt-1 text-slate-400 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <span>Rescue Dispatch Identity:</span>
                  <strong className="text-amber-400 font-bold">{effectiveCallsign}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-slate-500">Hardware Node:</span>
                  <span className="text-cyan-400">{myNodeId}</span>
                </div>
              </div>
            </div>

            {/* DISTRESS ACTIVE BANNER / TRANSMITTING STATE */}
            {isDistressActive ? (
              <div className="bg-[#1c0d12] border-2 border-red-600 rounded-3xl p-6 text-center relative overflow-hidden shadow-2xl shadow-red-950/80">
                {/* Tactical Pulsing Ring */}
                <div className="absolute inset-0 bg-red-600/10 animate-pulse pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-red-600/20 border-2 border-red-500 flex items-center justify-center animate-ping">
                    <Radio className="w-10 h-10 text-red-500" />
                  </div>

                  <div>
                    <span className="bg-red-600 text-white text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      DISTRESS BEACON TRANSMITTING
                    </span>
                    <h2 className="text-2xl font-black text-white mt-2">
                      SOS Mesh Broadcast Active
                    </h2>
                    <p className="text-xs text-red-300 font-mono mt-1">
                      Continuous telemetry streaming every 3 seconds across {connectedPeers.length} peer nodes
                    </p>
                  </div>

                  {/* Telemetry Matrix Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full bg-[#0a0608] border border-red-900/60 rounded-2xl p-4 text-left font-mono text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">STATUS</span>
                      <strong className="text-red-400 font-bold">{distressStatus}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">GPS LOCK</span>
                      <strong className="text-emerald-400 font-bold">
                        {gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">BATTERY</span>
                      <strong className="text-amber-400 font-bold">{batteryLevel}%</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">PACKETS RELAYED</span>
                      <strong className="text-cyan-400 font-bold">{packetsSentCount}</strong>
                    </div>
                  </div>

                  {/* Interactive Live Casualty Location Map */}
                  <div className="w-full bg-[#0a0608] border border-red-900/70 rounded-2xl p-3 flex flex-col space-y-2 shadow-xl text-left">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-400">
                        <MapIcon className="w-4 h-4 text-red-500" />
                        <span>Accuratest Pinned Casualty Location (Mesh Broadcast)</span>
                      </div>
                      <span className="text-[10px] font-mono bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded-full">
                        ±{gpsLocation.accuracy || 5}m Confidence Halo
                      </span>
                    </div>

                    {/* Leaflet Map Canvas */}
                    <div
                      ref={victimMapContainerRef}
                      className="w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-red-950/80 relative shadow-inner"
                    />

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1 pt-0.5">
                      <span>Coordinates: [{gpsLocation.lat.toFixed(5)}, {gpsLocation.lng.toFixed(5)}]</span>
                      <button
                        onClick={() => {
                          if (victimLeafletMapRef.current) {
                            victimLeafletMapRef.current.flyTo([gpsLocation.lat, gpsLocation.lng], 18, { animate: true });
                          }
                        }}
                        className="text-cyan-400 hover:text-cyan-300 underline text-[11px] font-bold"
                      >
                        Center on My Beacon
                      </button>
                    </div>
                  </div>

                  {/* Safety Message Input */}
                  <div className="w-full text-left">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Situation Notes (Relayed to Rescuers):
                    </label>
                    <input
                      type="text"
                      value={distressMessage}
                      onChange={e => setDistressMessage(e.target.value)}
                      className="w-full bg-[#111728] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  {/* Cancel / Safe Button */}
                  <button
                    id="btn-cancel-distress"
                    onClick={deactivateDistressBeacon}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-600/40 font-bold py-3.5 rounded-2xl text-sm transition flex items-center justify-center gap-2 shadow-lg"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>I Am Safe / Cancel Distress Beacon</span>
                  </button>
                </div>
              </div>
            ) : (
              /* HOLD FOR SOS ACTIVATION CONTROLLER */
              <div className="bg-[#0e1424] border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center space-y-6 shadow-xl">
                <div>
                  <span className="bg-slate-800 text-slate-400 text-xs font-mono uppercase px-3 py-1 rounded-full">
                    Zero-Touch Emergency Distress
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
                    Emergency Beacon Trigger
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1">
                    Hold the button below for 3 seconds or speak a distress keyword. While holding, your accuratest GPS fix is calculated and locked.
                  </p>
                </div>

                {/* 3-Second Hold SOS Circular Button */}
                <div className="relative flex items-center justify-center">
                  <svg className="w-52 h-52 -rotate-90 transform">
                    <circle
                      cx="104"
                      cy="104"
                      r="90"
                      stroke="#1e293b"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="104"
                      cy="104"
                      r="90"
                      stroke="#ef4444"
                      strokeWidth="10"
                      strokeDasharray="565.48"
                      strokeDashoffset={565.48 - (565.48 * holdProgress) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-75"
                    />
                  </svg>

                  <button
                    id="btn-hold-sos"
                    onMouseDown={handleHoldStart}
                    onMouseUp={handleHoldEnd}
                    onTouchStart={handleHoldStart}
                    onTouchEnd={handleHoldEnd}
                    className={`absolute w-40 h-40 rounded-full font-black text-xl flex flex-col items-center justify-center shadow-2xl shadow-red-950 transition active:scale-95 ${
                      isHoldingTrigger
                        ? 'bg-gradient-to-br from-red-500 via-amber-600 to-red-700 text-white scale-105 ring-4 ring-amber-400/60'
                        : 'bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white'
                    }`}
                  >
                    <Flame className={`w-8 h-8 mb-1 ${isHoldingTrigger ? 'animate-bounce text-amber-200' : ''}`} />
                    <span>{isHoldingTrigger ? `HOLD ${Math.round(holdProgress)}%` : 'HOLD FOR SOS'}</span>
                    <span className="text-[10px] text-red-200 font-mono mt-0.5">
                      {isHoldingTrigger ? 'LOCKING GPS...' : '3 SECONDS'}
                    </span>
                  </button>
                </div>

                {/* Live Real-time Triangulation Feedback during hold */}
                {isHoldingTrigger && (
                  <div className="w-full bg-[#180a0e] border border-amber-500/80 rounded-2xl p-3.5 text-center flex flex-col items-center justify-center space-y-1.5 shadow-lg shadow-red-950/60 animate-pulse">
                    <div className="flex items-center gap-2 text-xs font-mono text-amber-300 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                      <span>🛰️ Triangulating Accuratest GPS Location...</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono">
                      <span className="text-slate-300">
                        Accuracy: <strong className="text-emerald-400 font-black">±{holdingGpsAccuracy || gpsLocation.accuracy || 5}m</strong>
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-400">
                        Lat: <strong className="text-white">{gpsLocation.lat.toFixed(5)}</strong>
                      </span>
                      <span className="text-slate-400">
                        Lng: <strong className="text-white">{gpsLocation.lng.toFixed(5)}</strong>
                      </span>
                    </div>
                  </div>
                )}

                {/* Location Map Preview Toggle & Interactive Map */}
                <div className="w-full">
                  <button
                    id="btn-toggle-victim-map"
                    onClick={() => setVictimShowMap(prev => !prev)}
                    className="w-full bg-[#111728] hover:bg-[#161f36] text-cyan-400 border border-cyan-800/60 rounded-2xl py-2.5 px-4 text-xs font-mono font-bold flex items-center justify-between transition shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <MapIcon className="w-4 h-4 text-cyan-400" />
                      <span>{victimShowMap ? 'Hide Location Map' : '🗺️ Preview My Location on Map'}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      GPS: [{gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)}]
                    </span>
                  </button>

                  {victimShowMap && (
                    <div className="mt-2.5 bg-[#090d18] border border-cyan-900/60 rounded-2xl p-3 flex flex-col space-y-2 shadow-xl text-left">
                      <div className="flex items-center justify-between text-xs font-mono px-1">
                        <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                          GPS Confidence Halo: ±{gpsLocation.accuracy || 8}m
                        </span>
                        <button
                          onClick={() => {
                            if (victimLeafletMapRef.current) {
                              victimLeafletMapRef.current.flyTo([gpsLocation.lat, gpsLocation.lng], 17, { animate: true });
                            }
                          }}
                          className="text-cyan-400 hover:text-cyan-300 text-[11px] underline font-bold"
                        >
                          Center on Pin
                        </button>
                      </div>
                      <div
                        ref={victimMapContainerRef}
                        className="w-full h-56 sm:h-64 rounded-xl overflow-hidden border border-slate-800 relative shadow-inner"
                      />
                    </div>
                  )}
                </div>

                {/* Quick Status Category Selectors */}
                <div className="w-full">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Select Triage Category:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'TRAPPED', label: 'Trapped / Debris', color: 'border-red-600 bg-red-950/40 text-red-400' },
                      { key: 'INJURED', label: 'Severe Injury', color: 'border-amber-600 bg-amber-950/40 text-amber-400' },
                      { key: 'CRITICAL', label: 'Life Critical', color: 'border-purple-600 bg-purple-950/40 text-purple-400' }
                    ].map(st => (
                      <button
                        key={st.key}
                        onClick={() => activateDistressBeacon(st.key)}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${st.color} hover:brightness-125`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>{st.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hands-Free Voice SOS Trigger */}
                <div className="w-full bg-[#141b30] border border-slate-700/70 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Mic className="w-4 h-4 text-cyan-400" />
                      <span>Hands-Free Voice SOS Listener</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Say "Help", "Bachao", or "Emergency" to auto-broadcast
                    </p>
                    {speechTranscript && (
                      <p className="text-xs text-amber-300 font-mono mt-1">"{speechTranscript}"</p>
                    )}
                  </div>
                  <button
                    id="btn-voice-sos"
                    onClick={toggleVoiceSosListener}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      isListeningVoice
                        ? 'bg-red-600 text-white animate-pulse'
                        : 'bg-slate-800 text-cyan-400 hover:bg-slate-700'
                    }`}
                  >
                    {isListeningVoice ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    <span>{isListeningVoice ? 'LISTENING...' : 'ACTIVATE MIC'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mesh Store-and-Forward Telemetry Info */}
            <div className="bg-[#0b101c] border border-slate-800/80 rounded-2xl p-4 text-xs font-mono text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Store-and-Forward Mesh Relay: <strong>ACTIVE (Silent Background Mode)</strong></span>
              </div>
              <span className="text-slate-500">TTL 10 Hops</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW B: RESCUER DASHBOARD (ROLE_RESPONDER)                                 */}
        {/* ========================================================================= */}
        {activeRole === 'ROLE_RESPONDER' && (
          <div className="flex-1 flex flex-col space-y-6">
            {/* AREA TRIAGE METRICS BANNER */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#160c10] border border-red-900/60 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400 uppercase">Critical / Trapped</span>
                  <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                </div>
                <div className="text-3xl font-black text-white mt-1">{triageCounts.critical}</div>
                <span className="text-[11px] text-red-400/80 font-mono">Immediate Extraction</span>
              </div>

              <div className="bg-[#171109] border border-amber-900/60 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase">Injured Persons</span>
                  <Activity className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-3xl font-black text-white mt-1">{triageCounts.injured}</div>
                <span className="text-[11px] text-amber-400/80 font-mono">Medical Aid Required</span>
              </div>

              <div className="bg-[#0a1713] border border-emerald-900/60 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase">Rescued / Safe</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-3xl font-black text-white mt-1">{triageCounts.safe}</div>
                <span className="text-[11px] text-emerald-400/80 font-mono">Evacuated / Stabilized</span>
              </div>

              <div className="bg-[#0f1424] border border-indigo-900/60 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400 uppercase">Active Mesh Nodes</span>
                  <Radio className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-3xl font-black text-white mt-1">{connectedPeers.length + 1}</div>
                <span className="text-[11px] text-indigo-400/80 font-mono">P2P STUN WebRTC</span>
              </div>
            </div>

            {/* NOTIFICATION FEEDBACK BANNER */}
            {notificationMsg && (
              <div className="bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 px-4 py-2.5 rounded-2xl text-xs font-mono font-bold flex items-center justify-between shadow-lg shadow-emerald-950/60 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{notificationMsg}</span>
                </div>
                <button
                  onClick={() => setNotificationMsg(null)}
                  className="text-emerald-400 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-emerald-900/60"
                >
                  ✕
                </button>
              </div>
            )}

            {/* TWO-COLUMN TACTICAL VIEW: SPATIAL NAVIGATOR (MAP/RADAR) + TRIAGE ROSTER */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
              {/* LEFT COLUMN: TACTICAL SPATIAL NAVIGATOR (DUAL MAP / GYRO RADAR) */}
              <div className="lg:col-span-6 bg-[#0e1424] border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl space-y-3">
                {/* Spatial View Header & Switcher Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[#070a14] p-1 rounded-xl border border-slate-800">
                      <button
                        id="tab-view-map"
                        onClick={() => setSpatialViewMode('MAP')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition font-mono ${
                          spatialViewMode === 'MAP'
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <MapIcon className="w-3.5 h-3.5" />
                        <span>Tactical Map</span>
                      </button>
                      <button
                        id="tab-view-radar"
                        onClick={() => setSpatialViewMode('RADAR')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition font-mono ${
                          spatialViewMode === 'RADAR'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Gyro Radar</span>
                      </button>
                    </div>
                  </div>

                  {/* Context Actions depending on Map or Radar */}
                  <div className="flex items-center gap-2">
                    {spatialViewMode === 'MAP' ? (
                      <>
                        <button
                          id="btn-map-center-me"
                          onClick={() => {
                            if (leafletMapRef.current) {
                              const mePos = sanitizeCoords(gpsLocation?.lat, gpsLocation?.lng);
                              leafletMapRef.current.flyTo([mePos.lat, mePos.lng], 16, { animate: true });
                            }
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-700 font-mono flex items-center gap-1"
                          title="Center Map on Rescuer"
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>Center You</span>
                        </button>
                        {selectedVictim && (
                          <button
                            id="btn-map-center-victim"
                            onClick={() => locateVictimOnMap(selectedVictim)}
                            className="bg-cyan-900/80 hover:bg-cyan-800 text-cyan-200 text-[10px] font-bold px-2 py-1 rounded-lg border border-cyan-700 font-mono flex items-center gap-1"
                            title="Center Map on Selected Casualty"
                          >
                            <MapPin className="w-3 h-3 text-cyan-400" />
                            <span>Locate Target</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {!gyroActive && (
                          <button
                            id="btn-enable-gyro"
                            onClick={requestGyroPermission}
                            className="bg-indigo-900/80 hover:bg-indigo-800 text-indigo-300 text-[10px] font-bold px-2 py-1 rounded-lg border border-indigo-700 flex items-center gap-1 font-mono"
                          >
                            <Compass className="w-3 h-3" />
                            <span>Enable Gyro</span>
                          </button>
                        )}
                        <button
                          id="btn-toggle-radar-mode"
                          onClick={() =>
                            setRadarHeadingMode(prev => (prev === 'HEAD_UP' ? 'NORTH_UP' : 'HEAD_UP'))
                          }
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-700 font-mono"
                        >
                          {radarHeadingMode === 'HEAD_UP' ? '🧭 HEAD-UP' : '🗺️ NORTH-UP'}
                        </button>
                        <button
                          id="btn-toggle-sonar-mute"
                          onClick={() => setIsSonarMuted(prev => !prev)}
                          className={`p-1.5 rounded-lg border text-xs ${
                            isSonarMuted
                              ? 'bg-red-950/80 border-red-800 text-red-400'
                              : 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
                          }`}
                          title="Toggle Web Audio Sonar Ping"
                        >
                          {isSonarMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* SPATIAL CANVAS CONTAINER */}
                <div className="relative flex-1 min-h-[340px] sm:min-h-[380px] rounded-2xl overflow-hidden border border-slate-800 bg-[#070a12] flex flex-col justify-center">
                  {spatialViewMode === 'MAP' ? (
                    /* 1. INTERACTIVE TACTICAL LEAFLET MAP */
                    <div className="relative w-full h-full flex-1 min-h-[340px] sm:min-h-[380px]">
                      <div ref={mapContainerRef} className="w-full h-full min-h-[340px] sm:min-h-[380px] z-10" />

                      {/* Overlaid Target Lock HUD Pill on Map */}
                      {currentRadarTarget && (
                        <div className="absolute top-2 left-2 z-20 bg-[#080d1a]/90 backdrop-blur-md border border-cyan-600/70 text-white rounded-xl px-3 py-1.5 font-mono text-xs shadow-lg pointer-events-none flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                          <span>
                            Target: <strong className="text-cyan-300">{currentRadarTarget.victimName ? `${currentRadarTarget.victimName} (${currentRadarTarget.callsign})` : currentRadarTarget.callsign}</strong> ({currentTargetDistance.toFixed(1)}m away)
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* 2. 360° SVG GYRO COMPASS RADAR CANVAS */
                    <div className="relative flex items-center justify-center py-2 flex-1">
                      <div className="w-68 h-68 sm:w-80 sm:h-80 relative flex items-center justify-center">
                        <svg className="w-full h-full" viewBox="0 0 320 320">
                          {/* Dark Radar Background */}
                          <circle cx="160" cy="160" r="150" fill="#090d18" stroke="#1e293b" strokeWidth="2" />

                          {/* Concentric Range Rings */}
                          <circle cx="160" cy="160" r="120" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
                          <circle cx="160" cy="160" r="80" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
                          <circle cx="160" cy="160" r="40" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />

                          {/* Crosshairs */}
                          <line x1="160" y1="10" x2="160" y2="310" stroke="#1e293b" strokeWidth="1" />
                          <line x1="10" y1="160" x2="310" y2="160" stroke="#1e293b" strokeWidth="1" />

                          {/* Cardinal Direction Markers */}
                          <text x="160" y="24" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            {radarHeadingMode === 'HEAD_UP' ? 'AHD' : 'N'}
                          </text>
                          <text x="304" y="164" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">E</text>
                          <text x="160" y="306" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">S</text>
                          <text x="16" y="164" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">W</text>

                          {/* Animated Radar Sweep Beam */}
                          <g transform={`rotate(${compassHeading} 160 160)`}>
                            <line x1="160" y1="160" x2="160" y2="10" stroke="#06b6d4" strokeWidth="2" strokeOpacity="0.8" />
                          </g>

                          {/* Rescuer Center Blip */}
                          <circle cx="160" cy="160" r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />

                          {/* PLOTTED CASUALTY VICTIM BLIPS (STRICTLY ONLY VICTIMS IN DANGER) */}
                          {endangeredVictims.length === 0 ? (
                            <g>
                              {/* Green sector clear indicator when no casualties are in danger */}
                              <circle cx="160" cy="160" r="36" fill="#10b981" fillOpacity="0.08" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />
                              <text x="160" y="200" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                                ALL SECTORS CLEAR
                              </text>
                              <text x="160" y="214" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
                                No Endangered Victims Nearby
                              </text>
                            </g>
                          ) : (
                            endangeredVictims.map(victim => {
                              const dist = calculateHaversine(gpsLocation.lat, gpsLocation.lng, victim.lat, victim.lng);
                              const bearing = calculateBearing(gpsLocation.lat, gpsLocation.lng, victim.lat, victim.lng);
                              const relAngle =
                                radarHeadingMode === 'HEAD_UP'
                                  ? (bearing - compassHeading + 360) % 360
                                  : bearing;

                              const clampedR = Math.min(140, (dist / radarScaleMeters) * 140);
                              const rad = ((relAngle - 90) * Math.PI) / 180;
                              const x = 160 + clampedR * Math.cos(rad);
                              const y = 160 + clampedR * Math.sin(rad);

                              const isSelected = selectedVictim?.id === victim.id || selectedVictim?.uuid === victim.uuid;
                              const isHighlighted = locateHighlightId === (victim.uuid || victim.id);
                              const blipColor = victim.status === 'INJURED' ? '#f59e0b' : '#ef4444';
                              const displayName = victim.victimName || (victim.callsign && victim.callsign.includes('(') ? victim.callsign.split('(')[0].trim() : victim.callsign);

                              return (
                                <g
                                  key={victim.uuid || victim.id}
                                  transform={`translate(${x}, ${y})`}
                                  onClick={() => locateVictimOnMap(victim)}
                                  className="cursor-pointer"
                                >
                                  {isHighlighted && (
                                    <circle r="14" fill="none" stroke="#22d3ee" strokeWidth="2" className="animate-ping" />
                                  )}
                                  <circle
                                    r={isSelected ? 8 : 5}
                                    fill={blipColor}
                                    stroke="#ffffff"
                                    strokeWidth={isSelected ? 2 : 1}
                                    className="animate-pulse"
                                  />
                                  <text
                                    x="8"
                                    y="3"
                                    fill="#ffffff"
                                    fontSize="8"
                                    fontWeight="bold"
                                    fontFamily="monospace"
                                  >
                                    {displayName} ({dist.toFixed(0)}m)
                                  </text>
                                </g>
                              );
                            })
                          )}
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* Radar Distance Range Switcher & Active Lock Readout */}
                <div className="bg-[#141b30] border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Scale:</span>
                    {[20, 50, 100, 500].map(scale => (
                      <button
                        key={scale}
                        onClick={() => setRadarScaleMeters(scale)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          radarScaleMeters === scale
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {scale}m
                      </button>
                    ))}
                  </div>

                  {currentRadarTarget ? (
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px]">LOCKED TARGET (IN DANGER)</span>
                      <strong className="text-cyan-300 font-bold">
                        {currentRadarTarget.victimName ? `${currentRadarTarget.victimName} · ` : ''}{currentRadarTarget.callsign} — {currentTargetDistance.toFixed(1)}m (
                        {Math.round(relativeTargetBearing)}° rel)
                      </strong>
                    </div>
                  ) : (
                    <div className="text-right">
                      <span className="text-emerald-400 font-mono text-[11px] font-bold">
                        🟢 No Endangered Victims Nearby
                      </span>
                      <span className="text-slate-500 block text-[9px] font-mono">Radar Clear</span>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: AREA CASUALTY TRIAGE ROSTER (SEPARATED VICTIMS & RESCUED LISTS) */}
              <div className="lg:col-span-6 bg-[#0e1424] border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl space-y-4">
                {/* Roster Header with PRIMARY TAB SWITCHER: VICTIMS vs RESCUED */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    {/* Tab 1: VICTIMS */}
                    <button
                      id="tab-roster-victims"
                      onClick={() => setRosterTab('VICTIMS')}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition font-mono ${
                        rosterTab === 'VICTIMS'
                          ? 'bg-red-950/90 text-red-200 border border-red-700 shadow-md shadow-red-950/60'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span>Victims</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                          activeVictimsList.length > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {activeVictimsList.length}
                      </span>
                    </button>

                    {/* Tab 2: RESCUED */}
                    <button
                      id="tab-roster-rescued"
                      onClick={() => setRosterTab('RESCUED')}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition font-mono ${
                        rosterTab === 'RESCUED'
                          ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-700 shadow-md shadow-emerald-950/60'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Rescued</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-900 text-emerald-300 border border-emerald-700">
                        {rescuedList.length}
                      </span>
                    </button>
                  </div>

                  {/* Sub-Filters / Simulation Test Drill Trigger */}
                  <div className="flex items-center gap-1.5">
                    {rosterTab === 'VICTIMS' && (
                      <div className="flex items-center bg-[#070a14] p-0.5 rounded-xl border border-slate-800 text-[10px] font-bold font-mono">
                        {['ALL', 'CRITICAL', 'INJURED'].map(f => (
                          <button
                            key={f}
                            onClick={() => setVictimSubFilter(f)}
                            className={`px-2 py-0.5 rounded-lg transition ${
                              victimSubFilter === f
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      id="btn-simulate-casualty"
                      onClick={simulateDrillVictim}
                      className="bg-indigo-950/80 hover:bg-indigo-800 text-indigo-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-indigo-700/80 font-mono transition flex items-center gap-1"
                      title="Inject simulated drill victim near your coordinates"
                    >
                      <span>+ Drill Signal</span>
                    </button>
                  </div>
                </div>

                {/* CASUALTIES LIST SCROLL CONTAINER */}
                <div className="flex-1 overflow-y-auto max-h-[380px] space-y-3 pr-1">
                  {/* VIEW 1: ACTIVE VICTIMS LIST */}
                  {rosterTab === 'VICTIMS' && (
                    <>
                      {displayedActiveVictims.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 font-mono text-xs flex flex-col items-center justify-center space-y-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600/60" />
                          <span className="text-slate-400 font-bold">No active unrescued victims in current filter sector.</span>
                          <span className="text-[11px] text-slate-500">
                            {rescuedList.length > 0
                              ? `All ${rescuedList.length} casualties are safe in the Rescued list.`
                              : 'Click "+ Drill Signal" to simulate an emergency casualty.'}
                          </span>
                        </div>
                      ) : (
                        displayedActiveVictims.map(v => {
                          const dist = calculateHaversine(gpsLocation.lat, gpsLocation.lng, v.lat, v.lng);
                          const isSelected = selectedVictim?.id === v.id || selectedVictim?.uuid === v.uuid;
                          const isHighlighted = locateHighlightId === (v.uuid || v.id);

                          return (
                            <div
                              key={v.uuid || v.id}
                              onClick={() => setSelectedVictim(v)}
                              className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col space-y-2.5 ${
                                isHighlighted
                                  ? 'border-cyan-400 ring-2 ring-cyan-500/50 bg-[#142338]'
                                  : isSelected
                                  ? 'border-cyan-600 bg-[#121c2e]'
                                  : v.status === 'INJURED'
                                  ? 'border-amber-900/60 bg-[#17130b]'
                                  : 'border-red-900/60 bg-[#180c10]'
                              }`}
                            >
                              {/* Card Top Row with Clear Victim Name */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-3 h-3 rounded-full shrink-0 ${
                                      v.status === 'INJURED'
                                        ? 'bg-amber-500 animate-pulse'
                                        : 'bg-red-500 animate-ping'
                                    }`}
                                  />
                                  <div className="flex flex-col text-left">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-black text-white tracking-wide">
                                        {v.victimName || (v.callsign && v.callsign.includes('(') ? v.callsign.split('(')[0].trim() : v.callsign)}
                                      </span>
                                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                                        {dist.toFixed(0)}m away
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      Node / Callsign: <strong className="text-amber-300/90">{v.callsign}</strong>
                                    </span>
                                  </div>
                                </div>

                                <span
                                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                    v.status === 'INJURED'
                                      ? 'bg-amber-950 text-amber-400 border border-amber-700'
                                      : 'bg-red-950 text-red-400 border border-red-700'
                                  }`}
                                >
                                  {v.status}
                                </span>
                              </div>

                              {/* Distress Message Notes */}
                              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                                {v.distressMessage || 'Distress Telemetry Packet Stream Active'}
                              </p>

                              {/* Telemetry & Action Buttons */}
                              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] font-mono gap-2">
                                <span className="text-slate-400 text-[10px]">
                                  Battery: <strong>{v.battery}%</strong> | [ {v.lat.toFixed(4)}, {v.lng.toFixed(4)} ]
                                </span>

                                <div className="flex items-center gap-2">
                                  {/* OPTION TO LOCATE VICTIM ON MAP */}
                                  <button
                                    id={`btn-locate-${v.id || v.uuid}`}
                                    onClick={e => {
                                      e.stopPropagation();
                                      locateVictimOnMap(v);
                                    }}
                                    className="bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 px-2.5 py-1 rounded-xl border border-cyan-700/80 text-[11px] font-bold font-mono transition flex items-center gap-1 shadow-sm"
                                    title="Locate victim on tactical map"
                                  >
                                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Locate on Map</span>
                                  </button>

                                  {/* MARK VICTIM SAFE (MOVES TO RESCUED LIST) */}
                                  <button
                                    id={`btn-mark-safe-${v.id || v.uuid}`}
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleUpdateVictimStatus(v.id || v.uuid, 'SAFE');
                                    }}
                                    className="bg-emerald-950/90 hover:bg-emerald-800 text-emerald-200 px-2.5 py-1 rounded-xl border border-emerald-700/80 text-[11px] font-bold font-mono transition flex items-center gap-1 shadow-sm"
                                    title="Mark victim safe and move to Rescued list"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Mark Safe</span>
                                  </button>

                                  {/* Secondary triage option */}
                                  {v.status !== 'INJURED' && (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleUpdateVictimStatus(v.id || v.uuid, 'INJURED');
                                      }}
                                      className="bg-amber-950/80 hover:bg-amber-900 text-amber-300 px-2 py-1 rounded-xl border border-amber-800 text-[10px] font-bold font-mono transition"
                                    >
                                      Triage Injured
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}

                  {/* VIEW 2: RESCUED LIST (VICTIMS MARKED SAFE) */}
                  {rosterTab === 'RESCUED' && (
                    <>
                      {rescuedList.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 font-mono text-xs flex flex-col items-center justify-center space-y-2">
                          <LifeBuoy className="w-8 h-8 text-slate-700" />
                          <span className="text-slate-400 font-bold">No rescued casualties recorded yet.</span>
                          <span className="text-[11px] text-slate-500">
                            When you mark an active victim as "Safe", they get moved off the victims list and appear here.
                          </span>
                        </div>
                      ) : (
                        rescuedList.map(v => {
                          const dist = calculateHaversine(gpsLocation.lat, gpsLocation.lng, v.lat, v.lng);
                          const isSelected = selectedVictim?.id === v.id || selectedVictim?.uuid === v.uuid;
                          const isHighlighted = locateHighlightId === (v.uuid || v.id);

                          return (
                            <div
                              key={v.uuid || v.id}
                              onClick={() => setSelectedVictim(v)}
                              className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col space-y-2.5 ${
                                isHighlighted
                                  ? 'border-cyan-400 ring-2 ring-cyan-500/50 bg-[#0e1e1e]'
                                  : isSelected
                                  ? 'border-cyan-500 bg-[#0c1817]'
                                  : 'border-emerald-900/60 bg-[#0a1613]'
                              }`}
                            >
                              {/* Card Top Row with Rescued Civilian Name */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <div className="flex flex-col text-left">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-black text-white tracking-wide">
                                        {v.victimName || (v.callsign && v.callsign.includes('(') ? v.callsign.split('(')[0].trim() : v.callsign)}
                                      </span>
                                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                                        {dist.toFixed(0)}m away
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      Node / Callsign: <strong className="text-emerald-300/90">{v.callsign}</strong>
                                    </span>
                                  </div>
                                </div>

                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700">
                                  ✓ RESCUED / SAFE
                                </span>
                              </div>

                              {/* Distress Message Notes */}
                              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                                {v.distressMessage || 'Casualty stabilized and marked Safe.'}
                              </p>

                              {/* Telemetry & Action Buttons */}
                              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] font-mono gap-2">
                                <span className="text-slate-400 text-[10px]">
                                  Safe At: [ {v.lat.toFixed(4)}, {v.lng.toFixed(4)} ] | Battery: <strong>{v.battery}%</strong>
                                </span>

                                <div className="flex items-center gap-2">
                                  {/* OPTION TO LOCATE RESCUED CASUALTY ON MAP */}
                                  <button
                                    id={`btn-locate-rescued-${v.id || v.uuid}`}
                                    onClick={e => {
                                      e.stopPropagation();
                                      locateVictimOnMap(v);
                                    }}
                                    className="bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 px-2.5 py-1 rounded-xl border border-cyan-700/80 text-[11px] font-bold font-mono transition flex items-center gap-1 shadow-sm"
                                    title="Locate safe point on tactical map"
                                  >
                                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Locate on Map</span>
                                  </button>

                                  {/* Return to Active Victims if needed */}
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleUpdateVictimStatus(v.id || v.uuid, 'INJURED');
                                    }}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-xl border border-slate-700 text-[10px] font-bold font-mono transition flex items-center gap-1"
                                    title="Re-open triage and return to Victims list"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Re-triage</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>

                {/* Tactical Dispatch Terminal Logs Feed */}
                <div className="bg-[#080c16] border border-slate-800/80 rounded-2xl p-3 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-slate-500 text-[10px] border-b border-slate-800 pb-1 mb-1.5">
                    <span>LIVE EMERGENCY DISPATCH LOGS ( आपद सेतु )</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> STREAMING
                    </span>
                  </div>
                  <div className="max-h-20 overflow-y-auto space-y-1 text-slate-300">
                    {protocolLogs.slice(0, 6).map(l => (
                      <div key={l.id} className="flex items-start gap-1.5 leading-tight">
                        <span className="text-slate-600">[{l.timestamp}]</span>
                        <span className="text-cyan-400">[{l.category}]</span>
                        <span className="text-slate-300">{l.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 4. HIGH-PRIORITY EMERGENCY ALERT POPUP MODAL (RESCUER ONLY)               */}
      {/* ========================================================================= */}
      {activeAlertPopup && activeRole === 'ROLE_RESPONDER' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#18090d] border-2 border-red-600 rounded-3xl p-6 max-w-md w-full shadow-2xl shadow-red-950 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-600/30 border-2 border-red-500 flex items-center justify-center mx-auto animate-bounce">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <div>
              <span className="bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                TACTICAL EMERGENCY ALERT
              </span>
              <h3 className="text-xl font-black text-white mt-1">
                New Critical Casualty Detected!
              </h3>
              <div className="mt-1 flex flex-col items-center">
                <span className="text-base font-black text-amber-300 tracking-wide">
                  Victim: {activeAlertPopup.victimName || (activeAlertPopup.callsign?.includes('(') ? activeAlertPopup.callsign.split('(')[0].trim() : activeAlertPopup.callsign)}
                </span>
                <p className="text-xs text-red-300 font-mono mt-0.5">
                  Node / Callsign: <strong>{activeAlertPopup.callsign || activeAlertPopup.id}</strong>
                </p>
              </div>
            </div>

            <div className="bg-[#0a0507] border border-red-900/60 rounded-xl p-3 text-left font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <strong className="text-red-400">{activeAlertPopup.status}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">GPS Coordinates:</span>
                <strong className="text-white">
                  {activeAlertPopup.lat?.toFixed(4)}, {activeAlertPopup.lng?.toFixed(4)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Battery Level:</span>
                <strong className="text-amber-400">{activeAlertPopup.battery}%</strong>
              </div>
              <p className="text-slate-300 font-sans text-xs pt-1 border-t border-red-950 mt-1">
                "{activeAlertPopup.distressMessage}"
              </p>
            </div>

            {/* ACTION BUTTONS WITH PROMINENT "LOCATE ON MAP" AS PRIMARY OPTION */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                id="btn-alert-locate-map"
                onClick={() => {
                  locateVictimOnMap(activeAlertPopup);
                  setActiveAlertPopup(null);
                }}
                className="w-full sm:flex-1 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:brightness-110 text-white font-black py-3 px-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-red-950/80 font-mono tracking-wide"
              >
                <MapPin className="w-4 h-4 text-white animate-bounce" />
                <span>Locate on Map &amp; Track</span>
              </button>
              <button
                onClick={() => setActiveAlertPopup(null)}
                className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition font-mono"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
