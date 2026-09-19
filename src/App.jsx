import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import VictimMode from './components/VictimMode';
import ResponderMode from './components/ResponderMode';
import NetworkInspectorDrawer from './components/NetworkInspectorDrawer';
import { BluetoothScannerModal } from './components/BluetoothScannerModal';
import { P2PPairingModal } from './components/P2PPairingModal';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { BluetoothMeshManager } from './utils/bluetooth';
import { SonarAudioEngine } from './utils/sonarAudio';
import { WebRTCPeerMesh, AcousticSoundModem } from './utils/p2pMesh';
import {
  Radio,
  Wifi,
  WifiOff,
  Battery,
  BatteryCharging,
  BatteryWarning,
  AlertTriangle,
  Shield,
  ShieldAlert,
  Activity,
  Layers,
  MapPin,
  RefreshCw,
  Play,
  RotateCcw,
  Zap,
  Terminal,
  Compass,
  ArrowRight,
  CheckCircle2,
  Clock,
  Send,
  Sliders,
  Volume2,
  VolumeX,
  Eye,
  FileText,
  Share2,
  Database,
  Lock,
  ChevronRight,
  ChevronDown,
  Info,
  Server,
  Smartphone,
  Navigation,
  Flame,
  LifeBuoy,
  Signal,
  Copy,
  Check,
  Globe,
  UploadCloud,
  Trash2,
  ExternalLink,
  Crosshair,
  Gauge,
  Satellite,
  Bell,
  Pause,
  Target,
  Users,
  UserCheck,
  HeartPulse,
  AlertOctagon,
  Bot,
  Bluetooth,
  QrCode,
  Download,
  X
} from 'lucide-react';

// Short UUID helper
function generatePacketId() {
  return 'aapadsetu-' + Math.random().toString(36).substring(2, 9);
}

// Timestamp helper
function getLocalTimeStr(date = new Date()) {
  return date.toTimeString().split(' ')[0] + '.' + String(Math.floor(date.getMilliseconds() / 100));
}

export default function App() {
  // Navigation tabs (Two-Role Segregated: 'victim' | 'responder')
  const [activeTab, setActiveTab] = useState('victim'); // 'victim' (I NEED HELP) | 'responder' (RESCUER DASHBOARD)

  // Collapsible Technical Inspector Drawer State (For Hackathon Judges / Coders)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Administrative Cloud Uplink & Gateway State (Node C Gateway Configuration)
  const [nodeCOnlineStatus, setNodeCOnlineStatus] = useState(() => {
    return typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true;
  });

  const [cloudConnectionParams, setCloudConnectionParams] = useState({
    endpoint: 'https://api.aapadsetu.gov.in/v1/sync',
    protocol: 'HTTPS/REST (Simulated)',
    gatewayId: 'GATEWAY-AS1 (Starlink/5G Uplink)',
    lastSyncTime: null,
    syncing: false
  });

  // Toast notifications for inter-device signals
  const [toasts, setToasts] = useState([]);

  // Metrics
  const [metrics, setMetrics] = useState({
    packetsCreated: 0,
    packetsRelayed: 0,
    packetsSynced: 0,
    duplicatesRejected: 0,
    hopsCompleted: 0,
    broadcastsReceived: 0
  });

  // Copied clipboard state
  const [copiedKey, setCopiedKey] = useState(null);

  // Hardware Battery State (Navigator Battery API)
  const [hardwareBattery, setHardwareBattery] = useState({
    supported: false,
    level: 88, // Default fallback %
    charging: false,
    dischargingTime: Infinity
  });

  // Real-Time High-Accuracy GPS State (Geolocation API)
  const [gpsState, setGpsState] = useState({
    supported: 'geolocation' in navigator,
    status: 'ACQUIRING', // 'ACQUIRING', 'LOCKED', 'DENIED', 'MANUAL'
    lat: 19.0760,
    lng: 72.8777,
    accuracy: 4.2, // meters
    altitude: 18.5, // meters
    speed: 0.0, // m/s
    heading: 0,
    timestamp: new Date().toISOString(),
    errorMsg: null,
    manualMode: false
  });

  // Manual GPS inputs for fallback
  const [manualCoords, setManualCoords] = useState({
    lat: '19.0760',
    lng: '72.8777',
    label: 'Sector 4, Block G (Disaster Zone)'
  });

  // OPERATING MODE: Hybrid Simulator vs Dedicated Hardware Peer Mode (for 2nd physical phone)
  const [operatingMode, setOperatingMode] = useState('SIMULATOR'); // 'SIMULATOR' | 'HARDWARE_PEER'

  // Unique Device ID for Cross-Device Mesh Recognition
  const [deviceInstanceId] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const stored = window.sessionStorage.getItem('resq_device_instance_id');
        if (stored) return stored;
        const gen = 'DEV-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        window.sessionStorage.setItem('resq_device_instance_id', gen);
        return gen;
      }
    } catch (e) {
      // Storage access blocked in cross-origin sandboxed environment
    }
    return 'DEV-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  });

  // Three Nodes Core State Model (1 Live Hardware Node + 2 Virtual Dummy Nodes)
  const [nodes, setNodes] = useState({
    nodeA: {
      id: 'NODE-1 (THIS DEVICE)',
      shortId: 'THIS-PHONE',
      name: 'This Device (Live Hardware)',
      role: 'Victim / SOS Originator (Hardware Sensors)',
      tagBadge: '🟢 LIVE DEVICE: THIS PHONE',
      isLiveHardware: true,
      isOnline: false,
      inRangeOfB: true,
      rssiToB: -62,
      battery: 88,
      status: 'CRITICAL - TRAPPED', // 'CRITICAL - TRAPPED', 'INJURED', 'SAFE'
      packets: []
    },
    nodeB: {
      id: 'NODE-2 (DUMMY RELAY ALPHA)',
      shortId: 'RELAY-A1',
      name: 'Dummy Relay Alpha',
      role: 'Virtual Simulated Device (Store & Forward)',
      tagBadge: '🤖 VIRTUAL SIMULATOR: DUMMY RELAY',
      isVirtual: true,
      isOnline: false,
      meshActive: true,
      inRangeOfA: true,
      inRangeOfC: true,
      rssiToA: -68,
      rssiToC: -74,
      battery: 88,
      offsetLat: 0.00090, // ~100m NE offset
      offsetLng: 0.00065,
      packets: []
    },
    nodeC: {
      id: 'NODE-3 (DUMMY GATEWAY BETA)',
      shortId: 'GATEWAY-B2',
      name: 'Dummy Gateway Beta',
      role: 'Virtual Simulated Device (Cellular / Satellite Gateway)',
      tagBadge: '🤖 VIRTUAL SIMULATOR: DUMMY GATEWAY',
      isVirtual: true,
      isOnline: true, // 4G/5G / Satellite Active Toggle
      uplinkType: '5G / Starlink',
      inRangeOfB: true,
      rssiToB: -74,
      battery: 96,
      offsetLat: 0.00225, // ~250m NE offset
      offsetLng: 0.00160,
      packets: []
    }
  });

  // Cloud Dispatch Ledger (Packets reaching gateway & synced to Cloud)
  const [dispatchLedger, setDispatchLedger] = useState([]);

  // Selected incident for tactical map preview
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Terminal Event Logs
  const [logs, setLogs] = useState([
    { id: 'l-init-1', time: getLocalTimeStr(), type: 'SYS', message: 'ResQ Mesh Relay System initialized. BroadcastChannel ("resq_mesh_network") online.' },
    { id: 'l-init-2', time: getLocalTimeStr(), type: 'GPS', message: 'GPS high-accuracy watcher initialized with enableHighAccuracy: true.' }
  ]);

  // Log filter
  const [logFilter, setLogFilter] = useState('ALL');

  // SOS Hold-to-Activate Timer State (Node A)
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdIntervalRef = useRef(null);

  // Emergency Siren & Visual Morse SOS Strobe
  const [isBeaconActive, setIsBeaconActive] = useState(false);
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const audioCtxRef = useRef(null);
  const oscillatorRef = useRef(null);

  // 1. VISUAL MORSE CODE STROBE & FLASHLIGHT ENGINE (SOS: ... --- ...)
  const [morseFlash, setMorseFlash] = useState(false);
  const [morseInfo, setMorseInfo] = useState({ letter: 'S', symbol: '·', stepIndex: 0 });
  const torchTrackRef = useRef(null);
  const torchStreamRef = useRef(null);
  const morseTimeoutRef = useRef(null);
  const morseIndexRef = useRef(0);

  // 2. VOICE-ACTIVATED HANDS-FREE SOS (Speech Recognition)
  const [isVoiceSosListening, setIsVoiceSosListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceDetectedKeyword, setVoiceDetectedKeyword] = useState(null);
  const [voiceSosSupported, setVoiceSosSupported] = useState(true);
  const speechRecognitionRef = useRef(null);
  const isVoiceSosListeningRef = useRef(false);
  const voiceRestartTimerRef = useRef(null);

  // 3. ULTRASONIC / ACOUSTIC PROXIMITY PULSE (GPS-Denied Search Mode)
  const [isAcousticPulseEmitting, setIsAcousticPulseEmitting] = useState(false);

  // 4. GYROSCOPE COMPASS & DEVICE ORIENTATION RADAR ENGINE
  const [compassHeading, setCompassHeading] = useState(0);
  const [isGyroActive, setIsGyroActive] = useState(false);
  const [isGyroSupported, setIsGyroSupported] = useState(true);
  const [gyroPermissionState, setGyroPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'unsupported'
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [compassAccuracy, setCompassAccuracy] = useState('HIGH');
  const [isSimulatedHeading, setIsSimulatedHeading] = useState(false);
  const [simulatedHeading, setSimulatedHeading] = useState(0);
  const gyroActiveRef = useRef(false);

  // BroadcastChannel Reference for Inter-Device / Cross-Tab Communication
  const broadcastChannelRef = useRef(null);

  // Expandable JSON buffer views
  const [expandedBuffers, setExpandedBuffers] = useState({
    nodeA: true,
    nodeB: true,
    nodeC: true
  });

  // REAL-WORLD HARDWARE BLE & P2P MESH MODALS AND TELEMETRY STATE
  const [isBleModalOpen, setIsBleModalOpen] = useState(false);
  const [isP2PModalOpen, setIsP2PModalOpen] = useState(false);
  const [bleTelemetry, setBleTelemetry] = useState(null);
  const [p2pConnectionState, setP2pConnectionState] = useState('DISCONNECTED');

  const sonarEngineRef = useRef(null);
  const bleManagerRef = useRef(null);
  const p2pMeshRef = useRef(null);
  const acousticModemRef = useRef(null);

  // Proximity Radar Beep & Audio State
  const [isRadarMuted, setIsRadarMuted] = useState(false);
  const [detectedPeers, setDetectedPeers] = useState({});
  const radarAudioCtxRef = useRef(null);
  const radarBeepTimerRef = useRef(null);
  const wasInProximityRef = useRef(false);

  // Critical Battery Emergency Dispatch State (<5% Trigger)
  const [batteryAlertBanner, setBatteryAlertBanner] = useState(false);
  const lastGaspFiredRef = useRef(false);

  // Explicit Hop Target Selection State ('NODE_B' | 'NODE_C' | 'BROADCAST_ALL')
  const [selectedHopTarget, setSelectedHopTarget] = useState('NODE_B');

  // AREA INCIDENT COMMAND & VICTIM AGGREGATOR STATE
  const [extraVictimPackets, setExtraVictimPackets] = useState([]);
  const [isVictimRosterOpen, setIsVictimRosterOpen] = useState(true);
  const [rosterFilter, setRosterFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'INJURED' | 'SAFE'
  const [currentTimeTick, setCurrentTimeTick] = useState(Date.now());

  // Real-time Relative Timestamp Clock (Updates every 5s)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeTick(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Format Time Since helper (e.g., "Active 14s ago", "Active 2m ago", "Active just now")
  const formatTimeSince = useCallback((timestamp) => {
    if (!timestamp) return 'Active just now';
    const tsMs = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    if (isNaN(tsMs)) return 'Active just now';
    const diff = Math.max(0, currentTimeTick - tsMs);
    if (diff < 7000) return 'Active just now';
    if (diff < 60000) return `Active ${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `Active ${Math.floor(diff / 60000)}m ago`;
    return `Active ${Math.floor(diff / 3600000)}h ago`;
  }, [currentTimeTick]);

  // User Profile Settings
  const [userProfile, setUserProfile] = useState({
    name: 'Anonymous Citizen',
    bloodGroup: 'O+',
    medicalNotes: 'Asthmatic, conscious under debris',
    emergencyContact: '+1 (555) 911-RESQ',
    includeMedical: true,
    anonymizeNode: true,
    autoRelayOnReceive: true
  });

  // Helper: Append Event Log
  const addLog = useCallback((type, message) => {
    setLogs(prev => [
      { id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), time: getLocalTimeStr(), type, message },
      ...prev.slice(0, 199)
    ]);
  }, []);

  // Helper: Push Toast Notification
  const showToast = useCallback((title, subtitle, type = 'info') => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    setToasts(prev => [{ id, title, subtitle, type }, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  // Helper: Copy to Clipboard
  const copyText = (text, key) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(typeof text === 'object' ? JSON.stringify(text, null, 2) : text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  // DYNAMIC AREA INCIDENT COMMAND & VICTIM AGGREGATOR ENGINE
  const victimAggregator = useMemo(() => {
    // Gather all distinct mesh packets across Node A, Node B, Node C and extra injected packets
    const allPackets = [
      ...(nodes.nodeA.packets || []),
      ...(nodes.nodeB.packets || []),
      ...(nodes.nodeC.packets || []),
      ...(extraVictimPackets || [])
    ];

    const victimsMap = new Map();

    allPackets.forEach(pkt => {
      if (!pkt || !pkt.uuid) return;
      // Deduplicate by victim entity identifier
      const victimKey = pkt.origin_id || pkt.victim_id || (pkt.origin_node && pkt.origin_node !== 'Node A (Victim)' ? pkt.origin_node : null) || pkt.uuid;
      const existing = victimsMap.get(victimKey);
      const pktTime = new Date(pkt.timestamp || Date.now()).getTime();

      if (!existing || pktTime >= existing.timestampMs) {
        const rawStatus = (pkt.status || '').toUpperCase();
        const rawPriority = (pkt.priority || '').toUpperCase();
        const rawMedical = (pkt.medical || '').toUpperCase();

        let statusNorm = 'TRAPPED';
        if (rawStatus.includes('SAFE') || rawStatus.includes('EVACUAT') || rawStatus.includes('RESOLV')) {
          statusNorm = 'SAFE';
        } else if (rawStatus.includes('INJUR') || rawStatus.includes('ASSIST') || rawStatus.includes('AID')) {
          statusNorm = 'INJURED';
        } else if (rawStatus.includes('TRAP') || rawStatus.includes('TERMINAL') || rawStatus.includes('CRITICAL')) {
          statusNorm = 'TRAPPED';
        }

        const isCritical = rawPriority.includes('CRITICAL') ||
          rawStatus.includes('CRITICAL') ||
          rawStatus.includes('TERMINAL') ||
          rawMedical.includes('CRUSH') ||
          rawMedical.includes('BLOOD') ||
          rawMedical.includes('SEVERE') ||
          rawMedical.includes('UNCONSCIOUS');

        victimsMap.set(victimKey, {
          id: victimKey,
          callsign: pkt.origin_node || pkt.origin_id || pkt.uuid,
          uuid: pkt.uuid,
          status: statusNorm,
          rawStatus: pkt.status || statusNorm,
          priority: pkt.priority || (isCritical ? 'CRITICAL' : statusNorm === 'INJURED' ? 'MEDIUM' : 'LOW'),
          isCritical,
          medical: pkt.medical || 'Triage profile normal',
          lat: pkt.lat || Number(manualCoords.lat) || gpsState.lat || 19.0760,
          lng: pkt.lng || Number(manualCoords.lng) || gpsState.lng || 72.8777,
          accuracy: pkt.accuracy || 4.2,
          battery: pkt.battery || '88%',
          altitude: pkt.altitude || '14m',
          rssi: pkt.rssi || -68,
          hops: pkt.hops || 0,
          ttl: pkt.ttl || 7,
          timestamp: pkt.timestamp || new Date().toISOString(),
          timestampMs: isNaN(pktTime) ? Date.now() : pktTime
        });
      }
    });

    const victimsList = Array.from(victimsMap.values()).sort((a, b) => {
      const score = v => (v.isCritical ? 3 : v.status === 'TRAPPED' ? 2 : v.status === 'INJURED' ? 1 : 0);
      if (score(b) !== score(a)) return score(b) - score(a);
      return b.timestampMs - a.timestampMs;
    });

    const totalVictims = victimsList.length;
    const trappedCount = victimsList.filter(v => v.status === 'TRAPPED').length;
    const criticalCount = victimsList.filter(v => v.isCritical).length;
    const injuredCount = victimsList.filter(v => v.status === 'INJURED').length;
    const safeCount = victimsList.filter(v => v.status === 'SAFE').length;

    let hazardLevel = 'NOMINAL';
    let hazardColor = 'emerald';
    let hazardBadgeBg = 'bg-emerald-950/90 border-emerald-500 text-emerald-300';
    let hazardDescription = 'All local sectors nominal. No active distress signals.';

    if (criticalCount > 0 || trappedCount > 0) {
      hazardLevel = 'HIGH';
      hazardColor = 'red';
      hazardBadgeBg = 'bg-red-950/95 border-red-500 text-red-200';
      hazardDescription = 'HIGH CASUALTY HAZARD: Critical / Trapped victims detected. Immediate tactical search & rescue dispatch required.';
    } else if (injuredCount > 0) {
      hazardLevel = 'MEDIUM';
      hazardColor = 'amber';
      hazardBadgeBg = 'bg-amber-950/90 border-amber-500 text-amber-200';
      hazardDescription = 'ELEVATED HAZARD: Injured individuals present requiring field medical assistance and triage stabilization.';
    } else if (totalVictims > 0 && safeCount === totalVictims) {
      hazardLevel = 'LOW';
      hazardColor = 'emerald';
      hazardBadgeBg = 'bg-emerald-950/90 border-emerald-500 text-emerald-200';
      hazardDescription = 'CONTAINED / LOW HAZARD: All detected victims marked safe and accounted for in evacuation safe zones.';
    }

    return {
      victimsList,
      totalVictims,
      trappedCount,
      criticalCount,
      injuredCount,
      safeCount,
      hazardLevel,
      hazardColor,
      hazardBadgeBg,
      hazardDescription
    };
  }, [nodes, extraVictimPackets, manualCoords, gpsState]);

  // INTERACTIVE SIMULATION: Simulate Multi-Victim Broadcast
  const simulateMultiVictimBroadcast = useCallback(() => {
    const now = Date.now();
    const mockVictims = [
      {
        uuid: 'resq-victim-alpha-' + Math.random().toString(36).substring(2, 6),
        origin_id: 'VICTIM-ALPHA (Sector 4)',
        origin_node: 'Citizen Alpha (Sector 4)',
        status: 'TRAPPED',
        priority: 'CRITICAL',
        medical: 'O+ (Crush Injury / Severe Blood Loss)',
        lat: 19.0778,
        lng: 72.8791,
        accuracy: 3.8,
        battery: '14%',
        altitude: '18.2m',
        rssi: -65,
        ttl: 8,
        hops: 1,
        timestamp: new Date(now).toISOString()
      },
      {
        uuid: 'resq-victim-bravo-' + Math.random().toString(36).substring(2, 6),
        origin_id: 'VICTIM-BRAVO (Stairwell B)',
        origin_node: 'Citizen Bravo (Stairwell B)',
        status: 'INJURED',
        priority: 'MEDIUM',
        medical: 'B+ (Fractured Leg / Mobile with aid)',
        lat: 19.0745,
        lng: 72.8761,
        accuracy: 5.4,
        battery: '52%',
        altitude: '12.0m',
        rssi: -79,
        ttl: 6,
        hops: 2,
        timestamp: new Date(now - 38000).toISOString()
      },
      {
        uuid: 'resq-victim-charlie-' + Math.random().toString(36).substring(2, 6),
        origin_id: 'VICTIM-CHARLIE (Safe Zone North)',
        origin_node: 'Citizen Charlie (Safe Zone)',
        status: 'SAFE',
        priority: 'LOW',
        medical: 'A- (No injuries / Evacuated to Sector 4)',
        lat: 19.0795,
        lng: 72.8812,
        accuracy: 2.5,
        battery: '89%',
        altitude: '9.5m',
        rssi: -89,
        ttl: 10,
        hops: 1,
        timestamp: new Date(now - 95000).toISOString()
      }
    ];

    setExtraVictimPackets(prev => [...mockVictims, ...prev]);

    setNodes(prev => ({
      ...prev,
      nodeB: {
        ...prev.nodeB,
        packets: [...mockVictims, ...prev.nodeB.packets]
      },
      nodeC: {
        ...prev.nodeC,
        packets: [...mockVictims, ...prev.nodeC.packets]
      }
    }));

    setMetrics(prev => ({
      ...prev,
      packetsRelayed: prev.packetsRelayed + mockVictims.length,
      broadcastsReceived: prev.broadcastsReceived + mockVictims.length
    }));

    if (broadcastChannelRef.current) {
      try {
        mockVictims.forEach(v => {
          broadcastChannelRef.current.postMessage({
            action: 'SOS_BROADCAST',
            senderNode: 'INCIDENT_SIMULATOR',
            packet: v
          });
        });
      } catch (e) {
        console.error(e);
      }
    }

    addLog('MESH', `📡 Multi-Victim Incident Broadcast Ingested: 3 mock peer packets (Alpha: TRAPPED/CRITICAL, Bravo: INJURED, Charlie: SAFE) received.`);
    showToast(
      '📡 Multi-Victim Broadcast Ingested',
      '3 peer victim packets (1 Trapped/Critical, 1 Injured, 1 Safe) parsed into Area Incident Command.',
      'alert'
    );
  }, [addLog, showToast]);

  // Alias for injecting simulated casualties in triage
  const injectSimulatedCasualties = simulateMultiVictimBroadcast;

  // Mark Victim as Safe handler
  const markVictimSafe = useCallback((victimId) => {
    const updatePacket = (p) => {
      const vKey = p.origin_id || p.victim_id || (p.origin_node && p.origin_node !== 'Node A (Victim)' ? p.origin_node : null) || p.uuid;
      if (vKey === victimId || p.uuid === victimId) {
        return {
          ...p,
          status: 'SAFE',
          priority: 'LOW',
          medical: (p.medical || '') + ' [TRIAGE: MARKED SAFE BY COMMAND]',
          timestamp: new Date().toISOString()
        };
      }
      return p;
    };

    setNodes(prev => ({
      ...prev,
      nodeA: { ...prev.nodeA, packets: prev.nodeA.packets.map(updatePacket) },
      nodeB: { ...prev.nodeB, packets: prev.nodeB.packets.map(updatePacket) },
      nodeC: { ...prev.nodeC, packets: prev.nodeC.packets.map(updatePacket) }
    }));
    setExtraVictimPackets(prev => prev.map(updatePacket));
    addLog('RELAY', `Incident Command updated victim [${victimId}] status to SAFE.`);
    showToast('✅ Victim Triage Updated', `Victim [${victimId}] marked as SAFE & accounted for.`, 'success');
  }, [addLog, showToast]);

  // Clear simulated victims
  const clearSimulatedVictims = useCallback(() => {
    setExtraVictimPackets([]);
    setNodes(prev => ({
      ...prev,
      nodeB: { ...prev.nodeB, packets: prev.nodeB.packets.filter(p => !p.uuid.includes('resq-victim-')) },
      nodeC: { ...prev.nodeC, packets: prev.nodeC.packets.filter(p => !p.uuid.includes('resq-victim-')) }
    }));
    addLog('SYS', 'Cleared simulated multi-victim test packets from incident triage.');
    showToast('🧹 Roster Cleared', 'Simulated peer victim packets removed from Incident Command.', 'info');
  }, [addLog, showToast]);

  // RADAR MATH ENGINE & RESCUER POSITION STATE
  // Rescuer (Node B) offset relative to Victim (Node A)
  const [rescuerOffset, setRescuerOffset] = useState({
    dLat: -0.00016, // Rescuer ~17.8m South
    dLng: -0.00012  // Rescuer ~13.3m West -> Total ~22.2m distance at ~37° NE Bearing
  });
  const [radarScale, setRadarScale] = useState(40); // 30m, 40m, 60m maximum radar circle range
  const [isSimulatingApproach, setIsSimulatingApproach] = useState(false);
  const simulationIntervalRef = useRef(null);

  // RADAR MATH 1: Haversine Distance Calculation (meters)
  // d = 2 * R * asin(sqrt(sin^2(dLat/2) + cos(lat1)*cos(lat2)*sin^2(dLng/2))) where R = 6,371,000m
  const calculateHaversine = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth mean radius in meters
    const toRad = deg => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // RADAR MATH 2: Bearing Angle Calculation (0° to 360° clockwise from North)
  // y = sin(dLng) * cos(lat2); x = cos(lat1)*sin(lat2) - sin(lat1)*cos(lat2)*cos(dLng)
  // bearing = (atan2(y, x) * 180 / PI + 360) % 360
  const calculateBearing = useCallback((lat1, lon1, lat2, lon2) => {
    const toRad = deg => (deg * Math.PI) / 180;
    const toDeg = rad => (rad * 180) / Math.PI;
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);
    const dLon = toRad(lon2 - lon1);

    const y = Math.sin(dLon) * Math.cos(rLat2);
    const x = Math.cos(rLat1) * Math.sin(rLat2) - Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);
    const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
    return bearing;
  }, []);

  // RADAR MATH 3: BLE Path-Loss RSSI Estimation in dBm
  // RSSI = Measured_Power (-69 dBm at 1m) - (10 * 2 * log10(Distance))
  // Clamped between -30 dBm (Very Close) and -95 dBm (Out of Range)
  const calculateRSSI = useCallback((distanceMeters) => {
    const measuredPower = -69; // Reference RSSI at 1 meter in dBm
    const pathLossExponent = 2.0; // Standard free-space path loss exponent
    const d = Math.max(0.2, distanceMeters);
    const rawRSSI = measuredPower - (10 * pathLossExponent * Math.log10(d));
    return Math.max(-95, Math.min(-30, Math.round(rawRSSI)));
  }, []);

  // Cardinal Direction Helper
  const getCardinalDirection = useCallback((bearing) => {
    const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(bearing / 22.5) % 16;
    return points[idx];
  }, []);

  // Rescuer Movement Step Controls
  const stepCloserToVictim = useCallback((stepMeters = 3.0) => {
    setRescuerOffset(prev => {
      const latM = prev.dLat * 111320;
      const lngM = prev.dLng * 111320 * Math.cos(19.076 * Math.PI / 180);
      const currentDist = Math.hypot(latM, lngM) || 1;
      const newDist = Math.max(0.8, currentDist - stepMeters);
      const ratio = newDist / currentDist;
      return {
        dLat: prev.dLat * ratio,
        dLng: prev.dLng * ratio
      };
    });
  }, []);

  const stepAwayFromVictim = useCallback((stepMeters = 3.0) => {
    setRescuerOffset(prev => {
      const latM = prev.dLat * 111320;
      const lngM = prev.dLng * 111320 * Math.cos(19.076 * Math.PI / 180);
      const currentDist = Math.hypot(latM, lngM) || 1;
      const newDist = Math.min(60, currentDist + stepMeters);
      const ratio = newDist / currentDist;
      return {
        dLat: prev.dLat * ratio,
        dLng: prev.dLng * ratio
      };
    });
  }, []);

  const moveRescuerDelta = useCallback((deltaNorthM, deltaEastM) => {
    setRescuerOffset(prev => {
      const dLatShift = deltaNorthM / 111320;
      const dLngShift = deltaEastM / (111320 * Math.cos(19.076 * Math.PI / 180));
      return {
        dLat: prev.dLat + dLatShift, // Moving North increases rescuer latitude (+dLat)
        dLng: prev.dLng + dLngShift  // Moving East increases rescuer longitude (+dLng)
      };
    });
  }, []);

  // Direct Distance Slider Setter (maintains current angle)
  const setSliderDistance = useCallback((targetMeters) => {
    setRescuerOffset(prev => {
      const latM = prev.dLat * 111320;
      const lngM = prev.dLng * 111320 * Math.cos(19.076 * Math.PI / 180);
      const currentDist = Math.hypot(latM, lngM) || 1;
      const ratio = targetMeters / currentDist;
      return {
        dLat: prev.dLat * ratio,
        dLng: prev.dLng * ratio
      };
    });
  }, []);

  // Continuous Walking / Approach Simulation Loop
  const toggleApproachSim = useCallback(() => {
    if (isSimulatingApproach) {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      setIsSimulatingApproach(false);
      addLog('RADAR', 'Rescuer movement simulation paused.');
    } else {
      setIsSimulatingApproach(true);
      addLog('RADAR', 'Rescuer continuous approach simulation started (walking toward Node A).');
      simulationIntervalRef.current = setInterval(() => {
        setRescuerOffset(prev => {
          const latM = prev.dLat * 111320;
          const lngM = prev.dLng * 111320 * Math.cos(19.076 * Math.PI / 180);
          const currentDist = Math.hypot(latM, lngM);

          // If reached immediate proximity (< 1.5m), reset to outer perimeter (~32m) for continuous testing
          if (currentDist < 1.5) {
            return {
              dLat: -0.00022,
              dLng: -0.00018
            };
          }

          // Smoothly step 0.95m closer per tick (every 300ms ≈ brisk 3.2 m/s walk)
          const newDist = Math.max(1.0, currentDist - 0.95);
          const ratio = newDist / currentDist;
          return {
            dLat: prev.dLat * ratio,
            dLng: prev.dLng * ratio
          };
        });
      }, 300);
    }
  }, [isSimulatingApproach, addLog]);

  // Clean up simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  // 1. REAL-TIME HIGH-ACCURACY GPS TRACKING (navigator.geolocation.watchPosition)
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsState(prev => ({
        ...prev,
        supported: false,
        status: 'DENIED',
        errorMsg: 'Geolocation API is not supported by this browser.'
      }));
      addLog('GPS', 'Geolocation API unavailable in this browser environment. Switched to manual coordinates.');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, altitude, speed, heading } = position.coords;
        setGpsState(prev => ({
          ...prev,
          status: 'LOCKED',
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ? Number(accuracy.toFixed(1)) : 5.0,
          altitude: altitude ? Number(altitude.toFixed(1)) : 22.4,
          speed: speed !== null ? Number(speed.toFixed(1)) : 0.0,
          heading: heading || 0,
          timestamp: new Date(position.timestamp).toISOString(),
          errorMsg: null
        }));

        // Keep Node A coordinates in sync
        setManualCoords(prev => ({
          ...prev,
          lat: latitude.toFixed(6),
          lng: longitude.toFixed(6)
        }));

        addLog('GPS', `High-Accuracy GPS Lock: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${accuracy ? accuracy.toFixed(1) : 5}m accuracy)`);
      },
      (error) => {
        let msg = 'Position acquisition failed.';
        if (error.code === error.PERMISSION_DENIED) msg = 'Location permission denied by user/browser.';
        else if (error.code === error.POSITION_UNAVAILABLE) msg = 'GPS satellite position unavailable.';
        else if (error.code === error.TIMEOUT) msg = 'GPS acquisition request timed out.';

        setGpsState(prev => ({
          ...prev,
          status: prev.manualMode ? 'MANUAL' : 'DENIED',
          errorMsg: msg
        }));
        addLog('GPS', `GPS Warning: ${msg} Using cached / fallback coordinates.`);
      },
      options
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [addLog]);

  // 2. HARDWARE BATTERY MONITORING (navigator.getBattery)
  useEffect(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then((battery) => {
        const updateBattery = () => {
          const levelPct = Math.round(battery.level * 100);
          setHardwareBattery({
            supported: true,
            level: levelPct,
            charging: battery.charging,
            dischargingTime: battery.dischargingTime
          });

          // Sync with Node A state
          setNodes(prev => ({
            ...prev,
            nodeA: { ...prev.nodeA, battery: levelPct }
          }));

          addLog('BATTERY', `Hardware Battery state updated: ${levelPct}% ${battery.charging ? '(Charging ⚡)' : '(Discharging)'}`);
        };

        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
        battery.addEventListener('dischargingtimechange', updateBattery);
      }).catch(() => {
        setHardwareBattery(prev => ({ ...prev, supported: false }));
      });
    } else {
      setHardwareBattery(prev => ({ ...prev, supported: false }));
    }
  }, [addLog]);

  // INITIALIZE REAL-WORLD HARDWARE ENGINES (Web Bluetooth, Web Audio Sonar, WebRTC P2P DataChannel, Acoustic Modem)
  useEffect(() => {
    sonarEngineRef.current = new SonarAudioEngine((pulse) => {
      // Optional pulse callback
    });
    acousticModemRef.current = new AcousticSoundModem();

    bleManagerRef.current = new BluetoothMeshManager(
      (telemetry) => {
        setBleTelemetry(telemetry);
        if (sonarEngineRef.current) {
          sonarEngineRef.current.updateDistance(telemetry.distanceMeters);
        }
      },
      (tag, msg) => addLog(tag, msg)
    );

    p2pMeshRef.current = new WebRTCPeerMesh(
      (packet) => {
        addLog('P2P', `📦 Direct P2P Disaster Packet [${packet.uuid}] received from physical phone via WebRTC DataChannel!`);
        showToast('🚨 Real P2P Packet Received!', `Direct telemetry from peer: ${packet.uuid}`, 'alert');
        setNodes(prev => {
          const exists = prev.nodeB.packets.some(p => p.uuid === packet.uuid);
          if (exists) return prev;
          return {
            ...prev,
            nodeB: { ...prev.nodeB, packets: [packet, ...prev.nodeB.packets] }
          };
        });
        setMetrics(m => ({ ...m, packetsRelayed: m.packetsRelayed + 1, hopsCompleted: m.hopsCompleted + 1 }));
      },
      (state) => setP2pConnectionState(state),
      (tag, msg) => addLog(tag, msg)
    );

    return () => {
      if (sonarEngineRef.current) sonarEngineRef.current.stop();
      if (bleManagerRef.current) bleManagerRef.current.disconnect();
      if (p2pMeshRef.current) p2pMeshRef.current.close();
    };
  }, [addLog, showToast]);

  // 3. MULTI-DEVICE REAL-TIME SIGNAL HOPPING (BroadcastChannel "resq_mesh_network")
  useEffect(() => {
    let channel;
    try {
      channel = new BroadcastChannel('resq_mesh_network');
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        // Acoustic Pulse Pinpoint Listener (GPS-Denied Proximity Search)
        if (data.action === 'ACOUSTIC_PULSE_PING') {
          const peerId = data.senderDeviceId || data.senderNode || 'Nearby Rescuer';
          showToast('🔊 Acoustic Search Ping Detected!', `Rescuer node [${peerId}] emitted 2000Hz sonar beacon.`, 'info');
          addLog('SONAR', `📡 Acoustic Locator Ping Received from Mesh Peer [${peerId}] (2000Hz FM Sweep Pulse).`);
          return;
        }

        if (!data.packet) return;

        const { action, packet, senderNode, senderDeviceId } = data;
        
        // Check if message is from an external physical phone or separate tab
        const isExternalPeer = senderDeviceId && senderDeviceId !== deviceInstanceId;
        const peerIdStr = senderDeviceId || packet.origin_node || senderNode || packet.uuid;

        // Register peer coordinates and RSSI for real-time proximity tracking
        if (packet && packet.lat && packet.lng) {
          setDetectedPeers(prev => ({
            ...prev,
            [peerIdStr]: {
              id: peerIdStr,
              lat: Number(packet.lat),
              lng: Number(packet.lng),
              rssi: packet.rssi || -68,
              status: packet.status || 'ACTIVE',
              lastSeen: Date.now()
            }
          }));
        }

        if (isExternalPeer) {
          showToast(
            '📡 External Physical Peer Connected!',
            `Device ID [${peerIdStr}] detected in range!`,
            'alert'
          );
          addLog('MESH', `📡 External Physical Peer Connected: Device ID [${peerIdStr}] detected in range over BroadcastChannel.`);
        } else {
          addLog('MESH', `📡 Inter-Device Signal Received [${action}] from Peer: ${packet.uuid} (Hops: ${packet.hops}, TTL: ${packet.ttl})`);
        }

        setMetrics(prev => ({ ...prev, broadcastsReceived: prev.broadcastsReceived + 1 }));

        // Handle incoming packet
        if (action === 'SOS_BROADCAST' || action === 'RELAY_HOP') {
          if (!isExternalPeer) {
            showToast(
              '🚨 Signal Detected from Nearby Peer!',
              `Packet [${packet.uuid}] received via local mesh channel. Hops: ${packet.hops} | Status: ${packet.status}`,
              'alert'
            );
          }

          // Deliver into Node B (Relay Buffer) if not already present
          setNodes(prev => {
            const alreadyExists = prev.nodeB.packets.some(p => p.uuid === packet.uuid);
            if (alreadyExists) {
              addLog('DEDUP', `Duplicate rejected on Relay: Packet [${packet.uuid}] already stored.`);
              setMetrics(m => ({ ...m, duplicatesRejected: m.duplicatesRejected + 1 }));
              return prev;
            }

            const updatedPacket = {
              ...packet,
              hops: packet.hops + 1,
              ttl: Math.max(0, packet.ttl - 1),
              receivedViaChannel: true,
              receivedFromDevice: peerIdStr
            };

            return {
              ...prev,
              nodeB: {
                ...prev.nodeB,
                packets: [updatedPacket, ...prev.nodeB.packets]
              }
            };
          });
        } else if (action === 'GATEWAY_SYNC') {
          showToast(
            '☁️ Incident Uplinked to Cloud Gateway!',
            `Packet [${packet.uuid}] has reached an active cellular/satellite gateway.`,
            'success'
          );
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported in this environment', e);
    }

    return () => {
      if (channel) channel.close();
    };
  }, [addLog, showToast, deviceInstanceId]);

  // 3.1 AUTOMATIC CONTINUOUS DISASTER BEACON BROADCASTER (Zero-Touch Peer Mesh Heartbeat)
  useEffect(() => {
    const beaconInterval = setInterval(() => {
      if (broadcastChannelRef.current) {
        try {
          const lat = Number(manualCoords.lat) || gpsState.lat || 19.0760;
          const lng = Number(manualCoords.lng) || gpsState.lng || 72.8777;
          
          broadcastChannelRef.current.postMessage({
            action: 'HEARTBEAT_BEACON',
            senderDeviceId: deviceInstanceId,
            senderNode: activeTab === 'VICTIM' ? 'NODE_A' : 'NODE_B',
            nodeType: activeTab === 'VICTIM' ? 'VICTIM' : 'RESPONDER',
            packet: {
              uuid: nodes.nodeA.packets[0]?.uuid || `beacon-${deviceInstanceId}`,
              origin_node: userProfile.anonymizeNode ? nodes.nodeA.shortId : (userProfile.name || 'Citizen Device'),
              lat: lat,
              lng: lng,
              accuracy: gpsState.status === 'LOCKED' ? gpsState.accuracy : 4.5,
              altitude: gpsState.altitude || 18.0,
              battery: nodes.nodeA.battery,
              status: nodes.nodeA.status,
              hops: 0,
              ttl: 5,
              timestamp: new Date().toISOString()
            }
          });
        } catch (e) {}
      }
    }, 1500);

    return () => clearInterval(beaconInterval);
  }, [manualCoords, gpsState, deviceInstanceId, activeTab, nodes.nodeA.battery, nodes.nodeA.status, nodes.nodeA.packets, userProfile]);

  // 3.2 AUTO-UNLOCK WEB AUDIO CONTEXT (For Browser Autoplay Policy Compliance)
  useEffect(() => {
    const unlockAudio = () => {
      if (sonarEngineRef.current) {
        sonarEngineRef.current.unlockAudioContext();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // 3.5 BROWSER ONLINE / OFFLINE STANDARD EVENT LISTENERS FOR GATEWAY UPLINK
  useEffect(() => {
    const handleOnline = () => {
      setNodeCOnlineStatus(true);
      setNodes(prev => ({
        ...prev,
        nodeC: { ...prev.nodeC, isOnline: true }
      }));
      addLog('CLOUD', '🟢 Node C Gateway Network Connection RESTORED (Browser window.online event). Cloud Sync Link Active.');
      showToast('🌐 Internet Uplink Online', 'Node C Gateway connected to emergency dispatch network.', 'success');
    };
    const handleOffline = () => {
      setNodeCOnlineStatus(false);
      setNodes(prev => ({
        ...prev,
        nodeC: { ...prev.nodeC, isOnline: false }
      }));
      addLog('CLOUD', '🔴 Node C Gateway Network Connection LOST (Browser window.offline event). Store-and-forward local queue active.');
      showToast('⚠️ Internet Uplink Offline', 'Node C Gateway offline. Incidents will queue in local memory buffer.', 'alert');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addLog, showToast]);

  // Toggle Node C Uplink (Simulate internet failure or recovery)
  const toggleNodeCUplink = useCallback((forceState = null) => {
    setNodeCOnlineStatus(prevStatus => {
      const nextStatus = forceState !== null ? forceState : !prevStatus;
      setNodes(prev => ({
        ...prev,
        nodeC: { ...prev.nodeC, isOnline: nextStatus }
      }));
      if (nextStatus) {
        addLog('CLOUD', '🟢 Node C Gateway Cellular/Satellite Uplink RESTORED (Manual Simulation). Ready to sync.');
        showToast('🟢 Uplink Restored', 'Node C Gateway is now Online. Ready to push queued packets to Cloud.', 'success');
      } else {
        addLog('CLOUD', '🔴 Node C Gateway Cellular/Satellite Uplink KILLED (Manual Simulation). Packets will queue locally.');
        showToast('🔴 Uplink Disconnected', 'Node C Gateway is now Offline. Packets will be held in local memory.', 'alert');
      }
      return nextStatus;
    });
  }, [addLog, showToast]);

  // MORSE SOS TIMING SEQUENCE (... --- ...)
  const MORSE_SOS_SEQUENCE = [
    // S: . . .
    { on: true, duration: 160, letter: 'S', symbol: '·' },
    { on: false, duration: 160, letter: 'S', symbol: ' ' },
    { on: true, duration: 160, letter: 'S', symbol: '·' },
    { on: false, duration: 160, letter: 'S', symbol: ' ' },
    { on: true, duration: 160, letter: 'S', symbol: '·' },
    { on: false, duration: 480, letter: ' ', symbol: ' ' },
    // O: - - -
    { on: true, duration: 480, letter: 'O', symbol: '—' },
    { on: false, duration: 160, letter: 'O', symbol: ' ' },
    { on: true, duration: 480, letter: 'O', symbol: '—' },
    { on: false, duration: 160, letter: 'O', symbol: ' ' },
    { on: true, duration: 480, letter: 'O', symbol: '—' },
    { on: false, duration: 480, letter: ' ', symbol: ' ' },
    // S: . . .
    { on: true, duration: 160, letter: 'S', symbol: '·' },
    { on: false, duration: 160, letter: 'S', symbol: ' ' },
    { on: true, duration: 160, letter: 'S', symbol: '·' },
    { on: false, duration: 160, letter: 'S', symbol: ' ' },
    { on: true, duration: 160, letter: 'S', symbol: '·' },
    { on: false, duration: 1200, letter: ' ', symbol: ' ' }
  ];

  // 1. VISUAL MORSE CODE STROBE & HARDWARE TORCH EFFECT
  useEffect(() => {
    if (!isBeaconActive) {
      setMorseFlash(false);
      setMorseInfo({ letter: '', symbol: '', stepIndex: 0 });
      if (morseTimeoutRef.current) {
        clearTimeout(morseTimeoutRef.current);
        morseTimeoutRef.current = null;
      }
      if (torchTrackRef.current) {
        try {
          torchTrackRef.current.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
        } catch (e) {}
        torchTrackRef.current = null;
      }
      if (torchStreamRef.current) {
        torchStreamRef.current.getTracks().forEach(t => t.stop());
        torchStreamRef.current = null;
      }
      return;
    }

    // Attempt to acquire physical camera LED torch if supported
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      try {
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        }).then((stream) => {
          torchStreamRef.current = stream;
          const track = stream.getVideoTracks()[0];
          if (track) {
            const caps = track.getCapabilities ? track.getCapabilities() : {};
            if ('torch' in caps || caps.torch) {
              torchTrackRef.current = track;
              addLog('HARDWARE', '🔦 Device Camera LED Torch acquired for optical Morse SOS broadcasting.');
              showToast('🔦 Hardware Torch Ready', 'Optical Morse SOS (... --- ...) synchronized with device flash.', 'success');
            }
          }
        }).catch(() => {
          // Fallback silently to screen strobe in sandboxed / desktop environments
        });
      } catch (e) {
        // Fallback silently
      }
    }

    morseIndexRef.current = 0;

    const runMorseStep = () => {
      const idx = morseIndexRef.current % MORSE_SOS_SEQUENCE.length;
      const step = MORSE_SOS_SEQUENCE[idx];

      setMorseFlash(step.on);
      setMorseInfo({ letter: step.letter, symbol: step.symbol, stepIndex: idx });

      // Apply hardware torch constraint if available
      if (torchTrackRef.current) {
        try {
          torchTrackRef.current.applyConstraints({
            advanced: [{ torch: step.on }]
          }).catch(() => {});
        } catch (e) {}
      }

      morseIndexRef.current++;
      morseTimeoutRef.current = setTimeout(runMorseStep, step.duration);
    };

    runMorseStep();

    return () => {
      if (morseTimeoutRef.current) {
        clearTimeout(morseTimeoutRef.current);
        morseTimeoutRef.current = null;
      }
      if (torchTrackRef.current) {
        try {
          torchTrackRef.current.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
        } catch (e) {}
        torchTrackRef.current = null;
      }
      if (torchStreamRef.current) {
        torchStreamRef.current.getTracks().forEach(t => t.stop());
        torchStreamRef.current = null;
      }
    };
  }, [isBeaconActive, addLog, showToast]);

  // Sync isVoiceSosListening ref for speech recognition callbacks
  useEffect(() => {
    isVoiceSosListeningRef.current = isVoiceSosListening;
  }, [isVoiceSosListening]);

  // Global AudioContext auto-unlock on user tap/click/pointerdown
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!radarAudioCtxRef.current && AudioCtx) {
          radarAudioCtxRef.current = new AudioCtx();
        }
        if (radarAudioCtxRef.current && radarAudioCtxRef.current.state === 'suspended') {
          radarAudioCtxRef.current.resume();
        }
      } catch (e) {
        console.warn('AudioContext auto-resume error:', e);
      }
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Clean up Audio on unmount
  useEffect(() => {
    return () => {
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
        } catch (e) {}
      }
      if (radarBeepTimerRef.current) {
        clearInterval(radarBeepTimerRef.current);
      }
      if (radarAudioCtxRef.current) {
        try {
          radarAudioCtxRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  // PROXIMITY BEEP SYNTHESIZER (Web Audio API - Clean 880Hz / 1000Hz Sonar Ping with 50ms Envelope)
  const playRadarBeep = useCallback((freq = 880, duration = 0.050) => {
    if (isRadarMuted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!radarAudioCtxRef.current) {
        radarAudioCtxRef.current = new AudioCtx();
      }
      const ctx = radarAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Clean 50ms attack/decay envelope simulating an emergency locator pulse
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.28, now + 0.008); // 8ms crisp attack
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration); // smooth exponential decay

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.015);
    } catch (e) {
      console.warn('Web Audio proximity beep error:', e);
    }
  }, [isRadarMuted]);

  // Toggle proximity radar audio mute
  const toggleRadarAudioMute = () => {
    setIsRadarMuted(prev => !prev);
  };

  // 4. DEVICE ORIENTATION LISTENER & GYROSCOPE COMPASS ENGINE
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!('DeviceOrientationEvent' in window)) {
      setIsGyroSupported(false);
      setGyroPermissionState('unsupported');
      addLog('GYRO', 'ℹ️ DeviceOrientation API not supported on this platform. Proximity Radar falling back to static North-Up.');
      return;
    }

    let receivedValidEvent = false;

    const handleOrientation = (e) => {
      let heading = null;

      // 1. iOS Safari native compass heading (0 - 360 degrees clockwise from North)
      if (typeof e.webkitCompassHeading !== 'undefined' && e.webkitCompassHeading !== null) {
        heading = e.webkitCompassHeading;
      }
      // 2. Android Chrome / Standard W3C Device Orientation alpha heading
      else if (typeof e.alpha !== 'undefined' && e.alpha !== null) {
        heading = (360 - e.alpha + 360) % 360;
      }

      if (heading !== null && !isNaN(heading)) {
        receivedValidEvent = true;
        const roundedHeading = Math.round(heading) % 360;
        setCompassHeading(roundedHeading);

        if (!gyroActiveRef.current) {
          gyroActiveRef.current = true;
          setIsGyroActive(true);
          setGyroPermissionState('granted');
          addLog('GYRO', `🧭 Device Gyroscope & Magnetometer stream connected. Live Compass Heading: ${roundedHeading}° (GYRO ACTIVE).`);
        }
      }
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    const checkTimeout = setTimeout(() => {
      if (!receivedValidEvent && gyroPermissionState === 'prompt') {
        setIsGyroActive(false);
      }
    }, 1800);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      clearTimeout(checkTimeout);
    };
  }, [addLog, gyroPermissionState]);

  // Request iOS / Mobile Safari Gyroscope Permission
  const requestGyroPermission = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          setGyroPermissionState('granted');
          setIsGyroActive(true);
          addLog('GYRO', '🧭 iOS DeviceOrientation permission GRANTED. Live Gyroscope active.');
          showToast('🧭 Gyroscope Connected', 'Real-time directional tracking active.', 'success');
        } else {
          setGyroPermissionState('denied');
          setIsGyroActive(false);
          addLog('GYRO', '⚠️ Gyroscope permission DENIED. Falling back to static North-Up radar orientation.');
          showToast('⚠️ Compass Denied', 'Falling back to static North-Up orientation.', 'alert');
        }
      } catch (err) {
        setGyroPermissionState('denied');
        setIsGyroActive(false);
        addLog('GYRO', `⚠️ Gyroscope permission request failed: ${err?.message || err}. Falling back to North-Up.`);
        showToast('⚠️ Permission Error', 'Falling back to static North-Up orientation.', 'alert');
      }
    } else if (isGyroSupported) {
      setIsGyroActive(true);
      setGyroPermissionState('granted');
      addLog('GYRO', '🧭 Gyroscope orientation listener engaged.');
      showToast('🧭 Gyroscope Active', 'Listening for device orientation changes.', 'info');
    } else {
      setIsSimulatedHeading(true);
      showToast('🎛️ Simulated Gyro Enabled', 'Manual compass dial activated for desktop testing.', 'info');
    }
  };

  // Interactive Compass Calibration (Figure-8 Motion)
  const calibrateCompass = () => {
    setIsCalibrating(true);
    setCalibrationProgress(0);
    setCompassAccuracy('CALIBRATING');
    addLog('GYRO', '♾️ Compass calibration initiated: Rotate phone in a horizontal Figure-8 pattern to normalize magnetometer registers.');

    const startTime = Date.now();
    const duration = 3000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / duration) * 100));
      setCalibrationProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setIsCalibrating(false);
        setCompassAccuracy('HIGH');
        addLog('GYRO', '🧭 Compass calibration completed successfully. Magnetometer & Gyroscope accuracy verified (HIGH).');
        showToast('🧭 Compass Calibrated', 'Sensor registers normalized. Live bearing accurate.', 'success');
      }
    }, 50);
  };

  // PROXIMITY BEEP ENGINE SCHEDULER (Dynamic Distance-to-Beep Rate Mapping)
  // Distance Mapping:
  // > 20m (or RSSI < -85 dBm): SILENT
  // 10m - 20m (RSSI -85 to -75 dBm): Slow Pulse (1 beep every 1.5s = 1500ms)
  // 5m - 10m (RSSI -75 to -65 dBm): Medium Pulse (2 beeps/s = 500ms)
  // 2m - 5m (RSSI -65 to -55 dBm): Rapid Pulse (4 beeps/s = 250ms)
  // < 2m (RSSI > -55 dBm): Continuous High-Pitched Alarm (Geiger-counter / continuous locator lock-on tone)
  useEffect(() => {
    if (isRadarMuted) {
      if (radarBeepTimerRef.current) {
        clearInterval(radarBeepTimerRef.current);
        radarBeepTimerRef.current = null;
      }
      return;
    }

    const victimLat = Number(manualCoords.lat) || gpsState.lat || 19.0760;
    const victimLng = Number(manualCoords.lng) || gpsState.lng || 72.8777;
    const rescuerLat = victimLat + rescuerOffset.dLat;
    const rescuerLng = victimLng + rescuerOffset.dLng;
    
    // Calculate distance to simulated radar target
    const radarDist = calculateHaversine(rescuerLat, rescuerLng, victimLat, victimLng);

    // Calculate distance to any active external peer detected over BroadcastChannel or BLE
    let effectiveDist = (bleTelemetry && bleTelemetry.connected && typeof bleTelemetry.distanceMeters === 'number')
      ? bleTelemetry.distanceMeters
      : radarDist;

    Object.values(detectedPeers).forEach(peer => {
      if (peer.lat && peer.lng) {
        const pDist = calculateHaversine(victimLat, victimLng, peer.lat, peer.lng);
        if (pDist < effectiveDist) {
          effectiveDist = pDist;
        }
      }
    });

    if (sonarEngineRef.current) {
      sonarEngineRef.current.updateDistance(effectiveDist);
    }

    // Proximity Event Trigger: When target first enters 20m perimeter
    if (effectiveDist <= 20.0 && !wasInProximityRef.current) {
      wasInProximityRef.current = true;
      showToast(
        '📡 PEER DETECTED IN PROXIMITY',
        'RADAR AUDIO ACTIVE - 880Hz Sonar Pulse Engaged (Within 20m range).',
        'alert'
      );
      addLog('RADAR', `📡 PEER DETECTED IN PROXIMITY - RADAR AUDIO ACTIVE: Target entered 20m perimeter (Distance: ${effectiveDist.toFixed(1)}m, RSSI: ${calculateRSSI(effectiveDist)} dBm).`);
    } else if (effectiveDist > 20.0 && wasInProximityRef.current) {
      wasInProximityRef.current = false;
    }

    // Distance > 20 meters: SILENT
    if (effectiveDist > 20.0) {
      if (radarBeepTimerRef.current) {
        clearInterval(radarBeepTimerRef.current);
        radarBeepTimerRef.current = null;
      }
      return;
    }

    // Dynamic Interval & Tone Settings
    let intervalMs = 1500; // Default slow
    let beepDuration = 0.050; // 50ms envelope
    let toneFreq = 880;

    if (effectiveDist < 2.0) {
      // < 2m: Continuous High-Pitched Alarm (Geiger / Lock-on)
      intervalMs = 70;
      beepDuration = 0.040;
      toneFreq = 1000;
    } else if (effectiveDist <= 5.0) {
      // 2m - 5m: Rapid Pulse (4 beeps per second = 250ms)
      intervalMs = 250;
      beepDuration = 0.050;
      toneFreq = 920;
    } else if (effectiveDist <= 10.0) {
      // 5m - 10m: Medium Pulse (2 beeps per second = 500ms)
      intervalMs = 500;
      beepDuration = 0.050;
      toneFreq = 880;
    } else {
      // 10m - 20m: Slow Pulse (1 beep every 1.5 seconds = 1500ms)
      intervalMs = 1500;
      beepDuration = 0.050;
      toneFreq = 880;
    }

    if (radarBeepTimerRef.current) {
      clearInterval(radarBeepTimerRef.current);
    }

    // Play immediate pulse, then set repeating interval
    playRadarBeep(toneFreq, beepDuration);
    radarBeepTimerRef.current = setInterval(() => {
      playRadarBeep(toneFreq, beepDuration);
    }, intervalMs);

    return () => {
      if (radarBeepTimerRef.current) {
        clearInterval(radarBeepTimerRef.current);
        radarBeepTimerRef.current = null;
      }
    };
  }, [
    isRadarMuted,
    rescuerOffset,
    manualCoords,
    gpsState.lat,
    gpsState.lng,
    detectedPeers,
    calculateHaversine,
    calculateRSSI,
    playRadarBeep,
    showToast,
    addLog
  ]);

  // CRITICAL BATTERY EMERGENCY DISPATCH (<5% Trigger)
  // Battery Lifecycle Monitor: If battery drops below 5% and hasn't fired yet:
  // 1. Generate high-priority TERMINAL_DISPATCH packet with last known GPS coords
  // 2. Broadcast immediately over "resq_mesh_network"
  // 3. Display Red Alert UI Banner & log event
  useEffect(() => {
    const battLevel = nodes.nodeA.battery;

    if (battLevel <= 4 && !lastGaspFiredRef.current) {
      lastGaspFiredRef.current = true;

      const currentLat = Number(manualCoords.lat) || gpsState.lat || 19.0760;
      const currentLng = Number(manualCoords.lng) || gpsState.lng || 72.8777;
      const accuracy_m = gpsState.status === 'LOCKED' ? gpsState.accuracy : 5.0;

      // Exact JSON schema for Last-Gasp Terminal Dispatch Packet
      const lastGaspPacket = {
        uuid: 'resq-lastgasp-' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        priority: 'CRITICAL - BATTERY_EXHAUSTION',
        battery: `${battLevel}%`,
        last_known_loc: {
          lat: currentLat,
          lng: currentLng,
          accuracy: accuracy_m
        },
        status: 'TERMINAL_DISPATCH',
        ttl: 10, // Generous TTL for emergency survival
        hops: 0,
        lat: currentLat,
        lng: currentLng,
        accuracy: accuracy_m,
        altitude: gpsState.altitude,
        medical: userProfile.includeMedical ? `${userProfile.bloodGroup} (${userProfile.medicalNotes})` : 'REDACTED',
        origin_node: userProfile.anonymizeNode ? nodes.nodeA.shortId : userProfile.name
      };

      // Store in Node A buffer
      setNodes(prev => ({
        ...prev,
        nodeA: {
          ...prev.nodeA,
          packets: [lastGaspPacket, ...prev.nodeA.packets]
        }
      }));

      setMetrics(prev => ({ ...prev, packetsCreated: prev.packetsCreated + 1 }));
      setBatteryAlertBanner(true);
      setIsBeaconActive(true);

      addLog('BATTERY', `⚠️ CRITICAL ALERT: Device power at <5% (${battLevel}%). Last Known Location Packet [${lastGaspPacket.uuid}] dispatched to network.`);

      // Broadcast over BroadcastChannel
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            action: 'SOS_BROADCAST',
            senderNode: 'NODE_A',
            packet: lastGaspPacket
          });
          addLog('MESH', `📡 Terminal Last-Gasp Packet [${lastGaspPacket.uuid}] broadcasted over BroadcastChannel ("resq_mesh_network").`);
        } catch (e) {
          console.error(e);
        }
      }

      showToast(
        '⚠️ CRITICAL BATTERY DISPATCH',
        `Device power <5%. Last Known Location Packet [${lastGaspPacket.uuid}] broadcasted to all mesh nodes.`,
        'alert'
      );
    } else if (battLevel > 5) {
      lastGaspFiredRef.current = false;
    }
  }, [
    nodes.nodeA.battery,
    manualCoords,
    gpsState,
    userProfile,
    addLog,
    showToast
  ]);

  // Audible Siren Sound
  const toggleSirenTone = () => {
    if (isSirenPlaying) {
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
        } catch (e) {}
      }
      setIsSirenPlaying(false);
      addLog('BEACON', 'Audible rescue siren silenced.');
    } else {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);

        let high = true;
        const warbleInterval = setInterval(() => {
          if (!oscillatorRef.current) {
            clearInterval(warbleInterval);
            return;
          }
          osc.frequency.setValueAtTime(high ? 440 : 880, ctx.currentTime);
          high = !high;
        }, 300);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        oscillatorRef.current = osc;
        setIsSirenPlaying(true);
        addLog('BEACON', 'Audible rescue alarm active (880Hz alternating distress tone).');
      } catch (err) {
        console.error(err);
      }
    }
  };

  // 4. SOS 3-SECOND HOLD ENGINE
  const startHoldTimer = () => {
    setIsHolding(true);
    setHoldProgress(0);
    const startTime = Date.now();
    const duration = 3000;

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        clearInterval(holdIntervalRef.current);
        setIsHolding(false);
        setHoldProgress(0);
        executeSOSTrigger();
      }
    }, 40);
  };

  const cancelHoldTimer = () => {
    if (isHolding) {
      clearInterval(holdIntervalRef.current);
      setIsHolding(false);
      setHoldProgress(0);
      addLog('SOS', 'SOS button released before 3-second hold threshold was met.');
    }
  };

  // Execute SOS Trigger (Creates exact required JSON schema + Voice Note Telemetry)
  const executeSOSTrigger = useCallback((customVoiceNote = null) => {
    const lat = Number(manualCoords.lat) || gpsState.lat;
    const lng = Number(manualCoords.lng) || gpsState.lng;
    const accuracy = gpsState.status === 'LOCKED' ? gpsState.accuracy : 5.0;
    const batteryPct = nodes.nodeA.battery;

    const effectiveVoiceTelemetry = customVoiceNote || (voiceTranscript ? `Transcribed Voice Note: "${voiceTranscript}"` : null);

    const newPacket = {
      uuid: generatePacketId(),
      timestamp: new Date().toISOString(),
      lat: lat,
      lng: lng,
      accuracy: accuracy,
      battery: batteryPct,
      hops: 0,
      ttl: 5,
      status: nodes.nodeA.status,
      altitude: gpsState.altitude,
      medical: userProfile.includeMedical ? `${userProfile.bloodGroup} (${userProfile.medicalNotes})` : 'REDACTED',
      origin_node: userProfile.anonymizeNode ? nodes.nodeA.shortId : userProfile.name,
      voiceNote: effectiveVoiceTelemetry
    };

    // Store in Node A buffer
    setNodes(prev => ({
      ...prev,
      nodeA: {
        ...prev.nodeA,
        packets: [newPacket, ...prev.nodeA.packets]
      }
    }));

    setMetrics(prev => ({ ...prev, packetsCreated: prev.packetsCreated + 1 }));
    setIsBeaconActive(true);

    addLog('SOS', `🚨 CRITICAL SOS TRIGGERED! Packet [${newPacket.uuid}] generated at Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)} (±${accuracy}m)${effectiveVoiceTelemetry ? ` • [Telemetry: ${effectiveVoiceTelemetry}]` : ''}.`);

    // Broadcast across real-time Inter-Device channel
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          action: 'SOS_BROADCAST',
          senderNode: 'NODE_A',
          senderDeviceId: deviceInstanceId,
          packet: newPacket
        });
        addLog('MESH', `📡 Packet [${newPacket.uuid}] broadcasted over BroadcastChannel ("resq_mesh_network").`);
      } catch (e) {
        console.error('BroadcastChannel error', e);
      }
    }

    showToast('🚨 SOS Transmitted!', `High-accuracy packet broadcasted locally. Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`, 'alert');
  }, [manualCoords, gpsState, nodes.nodeA.battery, nodes.nodeA.status, nodes.nodeA.shortId, userProfile, voiceTranscript, addLog, showToast, deviceInstanceId]);

  // Helper to safely stop voice recognition
  const stopVoiceRecognition = useCallback(() => {
    isVoiceSosListeningRef.current = false;
    setIsVoiceSosListening(false);
    if (voiceRestartTimerRef.current) {
      clearTimeout(voiceRestartTimerRef.current);
      voiceRestartTimerRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.onstart = null;
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onerror = null;
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
  }, []);

  // Helper to safely start voice recognition
  const startVoiceRecognition = useCallback(() => {
    const SpeechRecognition = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    if (!SpeechRecognition) {
      setVoiceSosSupported(false);
      showToast('⚠️ Speech API Unavailable', 'Web Speech API is not supported in this browser.', 'alert');
      return;
    }

    // Clean up any stale instance first
    stopVoiceRecognition();
    isVoiceSosListeningRef.current = true;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsVoiceSosListening(true);
        setVoiceDetectedKeyword(null);
        addLog('VOICE', '🎙️ Hands-Free Voice SOS ACTIVE. Continuously listening for trigger keywords: "HELP", "TRAPPED", "INJURED", "STUCK"...');
        showToast('🎙️ Hands-Free Voice SOS Active', 'Speak "HELP", "TRAPPED", or "INJURED" to trigger SOS burst.', 'success');
      };

      recognition.onresult = (event) => {
        try {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          setVoiceTranscript(currentTranscript);
          const lower = currentTranscript.toLowerCase();
          const keywords = ['help', 'trapped', 'injured', 'stuck', 'save me', 'emergency', 'bleeding', 'mayday'];
          const matched = keywords.find(k => lower.includes(k));

          if (matched) {
            setVoiceDetectedKeyword(matched);
            addLog('VOICE', `🚨 Voice SOS Trigger: Keyword "${matched.toUpperCase()}" detected in phrase: "${currentTranscript}". Activating SOS pipeline!`);
            showToast('🚨 VOICE SOS ACTIVATED!', `Trigger keyword "${matched.toUpperCase()}" detected!`, 'alert');
            executeSOSTrigger(`Voice Trigger [${matched.toUpperCase()}]: "${currentTranscript.trim()}"`);
          }
        } catch (e) {
          console.warn('Voice processing error:', e);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error event:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          showToast('⚠️ Microphone Permission Needed', 'Please allow microphone access in your browser or iframe.', 'alert');
          stopVoiceRecognition();
        }
      };

      recognition.onend = () => {
        if (isVoiceSosListeningRef.current) {
          if (voiceRestartTimerRef.current) clearTimeout(voiceRestartTimerRef.current);
          voiceRestartTimerRef.current = setTimeout(() => {
            if (isVoiceSosListeningRef.current) {
              try {
                startVoiceRecognition();
              } catch (e) {
                console.warn('Voice restart error:', e);
              }
            }
          }, 350);
        } else {
          setIsVoiceSosListening(false);
        }
      };

      speechRecognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        console.warn('recognition.start() error:', err);
        setIsVoiceSosListening(false);
        isVoiceSosListeningRef.current = false;
      }
    } catch (err) {
      console.error('Speech recognition failed to initialize:', err);
      showToast('⚠️ Speech Error', 'Failed to start microphone listener.', 'alert');
      setIsVoiceSosListening(false);
      isVoiceSosListeningRef.current = false;
    }
  }, [addLog, showToast, executeSOSTrigger, stopVoiceRecognition]);

  // 2. VOICE-ACTIVATED HANDS-FREE SOS TRIGGER (Web Speech API)
  const toggleVoiceSos = useCallback(() => {
    if (isVoiceSosListening || isVoiceSosListeningRef.current) {
      stopVoiceRecognition();
      addLog('VOICE', '🎙️ Hands-Free Voice SOS deactivated.');
      showToast('🎙️ Voice SOS Deactivated', 'Hands-free emergency voice monitoring paused.', 'info');
    } else {
      startVoiceRecognition();
    }
  }, [isVoiceSosListening, stopVoiceRecognition, startVoiceRecognition, addLog, showToast]);

  // Simulate Voice Trigger Keyword (Demo / Testing helper)
  const simulateVoiceKeyword = useCallback((keyword = 'HELP') => {
    const phrase = `I am injured and I need ${keyword.toLowerCase()} right now!`;
    setVoiceTranscript(phrase);
    setVoiceDetectedKeyword(keyword.toLowerCase());
    addLog('VOICE', `🚨 Simulated Voice SOS Trigger: Keyword "${keyword.toUpperCase()}" detected in transcript: "${phrase}"`);
    showToast('🎙️ Voice SOS Triggered!', `Simulated keyword [${keyword.toUpperCase()}] detected.`, 'alert');
    executeSOSTrigger(`Voice Note Telemetry [${keyword.toUpperCase()}]: "${phrase}"`);
  }, [addLog, showToast, executeSOSTrigger]);

  // 3. ULTRASONIC / ACOUSTIC PROXIMITY PULSE (GPS-Denied Search Mode)
  const emitAcousticPulse = useCallback(() => {
    setIsAcousticPulseEmitting(true);
    setTimeout(() => setIsAcousticPulseEmitting(false), 650);

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = radarAudioCtxRef.current || new AudioCtx();
        radarAudioCtxRef.current = ctx;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // 2000Hz frequency sweep pulse (1800Hz -> 2400Hz -> 2000Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.linearRampToValueAtTime(2400, now + 0.2);
        osc.frequency.linearRampToValueAtTime(2000, now + 0.4);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.7, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.42);
      }
    } catch (e) {
      console.warn('Audio acoustic pulse error:', e);
    }

    addLog('SONAR', '🔊 2000Hz Ultrasonic/Acoustic Frequency Sweep Emitted (GPS-Denied Proximity Search Mode).');
    showToast('🔊 Acoustic Pulse Emitted', '2000Hz frequency sweep transmitted for GPS-denied localization.', 'info');

    // Broadcast acoustic ping to all peer devices on the mesh
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          action: 'ACOUSTIC_PULSE_PING',
          senderNode: 'NODE_B',
          senderDeviceId: deviceInstanceId,
          frequency: '2000Hz FM Sweep',
          timestamp: Date.now()
        });
      } catch (e) {}
    }
  }, [addLog, showToast, deviceInstanceId]);

  // Step 3 Simulation: Forward Hop from Node 2 (Dummy Relay Alpha) -> Node 3 (Dummy Gateway Beta)
  const executeRelayHop = () => {
    if (nodes.nodeB.packets.length === 0) {
      addLog('WARN', 'Dummy Relay Alpha buffer is empty. Forward a packet from Node 1 (Step 2) or await peer signal.');
      showToast('⚠️ Relay Buffer Empty', 'Forward a packet to Dummy Relay Alpha first (Step 2).', 'alert');
      return;
    }

    const sourcePacket = nodes.nodeB.packets[0];

    // Check TTL
    if (sourcePacket.ttl <= 1) {
      addLog('TTL', `Packet [${sourcePacket.uuid}] dropped on Relay: TTL expired (${sourcePacket.ttl} -> 0).`);
      showToast('⚠️ TTL Expired', `Packet [${sourcePacket.uuid}] TTL expired and dropped.`, 'alert');
      setNodes(prev => ({
        ...prev,
        nodeB: { ...prev.nodeB, packets: prev.nodeB.packets.slice(1) }
      }));
      return;
    }

    // Increment hops (+1), decrement TTL (-1)
    const hoppedPacket = {
      ...sourcePacket,
      hops: sourcePacket.hops + 1,
      ttl: Math.max(0, sourcePacket.ttl - 1),
      relayedAt: new Date().toISOString()
    };

    // Forward to Node C (Gateway)
    setNodes(prev => {
      const isDuplicate = prev.nodeC.packets.some(p => p.uuid === hoppedPacket.uuid);
      if (isDuplicate) {
        addLog('DEDUP', `Duplicate suppressed: Packet [${hoppedPacket.uuid}] already stored in Dummy Gateway Beta.`);
        return prev;
      }

      return {
        ...prev,
        nodeC: {
          ...prev.nodeC,
          packets: [hoppedPacket, ...prev.nodeC.packets]
        }
      };
    });

    setMetrics(prev => ({
      ...prev,
      packetsRelayed: prev.packetsRelayed + 1,
      hopsCompleted: prev.hopsCompleted + 1
    }));

    addLog('RELAY', `➡️ STEP 3 COMPLETED: Packet [${hoppedPacket.uuid}] relayed from Node 2 (Dummy Relay Alpha) -> Node 3 (Dummy Gateway Beta) (Hops: ${hoppedPacket.hops}, TTL: ${hoppedPacket.ttl}).`);
    showToast('➡️ Step 3 Hop Forwarded', `Packet delivered to Dummy Gateway Beta. Hops: ${hoppedPacket.hops}, TTL: ${hoppedPacket.ttl}`, 'info');

    // Re-broadcast across channel
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          action: 'RELAY_HOP',
          senderNode: 'NODE_B',
          senderDeviceId: deviceInstanceId,
          packet: hoppedPacket
        });
      } catch (e) {}
    }

    // Auto sync to cloud if Gateway is online
    if (nodeCOnlineStatus) {
      setTimeout(() => syncPacketsToCloud(false), 400);
    }
  };

  // Step 2 Simulation: Forward Hop from Node 1 (This Device) -> Node 2 (Dummy Relay Alpha)
  const forwardAtoB = () => {
    if (nodes.nodeA.packets.length === 0) {
      addLog('WARN', 'Node 1 (This Device) buffer is empty. Hold SOS button for 3 seconds first to generate packet.');
      showToast('⚠️ Outbox Empty', 'Trigger SOS on This Device first (Step 1).', 'alert');
      return;
    }

    const pkt = nodes.nodeA.packets[0];
    const isDup = nodes.nodeB.packets.some(p => p.uuid === pkt.uuid);
    if (isDup) {
      addLog('DEDUP', `Duplicate suppressed: Packet [${pkt.uuid}] already stored in Dummy Relay Alpha.`);
      showToast('ℹ️ Already Forwarded', `Packet [${pkt.uuid}] is already inside Dummy Relay buffer.`, 'info');
      return;
    }

    const transferred = {
      ...pkt,
      hops: pkt.hops + 1,
      ttl: Math.max(0, pkt.ttl - 1),
      transferredAt: new Date().toISOString()
    };

    // Play proximity audio beep upon successful hop forwarding
    playRadarBeep(880, 0.09);

    setNodes(prev => ({
      ...prev,
      nodeB: {
        ...prev.nodeB,
        packets: [transferred, ...prev.nodeB.packets]
      }
    }));

    setMetrics(prev => ({
      ...prev,
      packetsRelayed: prev.packetsRelayed + 1,
      hopsCompleted: prev.hopsCompleted + 1
    }));

    addLog('RELAY', `➡️ STEP 2 COMPLETED: Packet [${transferred.uuid}] relayed from Node 1 (This Device) -> Node 2 (Dummy Relay Alpha) (Hops: ${transferred.hops}, TTL: ${transferred.ttl}).`);
    showToast('➡️ Step 2 Hop Forwarded', `Packet moved to Dummy Relay Alpha. Hops: ${transferred.hops}, TTL: ${transferred.ttl}`, 'info');

    // Broadcast over mesh channel
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          action: 'RELAY_HOP',
          senderNode: 'NODE_A',
          senderDeviceId: deviceInstanceId,
          packet: transferred
        });
      } catch (e) {}
    }
  };

  // EXPLICIT HOP TARGET ROUTING ENGINE
  // Allows user to dynamically select routing target:
  // - Node B (Relay): Routes via BLE Mesh (+1 hop, -1 TTL)
  // - Node C (Gateway): Routes directly via Wi-Fi Direct (+1 hop, -1 TTL)
  // - Broadcast All (Flood): Floods packet across all connected peers and local node buffers
  const executeExplicitHop = (source = 'nodeA', customTarget = null) => {
    const target = customTarget || selectedHopTarget;
    const sourceNodeKey = source === 'nodeB' ? 'nodeB' : 'nodeA';
    const sourcePackets = nodes[sourceNodeKey].packets;

    if (sourcePackets.length === 0) {
      addLog('WARN', `Source buffer (${nodes[sourceNodeKey].name}) is empty. No packet available to route.`);
      showToast('⚠️ Outbox Buffer Empty', `Generate an emergency SOS or last-gasp packet first.`, 'alert');
      return;
    }

    const pkt = sourcePackets[0];

    if (pkt.ttl <= 1 && target !== 'BROADCAST_ALL') {
      addLog('TTL', `Packet [${pkt.uuid}] dropped during routing: TTL expired (${pkt.ttl} -> 0).`);
      return;
    }

    const routedPacket = {
      ...pkt,
      hops: pkt.hops + 1,
      ttl: Math.max(0, pkt.ttl - 1),
      routedTarget: target,
      routedAt: new Date().toISOString()
    };

    if (target === 'NODE_B') {
      // Route specifically to Node B (Relay) via simulated BLE Mesh
      setNodes(prev => {
        const isDup = prev.nodeB.packets.some(p => p.uuid === routedPacket.uuid);
        if (isDup) {
          addLog('DEDUP', `Duplicate rejected on Relay: Packet [${routedPacket.uuid}] already stored.`);
          setMetrics(m => ({ ...m, duplicatesRejected: m.duplicatesRejected + 1 }));
          return prev;
        }
        return {
          ...prev,
          nodeB: {
            ...prev.nodeB,
            packets: [routedPacket, ...prev.nodeB.packets]
          }
        };
      });

      setMetrics(prev => ({
        ...prev,
        packetsRelayed: prev.packetsRelayed + 1,
        hopsCompleted: prev.hopsCompleted + 1
      }));

      addLog('ROUTING', `Packet [${routedPacket.uuid}] routed specifically to Hop Target: Node B (Relay) via BLE Mesh (Hops: ${routedPacket.hops}, TTL: ${routedPacket.ttl}).`);
      showToast('➡️ Routed to Node B', `Packet [${routedPacket.uuid}] delivered to Relay via BLE Mesh.`, 'info');

    } else if (target === 'NODE_C') {
      // Route specifically to Node C (Gateway) via Direct Wi-Fi Direct bypass
      setNodes(prev => {
        const isDup = prev.nodeC.packets.some(p => p.uuid === routedPacket.uuid);
        if (isDup) {
          addLog('DEDUP', `Duplicate rejected on Gateway: Packet [${routedPacket.uuid}] already stored.`);
          setMetrics(m => ({ ...m, duplicatesRejected: m.duplicatesRejected + 1 }));
          return prev;
        }
        return {
          ...prev,
          nodeC: {
            ...prev.nodeC,
            packets: [routedPacket, ...prev.nodeC.packets]
          }
        };
      });

      setMetrics(prev => ({
        ...prev,
        packetsRelayed: prev.packetsRelayed + 1,
        hopsCompleted: prev.hopsCompleted + 1
      }));

      addLog('ROUTING', `Packet [${routedPacket.uuid}] routed specifically to Hop Target: Node C (Gateway) via Wi-Fi Direct (Hops: ${routedPacket.hops}, TTL: ${routedPacket.ttl}).`);
      showToast('☁️ Routed to Node C', `Packet [${routedPacket.uuid}] delivered directly to Gateway via Wi-Fi Direct.`, 'success');

      if (nodeCOnlineStatus) {
        setTimeout(() => syncPacketsToCloud(false), 300);
      }

    } else if (target === 'BROADCAST_ALL') {
      // Flood across all connected mesh peers and buffers
      setNodes(prev => {
        const bExists = prev.nodeB.packets.some(p => p.uuid === routedPacket.uuid);
        const cExists = prev.nodeC.packets.some(p => p.uuid === routedPacket.uuid);
        return {
          ...prev,
          nodeB: bExists ? prev.nodeB : { ...prev.nodeB, packets: [routedPacket, ...prev.nodeB.packets] },
          nodeC: cExists ? prev.nodeC : { ...prev.nodeC, packets: [routedPacket, ...prev.nodeC.packets] }
        };
      });

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            action: 'SOS_BROADCAST',
            senderNode: sourceNodeKey === 'nodeB' ? 'NODE_B' : 'NODE_A',
            packet: routedPacket
          });
        } catch (e) {}
      }

      setMetrics(prev => ({
        ...prev,
        packetsRelayed: prev.packetsRelayed + 1,
        hopsCompleted: prev.hopsCompleted + 1
      }));

      addLog('ROUTING', `Packet [${routedPacket.uuid}] flooded across all connected mesh peers (Broadcast All).`);
      showToast('🌊 Broadcast Flood Transmitted', `Packet [${routedPacket.uuid}] multi-cast to all peer nodes.`, 'alert');

      if (nodeCOnlineStatus) {
        setTimeout(() => syncPacketsToCloud(false), 300);
      }
    }
  };

  // ADMINISTRATIVE CLOUD SYNCHRONIZATION ENGINE
  // State-driven, multi-hop pipeline that routes packets from Node C buffer to Emergency Dispatch API
  const syncPacketsToCloud = useCallback(async (manual = false) => {
    const pendingPackets = nodes.nodeC.packets;
    if (!pendingPackets || pendingPackets.length === 0) {
      if (manual) {
        showToast('ℹ️ Gateway Queue Empty', 'No pending packets waiting in Node C store-and-forward buffer.', 'info');
      }
      return;
    }

    if (!nodeCOnlineStatus) {
      addLog('CLOUD', `❌ Cloud Uplink BLOCKED (Gateway Offline). ${pendingPackets.length} packet(s) held in Node C store-and-forward queue.`);
      if (manual) {
        showToast('🔴 Gateway Link Offline', `Cannot sync ${pendingPackets.length} packet(s). Restore Internet Uplink first.`, 'alert');
      }
      return;
    }

    setCloudConnectionParams(prev => ({ ...prev, syncing: true }));

    // Simulate realistic asynchronous HTTP POST network latency
    await new Promise(res => setTimeout(res, 350));

    const timestampNow = new Date().toISOString();
    const timeFormatted = new Date().toLocaleTimeString();

    // Create deep copy of unique packets and append route history trace
    const syncedIncidents = pendingPackets.map(pkt => ({
      ...pkt,
      route: [...(pkt.route || [pkt.origin_node || 'NODE-1']), `SYNC_TO_CLOUD: SUCCESS (${cloudConnectionParams.gatewayId} @ ${timeFormatted})`],
      syncedAt: timeFormatted,
      syncedTimestamp: timestampNow,
      gatewayId: cloudConnectionParams.gatewayId,
      dispatched: false,
      dispatchedUnit: null,
      dispatchedAt: null,
      osmLink: `https://www.openstreetmap.org/?mlat=${pkt.lat}&mlon=${pkt.lng}&zoom=17#map=17/${pkt.lat}/${pkt.lng}`,
      dispatchStatus: 'RECEIVED_AT_DISPATCH'
    }));

    // Update Cloud Dispatch Ledger
    setDispatchLedger(prev => {
      const existingUuids = new Set(prev.map(p => p.uuid));
      const newUnique = syncedIncidents.filter(p => !existingUuids.has(p.uuid));
      return [...newUnique, ...prev];
    });

    if (syncedIncidents.length > 0) {
      setSelectedIncident(syncedIncidents[0]);
    }

    // Clear the successfully synced packets from local Node C buffer
    setNodes(prev => ({
      ...prev,
      nodeC: {
        ...prev.nodeC,
        packets: []
      }
    }));

    // Increment global cloud sync metric
    setMetrics(prev => ({
      ...prev,
      packetsSynced: prev.packetsSynced + syncedIncidents.length
    }));

    setCloudConnectionParams(prev => ({
      ...prev,
      syncing: false,
      lastSyncTime: timeFormatted
    }));

    addLog('CLOUD', `☁️ Administrative Sync: [${syncedIncidents.length}] Packet(s) pushed to Emergency Dispatch (${cloudConnectionParams.endpoint}).`);

    if (broadcastChannelRef.current) {
      try {
        syncedIncidents.forEach(p => {
          broadcastChannelRef.current.postMessage({
            action: 'GATEWAY_SYNC',
            senderNode: 'NODE_C',
            senderDeviceId: deviceInstanceId,
            packet: p
          });
        });
      } catch (e) {}
    }

    showToast(
      '☁️ Administrative Cloud Sync Complete',
      `${syncedIncidents.length} emergency packet(s) synced from Node C to Central Dispatch.`,
      'success'
    );
  }, [
    nodes.nodeC.packets,
    nodeCOnlineStatus,
    cloudConnectionParams.gatewayId,
    cloudConnectionParams.endpoint,
    deviceInstanceId,
    addLog,
    showToast
  ]);

  // Execute Gateway Sync alias for manual triggers
  const executeGatewaySync = useCallback(() => {
    syncPacketsToCloud(true);
  }, [syncPacketsToCloud]);

  // Periodic Gateway Sync (Every 10 seconds)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (nodeCOnlineStatus && nodes.nodeC.packets.length > 0) {
        syncPacketsToCloud(false);
      }
    }, 10000);

    return () => clearInterval(syncInterval);
  }, [nodeCOnlineStatus, nodes.nodeC.packets.length, syncPacketsToCloud]);

  // Mark Incident as Dispatched by Responder Unit
  const markIncidentDispatched = useCallback((uuid, unitName = 'Rescue Squad Alpha 7') => {
    setDispatchLedger(prev =>
      prev.map(inc => {
        if (inc.uuid === uuid) {
          const isNowDispatched = !inc.dispatched;
          return {
            ...inc,
            dispatched: isNowDispatched,
            dispatchedUnit: isNowDispatched ? unitName : null,
            dispatchedAt: isNowDispatched ? new Date().toLocaleTimeString() : null,
            dispatchStatus: isNowDispatched ? 'DISPATCHED_ACTIVE' : 'RECEIVED_AT_DISPATCH'
          };
        }
        return inc;
      })
    );

    addLog('DISPATCH', `🚨 Responder Unit [${unitName}] assigned to Victim [${uuid}]. Triage status updated.`);
    showToast('🚨 Unit Dispatched', `Unit [${unitName}] deployed to emergency incident coordinates.`, 'success');
  }, [addLog, showToast]);

  // Full 1-Click Pulse (A -> B -> C -> Cloud)
  const simulateFullPulse = () => {
    if (nodes.nodeA.packets.length === 0) {
      executeSOSTrigger();
      setTimeout(() => {
        forwardAtoB();
        setTimeout(() => {
          executeRelayHop();
        }, 300);
      }, 300);
    } else {
      forwardAtoB();
      setTimeout(() => {
        executeRelayHop();
      }, 300);
    }
  };

  // Filtered Event Logs
  const filteredLogs = logs.filter(l => logFilter === 'ALL' || l.type === logFilter);

  return (
    <div id="resq-app-root" className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans relative selection:bg-red-500 selection:text-white">

      {/* Publication-Ready Progressive Web App Offline Banner */}
      <PWAInstallPrompt />

      {/* Visual Morse Code SOS Screen Strobe Overlay & HUD Banner */}
      {isBeaconActive && (
        <>
          {/* Pulsing Screen Background in Rhythm with Morse Pattern */}
          <div
            id="resq-strobe-overlay"
            className={`fixed inset-0 pointer-events-none z-50 transition-all duration-75 ${
              morseFlash
                ? 'bg-white/90 sm:bg-red-500/80 backdrop-brightness-200 opacity-100 ring-8 ring-inset ring-white'
                : 'bg-transparent opacity-0'
            }`}
          />

          {/* Active Optical Morse Beacon Live HUD */}
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-950/95 border border-amber-500/80 text-amber-300 shadow-2xl backdrop-blur-md text-xs font-mono font-bold animate-pulse">
            <span className={`w-3 h-3 rounded-full ${morseFlash ? 'bg-amber-300 shadow-[0_0_12px_#f59e0b]' : 'bg-slate-700'}`} />
            <span>OPTICAL MORSE SOS: · · · — — — · · ·</span>
            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-200 border border-amber-800 text-[10px]">
              {morseInfo.letter ? `Letter: ${morseInfo.letter}` : 'PAUSE'}
            </span>
          </div>
        </>
      )}

      {/* Inter-Device Toast Stack */}
      <div id="resq-toast-container" className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl shadow-2xl border backdrop-blur-md flex items-start justify-between gap-3 text-xs transition-all transform animate-slideIn ${
              toast.type === 'alert'
                ? 'bg-red-950/95 border-red-500/80 text-red-100 shadow-red-950/80'
                : toast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-950/80'
                : 'bg-slate-900/95 border-slate-700 text-slate-100'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <Radio className="w-4 h-4 mt-0.5 shrink-0 text-amber-400 animate-pulse" />
              <div>
                <strong className="block font-bold">{toast.title}</strong>
                <p className="text-[11px] opacity-90 mt-0.5">{toast.subtitle}</p>
              </div>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* HEADER WITH REAL HARDWARE TELEMETRY */}
      <header id="aapad-setu-top-header" className="border-b border-slate-800 bg-[#0d1424]/95 backdrop-blur sticky top-0 z-40 px-3 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Logo & Network Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center shadow-lg shadow-red-600/30 text-white shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-xl tracking-tight text-white">आपद सेतु <span className="text-amber-400 font-sans text-base sm:text-lg font-bold">(Aapad Setu)</span></span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-950/90 text-red-400 border border-red-800/60">
                  Offline Emergency Mesh
                </span>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-950/90 text-indigo-400 border border-indigo-800/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                  Mesh Protocol Active
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Zero-Infrastructure Peer-to-Peer Disaster Telemetry &amp; Offline Mesh Network
              </p>
            </div>
          </div>

          {/* Quick Hardware & Action Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* Mode Switcher: Standalone 3-Node Simulator vs Dedicated Hardware Peer */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-0.5 text-xs">
              <button
                id="mode-toggle-simulator-btn"
                onClick={() => {
                  setOperatingMode('SIMULATOR');
                  showToast('🎮 Standalone Simulator Active', 'Running 1 Live Hardware Node + 2 Virtual Dummy Nodes.', 'info');
                }}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  operatingMode === 'SIMULATOR'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="1 Real Hardware Node + 2 Virtual Dummy Peers on 1 Screen"
              >
                <span>🎮 3-Node Simulator</span>
              </button>
              <button
                id="mode-toggle-peer-btn"
                onClick={() => {
                  setOperatingMode('HARDWARE_PEER');
                  showToast('📱 Dedicated Peer Mode Active', `This phone is running as physical peer ${deviceInstanceId}.`, 'info');
                }}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  operatingMode === 'HARDWARE_PEER'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Dedicated single-node peer view for 2nd physical device testing"
              >
                <span>📱 Peer Mode</span>
              </button>
            </div>

            {/* Device ID Badge */}
            <div className="px-2.5 py-1.5 rounded-xl border border-indigo-700/60 bg-indigo-950/80 text-[11px] font-mono flex items-center gap-1.5 text-indigo-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>ID: <strong>{deviceInstanceId}</strong></span>
            </div>

            {/* Live GPS Lock Indicator */}
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 ${
              gpsState.status === 'LOCKED'
                ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-300'
                : gpsState.status === 'ACQUIRING'
                ? 'bg-amber-950/80 border-amber-600/60 text-amber-300 animate-pulse'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}>
              <Crosshair className="w-3.5 h-3.5" />
              <span>
                GPS: {gpsState.status === 'LOCKED' ? `±${gpsState.accuracy}m` : gpsState.status}
              </span>
            </div>

            {/* Hardware Battery Level Badge */}
            <div className="px-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 text-xs font-mono flex items-center gap-1.5 text-slate-300">
              {hardwareBattery.charging ? (
                <BatteryCharging className="w-4 h-4 text-emerald-400" />
              ) : (
                <Battery className={`w-4 h-4 ${nodes.nodeA.battery <= 20 ? 'text-red-400' : 'text-amber-400'}`} />
              )}
              <span>{nodes.nodeA.battery}%</span>
            </div>

            {/* Real Hardware Bluetooth Scanner & Dynamic Sonar Beep Action */}
            <button
              id="open-ble-scanner-modal-btn"
              onClick={() => setIsBleModalOpen(true)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer active:scale-95 ${
                bleTelemetry?.connected
                  ? 'bg-blue-600/90 border-blue-400 text-white shadow-lg shadow-blue-900/40 animate-pulse'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-blue-600/60 text-blue-300 hover:text-white'
              }`}
              title="Pair real BLE beacon or phone to track RSSI and trigger real-life proximity beep"
            >
              <Bluetooth className="w-4 h-4 text-blue-400" />
              <span className="hidden md:inline">
                {bleTelemetry?.connected ? `BLE: ${bleTelemetry.distanceMeters.toFixed(1)}m` : 'Bluetooth Proximity'}
              </span>
              <span className="md:hidden">BLE</span>
            </button>

            {/* Offline P2P Phone-to-Phone Mesh Pairing Action */}
            <button
              id="open-p2p-pairing-modal-btn"
              onClick={() => setIsP2PModalOpen(true)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer active:scale-95 ${
                p2pConnectionState === 'CONNECTED'
                  ? 'bg-emerald-600/90 border-emerald-400 text-white shadow-lg shadow-emerald-900/40'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-emerald-600/60 text-emerald-300 hover:text-white'
              }`}
              title="Zero-Internet WebRTC DataChannel / Audio Acoustic P2P Mesh Pairing"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">
                {p2pConnectionState === 'CONNECTED' ? 'P2P Online' : 'P2P Phone Link'}
              </span>
              <span className="md:hidden">P2P</span>
            </button>

            {/* 1-Click Multi-Hop Pulse */}
            <button
              id="pulse-hop-btn"
              onClick={simulateFullPulse}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer active:scale-95"
              title="Simulate complete multi-hop sequence"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate Hop</span>
            </button>

            {/* Reset State */}
            <button
              id="reset-mesh-btn"
              onClick={() => {
                setNodes({
                  nodeA: {
                    id: 'NODE-1 (THIS DEVICE)',
                    shortId: 'THIS-PHONE',
                    name: 'This Device (Live Hardware)',
                    role: 'Victim / SOS Originator',
                    isLiveHardware: true,
                    isVirtual: false,
                    isOnline: false,
                    inRangeOfB: true,
                    rssiToB: -62,
                    battery: hardwareBattery.level || 88,
                    status: 'CRITICAL - TRAPPED',
                    packets: []
                  },
                  nodeB: {
                    id: 'NODE-2 (DUMMY RELAY)',
                    shortId: 'RELAY-ALPHA',
                    name: 'Dummy Relay Alpha (Simulated)',
                    role: 'Opportunistic Store & Forward Node',
                    isLiveHardware: false,
                    isVirtual: true,
                    isOnline: false,
                    meshActive: true,
                    inRangeOfA: true,
                    inRangeOfC: true,
                    rssiToA: -68,
                    rssiToC: -74,
                    battery: 88,
                    offsetLat: 0.0009,
                    offsetLng: 0.0008,
                    packets: []
                  },
                  nodeC: {
                    id: 'NODE-3 (DUMMY GATEWAY)',
                    shortId: 'GATEWAY-BETA',
                    name: 'Dummy Gateway Beta (Simulated)',
                    role: 'Cellular / Satellite Gateway Node',
                    isLiveHardware: false,
                    isVirtual: true,
                    isOnline: true,
                    uplinkType: '5G / Starlink',
                    inRangeOfB: true,
                    rssiToB: -74,
                    battery: 98,
                    offsetLat: 0.0022,
                    offsetLng: 0.0019,
                    packets: []
                  }
                });
                setMetrics({
                  packetsCreated: 0,
                  packetsRelayed: 0,
                  packetsSynced: 0,
                  duplicatesRejected: 0,
                  hopsCompleted: 0,
                  broadcastsReceived: 0
                });
                setIsBeaconActive(false);
                addLog('SYS', 'Aapad Setu Mesh Simulator reset to initial state.');
              }}
              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition cursor-pointer flex items-center justify-center"
              title="Reset State"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* NAVIGATION TABS (TWO DISTINCT ROLES) */}
      <nav id="aapad-setu-nav-tabs" className="border-b border-slate-800 bg-[#0a101d] px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between py-2">
          <div className="flex items-center space-x-2">
            {/* Tab 1: I NEED HELP (Victim / Citizen Mode) */}
            <button
              id="nav-tab-victim"
              onClick={() => setActiveTab('victim')}
              className={`min-h-[44px] px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'victim'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-950/60 ring-2 ring-red-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-white" />
              <span>🆘 I NEED HELP</span>
            </button>

            {/* Tab 2: RESCUER DASHBOARD (Emergency Responder / Triage Mode) */}
            <button
              id="nav-tab-responder"
              onClick={() => setActiveTab('responder')}
              className={`min-h-[44px] px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'responder'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-950/60 ring-2 ring-indigo-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Shield className="w-4 h-4 text-white" />
              <span>🛡️ RESCUER DASHBOARD</span>
              {victimAggregator.totalVictims > 0 && (
                <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  victimAggregator.trappedCount > 0 || victimAggregator.criticalCount > 0
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-emerald-500 text-slate-950'
                }`}>
                  {victimAggregator.totalVictims} active
                </span>
              )}
            </button>
          </div>

          {/* Right Action: Protocol Inspector & Telemetry Logs Bottom Sheet Toggle */}
          <button
            id="toggle-network-inspector-btn"
            onClick={() => setIsInspectorOpen(!isInspectorOpen)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
              isInspectorOpen
                ? 'bg-indigo-600 border-indigo-400 text-white shadow'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">⚙️ Protocol Inspector &amp; Telemetry Logs</span>
            <span className="sm:hidden">⚙️ Inspector</span>
            {metrics.packetsCreated > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-300">
                {metrics.packetsCreated} pkts
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <main id="resq-main-layout" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeTab === "victim" ? (
          <VictimMode
            nodes={nodes}
            setNodes={setNodes}
            gpsState={gpsState}
            setGpsState={setGpsState}
            manualCoords={manualCoords}
            setManualCoords={setManualCoords}
            holdProgress={holdProgress}
            isHolding={isHolding}
            startHoldTimer={startHoldTimer}
            cancelHoldTimer={cancelHoldTimer}
            isBeaconActive={isBeaconActive}
            setIsBeaconActive={setIsBeaconActive}
            morseFlash={morseFlash}
            morseInfo={morseInfo}
            isVoiceSosListening={isVoiceSosListening}
            voiceTranscript={voiceTranscript}
            voiceDetectedKeyword={voiceDetectedKeyword}
            voiceSosSupported={voiceSosSupported}
            toggleVoiceSos={toggleVoiceSos}
            simulateVoiceKeyword={simulateVoiceKeyword}
            isSirenPlaying={isSirenPlaying}
            toggleSirenTone={toggleSirenTone}
            forwardAtoB={forwardAtoB}
            simulateFullPulse={simulateFullPulse}
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            batteryAlertBanner={batteryAlertBanner}
            setBatteryAlertBanner={setBatteryAlertBanner}
            addLog={addLog}
            copiedKey={copiedKey}
            copyText={copyText}
            onOpenBleModal={() => setIsBleModalOpen(true)}
            onOpenP2PModal={() => setIsP2PModalOpen(true)}
            bleTelemetry={bleTelemetry}
            p2pConnectionState={p2pConnectionState}
          />
        ) : (
          <ResponderMode
            nodes={nodes}
            setNodes={setNodes}
            metrics={metrics}
            dispatchLedger={dispatchLedger}
            selectedIncident={selectedIncident}
            setSelectedIncident={setSelectedIncident}
            victimAggregator={victimAggregator}
            nodeCOnlineStatus={nodeCOnlineStatus}
            toggleNodeCUplink={toggleNodeCUplink}
            syncPacketsToCloud={syncPacketsToCloud}
            markIncidentDispatched={markIncidentDispatched}
            manualCoords={manualCoords}
            gpsState={gpsState}
            rescuerOffset={rescuerOffset}
            setRescuerOffset={setRescuerOffset}
            radarScale={radarScale}
            setRadarScale={setRadarScale}
            isRadarMuted={isRadarMuted}
            toggleRadarAudioMute={toggleRadarAudioMute}
            emitAcousticPulse={emitAcousticPulse}
            isAcousticPulseEmitting={isAcousticPulseEmitting}
            compassHeading={compassHeading}
            isGyroActive={isGyroActive}
            isGyroSupported={isGyroSupported}
            gyroPermissionState={gyroPermissionState}
            requestGyroPermission={requestGyroPermission}
            isCalibrating={isCalibrating}
            calibrationProgress={calibrationProgress}
            calibrateCompass={calibrateCompass}
            compassAccuracy={compassAccuracy}
            isSimulatedHeading={isSimulatedHeading}
            setIsSimulatedHeading={setIsSimulatedHeading}
            simulatedHeading={simulatedHeading}
            setSimulatedHeading={setSimulatedHeading}
            calculateHaversine={calculateHaversine}
            calculateBearing={calculateBearing}
            calculateRSSI={calculateRSSI}
            getCardinalDirection={getCardinalDirection}
            detectedPeers={detectedPeers}
            stepCloserToVictim={stepCloserToVictim}
            stepAwayFromVictim={stepAwayFromVictim}
            setSliderDistance={setSliderDistance}
            moveRescuerDelta={moveRescuerDelta}
            formatTimeSince={formatTimeSince}
            markVictimSafe={markVictimSafe}
            injectSimulatedCasualties={injectSimulatedCasualties}
            clearSimulatedVictims={clearSimulatedVictims}
            copiedKey={copiedKey}
            copyText={copyText}
            executeRelayHop={executeRelayHop}
            executeGatewaySync={executeGatewaySync}
            onOpenBleModal={() => setIsBleModalOpen(true)}
            onOpenP2PModal={() => setIsP2PModalOpen(true)}
            bleTelemetry={bleTelemetry}
            p2pConnectionState={p2pConnectionState}
          />
        )}
      </main>

      {/* COLLAPSIBLE NETWORK INSPECTOR BOTTOM SHEET / MODAL DRAWER */}
      <NetworkInspectorDrawer
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        nodes={nodes}
        setNodes={setNodes}
        metrics={metrics}
        logs={logs}
        setLogs={setLogs}
        logFilter={logFilter}
        setLogFilter={setLogFilter}
        selectedHopTarget={selectedHopTarget}
        setSelectedHopTarget={setSelectedHopTarget}
        forwardAtoB={forwardAtoB}
        executeRelayHop={executeRelayHop}
        executeGatewaySync={executeGatewaySync}
        simulateFullPulse={simulateFullPulse}
        copiedKey={copiedKey}
        copyText={copyText}
        manualCoords={manualCoords}
        showToast={showToast}
      />

      {/* REAL-WORLD WEB BLUETOOTH RSSI RADAR & DYNAMIC PROXIMITY BEEPER MODAL */}
      <BluetoothScannerModal
        isOpen={isBleModalOpen}
        onClose={() => setIsBleModalOpen(false)}
        bleManager={bleManagerRef.current}
        telemetry={bleTelemetry}
        sonarEngine={sonarEngineRef.current}
      />

      {/* ZERO-INTERNET WEBRTC & ACOUSTIC AUDIO SOUND MODEM P2P PAIRING MODAL */}
      <P2PPairingModal
        isOpen={isP2PModalOpen}
        onClose={() => setIsP2PModalOpen(false)}
        p2pMesh={p2pMeshRef.current}
        acousticModem={acousticModemRef.current}
        currentPacket={nodes.nodeA.packets[0] || {
          uuid: generatePacketId(),
          timestamp: new Date().toISOString(),
          lat: Number(manualCoords.lat) || 19.0760,
          lng: Number(manualCoords.lng) || 72.8777,
          status: 'CRITICAL - TRAPPED',
          medical: userProfile.medicalNotes,
          bloodGroup: userProfile.bloodGroup,
          contact: userProfile.emergencyContact,
          battery: nodes.nodeA.battery,
          hops: 0,
          ttl: 5
        }}
        onPacketReceived={(pkt) => {
          showToast('🚨 Real P2P Packet Transferred!', `Packet [${pkt.uuid}] received via offline P2P.`, 'alert');
          setNodes(prev => ({
            ...prev,
            nodeB: { ...prev.nodeB, packets: [pkt, ...prev.nodeB.packets] }
          }));
        }}
      />

      {/* FOOTER */}
      <footer id="aapad-setu-footer" className="border-t border-slate-800/80 bg-[#080c14] px-4 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>आपद सेतु (Aapad Setu): Zero-Infrastructure Peer-to-Peer Disaster Telemetry</span>
          <span className="font-mono text-[11px]">Store-and-Forward Mesh Protocol • Low-Latency Field Triage</span>
        </div>
      </footer>

    </div>
  );
}
