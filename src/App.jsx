import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Peer from 'peerjs';
import L from 'leaflet';
import EmergencyProfileModal from './components/EmergencyProfileModal';
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
  Heart,
  Edit3,
  Sliders,
  Flashlight,
  BatteryWarning,
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
    victimProfile: {
      name: 'Rahul Sharma',
      bloodGroup: 'O+',
      healthIssues: 'Asthma (Carries Inhaler), Dust Allergy',
      emergencyContact: '+91 98201 45678 (Father)'
    },
    callsign: 'Rahul Sharma [ALPHA-104]',
    lat: DEFAULT_COORDS.lat + 0.00018,
    lng: DEFAULT_COORDS.lng + 0.00014,
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
    victimProfile: {
      name: 'Ananya Verma',
      bloodGroup: 'B+',
      healthIssues: 'Type 1 Diabetic (Insulin Dependent)',
      emergencyContact: '+91 98192 34567 (Spouse)'
    },
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

  // Prior Civilian Emergency & Medical Profile (Persisted in localStorage)
  const [victimProfile, setVictimProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('aapad_civilian_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const legacyName = localStorage.getItem('aapad_victim_name') || '';
    return {
      name: legacyName,
      bloodGroup: 'O+',
      healthIssues: '',
      emergencyContact: '',
      notes: ''
    };
  });

  // Automatically prompt new users on first launch to setup their emergency medical profile
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(() => {
    const saved = localStorage.getItem('aapad_civilian_profile');
    const legacyName = localStorage.getItem('aapad_victim_name');
    return !saved && !legacyName;
  });

  const [victimName, setVictimName] = useState(() => {
    return victimProfile.name || localStorage.getItem('aapad_victim_name') || '';
  });

  const handleSaveVictimProfile = useCallback((newProfile) => {
    setVictimProfile(newProfile);
    setVictimName(newProfile.name || '');
    localStorage.setItem('aapad_civilian_profile', JSON.stringify(newProfile));
    localStorage.setItem('aapad_victim_name', newProfile.name || '');
    setNotificationMsg('✅ Emergency Medical Profile saved securely on device!');
    setTimeout(() => setNotificationMsg(null), 3500);
  }, []);

  const handleUpdateVictimName = useCallback((name) => {
    setVictimName(name);
    setVictimProfile(prev => {
      const updated = { ...prev, name };
      localStorage.setItem('aapad_civilian_profile', JSON.stringify(updated));
      return updated;
    });
    localStorage.setItem('aapad_victim_name', name);
  }, []);

  // Compute clean display identity combining human name and callsign
  const effectiveCallsign = useMemo(() => {
    const trimmed = (victimProfile.name || victimName).trim();
    return trimmed ? `${trimmed} [${myCallsign}]` : myCallsign;
  }, [victimProfile.name, victimName, myCallsign]);

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
  const [meshPeersMap, setMeshPeersMap] = useState({}); // deviceId -> MeshPeer
  const [radiusFilterMeters, setRadiusFilterMeters] = useState(1000); // 500m, 1km, 2km, 5km, 0 = all
  const activeConnectionsRef = useRef(new Map());
  const broadcastChannelRef = useRef(null);

  // Dynamic Telemetry Refs to prevent unnecessary effect teardowns
  const latestGpsRef = useRef(DEFAULT_COORDS);
  const latestBatteryRef = useRef(88);
  const latestDistressRef = useRef({ isDistressActive: false, distressStatus: 'TRAPPED' });
  const latestProfileRef = useRef(victimProfile);
  const latestRoleRef = useRef(activeRole);
  const latestCallsignRef = useRef(effectiveCallsign);

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
  const [sonarProximityTarget, setSonarProximityTarget] = useState(null); // { victim, distance } | null

  // Emergency Flashlight Strobe & Piercing Acoustic Distress Beacon State
  const [isStrobeActive, setIsStrobeActive] = useState(true);
  const [isVictimAudioMuted, setIsVictimAudioMuted] = useState(false);
  const [hasHardwareTorch, setHasHardwareTorch] = useState(false);
  const [strobeFlashState, setStrobeFlashState] = useState(false);
  const hasSent5PctPacketRef = useRef(false);
  const [lastGaspPacketSent, setLastGaspPacketSent] = useState(false);

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
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
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
        // Play brief 0.15s confirmation chirp (880Hz)
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      }
      setAudioUnlocked(true);
      addLog('AUDIO', '🔊 Web Audio Context activated and unblocked for Sonar/Radar alerts.');
    } catch (e) {
      console.warn('Audio unlock warning:', e);
      setAudioUnlocked(true);
    }
  }, [getAudioContext, addLog]);

  // Global user interaction listener to auto-unlock audio on the first tap/click/keypress anywhere
  useEffect(() => {
    const handleFirstGesture = () => {
      unlockAudio();
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [unlockAudio]);

  // Standalone Sonar Ping Audio Tester
  const testAudioPing = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1150, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        setAudioUnlocked(true);
        addLog('AUDIO', '🔔 Test acoustic sonar ping (1150Hz) synthesized.');
      }
    } catch (e) {
      console.warn('Test audio ping note:', e);
    }
  }, [getAudioContext, addLog]);

  // Sonar Ping Generator for Closest Endangered Victim (Rescuer Mode)
  // FIX: ONLY pings when an endangered casualty is strictly within close proximity (<= 50 meters).
  // If no casualty is within 50m, the dashboard remains completely quiet and silent!
  useEffect(() => {
    if (!audioUnlocked || activeRole !== 'ROLE_RESPONDER' || isSonarMuted) {
      setSonarProximityTarget(null);
      return;
    }

    const SONAR_MAX_PROXIMITY_METERS = 50;
    let closestVictim = null;
    let minDistance = Infinity;

    if (selectedVictim && selectedVictim.status !== 'SAFE') {
      const d = calculateHaversine(
        gpsLocation.lat,
        gpsLocation.lng,
        selectedVictim.lat,
        selectedVictim.lng
      );
      if (d <= SONAR_MAX_PROXIMITY_METERS) {
        closestVictim = selectedVictim;
        minDistance = d;
      }
    } else {
      // Find the casualty that is actually closest to the rescuer
      for (const v of triageRoster) {
        if (v.status !== 'SAFE' && (v.status === 'TRAPPED' || v.status === 'CRITICAL' || v.status === 'INJURED')) {
          const d = calculateHaversine(gpsLocation.lat, gpsLocation.lng, v.lat, v.lng);
          if (d < minDistance && d <= SONAR_MAX_PROXIMITY_METERS) {
            minDistance = d;
            closestVictim = v;
          }
        }
      }
    }

    // STRICT PROXIMITY CHECK: If no victim is nearby (<= 50m), REMAIN COMPLETELY SILENT!
    if (!closestVictim || !isFinite(minDistance) || minDistance > SONAR_MAX_PROXIMITY_METERS) {
      setSonarProximityTarget(null);
      return;
    }

    setSonarProximityTarget({ victim: closestVictim, distance: minDistance });

    // Pulse interval: closer = faster pings (e.g. 250ms at 1m to 1100ms at 50m)
    const intervalMs = Math.round(250 + (minDistance / SONAR_MAX_PROXIMITY_METERS) * 850);
    // Pitch rises as distance closes (750Hz at 50m -> 1600Hz at 1m)
    const frequency = Math.round(1600 - (minDistance / SONAR_MAX_PROXIMITY_METERS) * 850);

    const timer = setInterval(() => {
      try {
        const ctx = getAudioContext();
        if (ctx) {
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          if (ctx.state === 'running') {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(frequency, now);
            gain.gain.setValueAtTime(0.28, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.12);
          }
        }
      } catch (e) {}
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [audioUnlocked, activeRole, isSonarMuted, selectedVictim, triageRoster, gpsLocation, getAudioContext]);

  // ==========================================
  // HARDWARE FLASHLIGHT (TORCH) STROBE CONTROLLER
  // ==========================================
  useEffect(() => {
    if (!isDistressActive || activeRole !== 'ROLE_VICTIM' || !isStrobeActive) {
      setStrobeFlashState(false);
      return;
    }

    let mediaStream = null;
    let videoTrack = null;
    let strobeTimer = null;
    let torchState = false;

    async function engageFlashlightStrobe() {
      try {
        // Safe constraint query: verify browser explicitly supports torch before touching camera
        const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
        if (supported.torch && navigator.mediaDevices?.getUserMedia) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
          }).catch(() => null);

          if (mediaStream) {
            const track = mediaStream.getVideoTracks()[0];
            const capabilities = track?.getCapabilities?.() || {};

            if (capabilities.torch) {
              videoTrack = track;
              setHasHardwareTorch(true);
              addLog('TORCH', '🔦 Hardware camera flashlight acquired. Emergency optical strobe engaged.');

              strobeTimer = setInterval(async () => {
                try {
                  if (videoTrack && videoTrack.readyState === 'live') {
                    torchState = !torchState;
                    await videoTrack.applyConstraints({
                      advanced: [{ torch: torchState }]
                    }).catch(() => {});
                    setStrobeFlashState(torchState);
                  }
                } catch (err) {}
              }, 260);
              return;
            } else {
              // Device has camera but no hardware torch support on this track
              try {
                track?.stop();
                mediaStream?.getTracks().forEach(t => t.stop());
              } catch (e) {}
              videoTrack = null;
              mediaStream = null;
            }
          }
        }
      } catch (err) {
        console.warn('Hardware flashlight access note:', err);
      }

      // Optical display strobe fallback if no rear torch LED
      setHasHardwareTorch(false);
      strobeTimer = setInterval(() => {
        setStrobeFlashState(prev => !prev);
      }, 280);
    }

    engageFlashlightStrobe();

    return () => {
      if (strobeTimer) clearInterval(strobeTimer);
      if (videoTrack) {
        try {
          videoTrack.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
        } catch (e) {}
        try {
          videoTrack.stop();
        } catch (e) {}
        videoTrack = null;
      }
      if (mediaStream) {
        try {
          mediaStream.getTracks().forEach(t => t.stop());
        } catch (e) {}
        mediaStream = null;
      }
      setStrobeFlashState(false);
    };
  }, [isDistressActive, activeRole, isStrobeActive, addLog]);

  // ==========================================
  // SHARP PIERCING ACOUSTIC LOCATOR BEACON
  // ==========================================
  useEffect(() => {
    if (!isDistressActive || activeRole !== 'ROLE_VICTIM' || isVictimAudioMuted) {
      return;
    }

    const triggerSharpPiercingPulse = () => {
      try {
        const ctx = getAudioContext();
        if (ctx) {
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          if (ctx.state === 'running') {
            const now = ctx.currentTime;

            // Piercing Spike 1: 2900 Hz -> 3300 Hz sawtooth bite
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(2900, now);
            osc1.frequency.linearRampToValueAtTime(3300, now + 0.08);
            gain1.gain.setValueAtTime(0.35, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.09);

            // Piercing Spike 2: 3500 Hz -> 3900 Hz high-frequency sweep
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(3500, now + 0.11);
            osc2.frequency.linearRampToValueAtTime(3950, now + 0.22);
            gain2.gain.setValueAtTime(0.4, now + 0.11);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.11);
            osc2.stop(now + 0.23);
          }
        }
      } catch (e) {}
    };

    triggerSharpPiercingPulse();
    const sharpInterval = setInterval(triggerSharpPiercingPulse, 720);

    return () => clearInterval(sharpInterval);
  }, [isDistressActive, activeRole, isVictimAudioMuted, getAudioContext]);

  // Emergency Siren Tone Trigger for High-Priority Rescuer Alert
  const playEmergencySiren = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        if (ctx.state === 'running') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          const now = ctx.currentTime;
          osc.frequency.setValueAtTime(650, now);
          osc.frequency.linearRampToValueAtTime(1100, now + 0.3);
          osc.frequency.linearRampToValueAtTime(650, now + 0.6);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.65);
        }
      }
    } catch (e) {}
  }, [getAudioContext]);

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

  // ==========================================
  // 5% CRITICAL BATTERY TELEMETRY & OFFLINE DTN PACKET
  // ==========================================
  const transmitCritical5PctBatteryPacket = useCallback((overrideBattery = 5) => {
    const coords = sanitizeCoords(gpsLocation.lat, gpsLocation.lng);
    const lockedAcc = typeof gpsLocation.accuracy === 'number' && isFinite(gpsLocation.accuracy) ? gpsLocation.accuracy : 4.5;
    const vName = (victimProfile?.name && victimProfile.name.trim()) || victimName.trim() || 'Civilian Casualty';

    const lastGaspPacket = {
      uuid: `BLACKBOX_5PCT_${myNodeId}_${Date.now()}`,
      id: myNodeId,
      type: 'CRITICAL_LAST_GASP_5PCT',
      isLastGaspPacket: true,
      callsign: effectiveCallsign,
      victimName: vName,
      victimProfile: victimProfile,
      battery: overrideBattery,
      status: 'CRITICAL - BATTERY 5%',
      distressMessage: 'FINAL EMERGENCY TRANSMISSION: Battery dropped to 5%. Last known location locked before power loss.',
      lat: coords.lat,
      lng: coords.lng,
      lon: coords.lng,
      accuracy: lockedAcc,
      altitude: gpsLocation.altitude || 215,
      lastKnownLocation: {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: lockedAcc,
        altitude: gpsLocation.altitude || 215,
        lockedAt: Date.now()
      },
      medical: victimProfile?.healthIssues ? `Blood: ${victimProfile?.bloodGroup || 'N/A'}, Medical: ${victimProfile?.healthIssues}` : '',
      emergencyContact: victimProfile?.emergencyContact || '',
      bloodGroup: victimProfile?.bloodGroup || '',
      targetRole: 'RESPONDER_ONLY',
      timestamp: Date.now(),
      originNode: myNodeId,
      hopCount: 0
    };

    // 1. Persist in Offline DTN LocalStorage Queue (Works 100% Offline without Network)
    try {
      localStorage.setItem('aapad_last_gasp_packet', JSON.stringify(lastGaspPacket));
      const rawQueue = localStorage.getItem('aapad_dtn_offline_queue') || '[]';
      const queue = JSON.parse(rawQueue);
      if (!queue.some(p => p.uuid === lastGaspPacket.uuid)) {
        queue.push(lastGaspPacket);
        localStorage.setItem('aapad_dtn_offline_queue', JSON.stringify(queue.slice(-25)));
      }
    } catch (e) {
      console.warn('DTN offline storage notice:', e);
    }

    // 2. Broadcast immediately across all Mesh channels (BroadcastChannel, WebRTC DataChannels, local bridge)
    broadcastMeshPacket(lastGaspPacket);
    setLastGaspPacketSent(true);
    hasSent5PctPacketRef.current = true;

    addLog('BATTERY', `🪫 CRITICAL 5% BATTERY PROTOCOL: Last known location [${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}] locked and broadcast over mesh (Saved Offline).`);
    setNotificationMsg(`🪫 Critical 5% Battery Packet Created & Dispatched via Mesh (Saved Offline)!`);
    setTimeout(() => setNotificationMsg(null), 5000);
  }, [gpsLocation, victimProfile, victimName, myNodeId, effectiveCallsign, broadcastMeshPacket, addLog]);

  // Battery Status API with 5% Critical Battery Automatic Protocol
  useEffect(() => {
    let batteryObj = null;
    const updateBattery = () => {
      if (batteryObj) {
        const levelPct = Math.round(batteryObj.level * 100);
        setBatteryLevel(levelPct);
        setIsCharging(batteryObj.charging);

        // Auto-trigger critical 5% black-box packet when battery drops to <= 5%
        if (levelPct <= 5 && !hasSent5PctPacketRef.current && activeRole === 'ROLE_VICTIM') {
          transmitCritical5PctBatteryPacket(levelPct);
        }
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
  }, [activeRole, transmitCritical5PctBatteryPacket]);

  // Inbound Packet Processing with Strict Role-Based Rules
  const handleIncomingPacket = useCallback((pkt) => {
    if (!pkt || (!pkt.uuid && !pkt.id)) return;
    const packetUuid = pkt.uuid || pkt.id || ('PKT_' + Math.random().toString(36).substring(2, 9));

    // Deduplication check for this individual packet transmission
    const isNewPacket = !seenPacketsSetRef.current.has(packetUuid);
    seenPacketsSetRef.current.add(packetUuid);

    // ==========================================
    // ROLE-BASED ROUTING LOGIC
    // ==========================================
    if (activeRole === 'ROLE_VICTIM') {
      // VICTIM MODE: Store and forward quietly. NO ALARMS, NO POPUPS.
      if (isNewPacket && pkt.hopCount < 10) {
        // Re-broadcast to adjacent nodes (DTN Store-and-Forward)
        broadcastMeshPacket(pkt);
        addLog('MESH', `📦 Relayed packet ${packetUuid.substring(0, 8)} for casualty ${pkt.victimName || pkt.callsign || pkt.id}`);
      }
      return;
    }

    // RESPONDER MODE: Full tactical triage processing
    if (pkt.targetRole === 'RESPONDER_ONLY' || pkt.targetRole === 'ALL' || !pkt.targetRole) {
      const coords = sanitizeCoords(pkt.lat, pkt.lng ?? pkt.lon);
      const victimId = pkt.id || pkt.deviceId || pkt.originNode || pkt.senderNode || packetUuid;
      const vName = pkt.victimName || pkt.victimProfile?.name || (pkt.callsign && pkt.callsign.includes('(') ? pkt.callsign.split('(')[0].trim() : null);

      let isBrandNewCasualty = false;

      setTriageRoster(prev => {
        // Thorough deduplication: check ID, UUID, origin node, deviceId, or identical human victim name
        const existingIdx = prev.findIndex(v => {
          if (v.id && (v.id === victimId || v.id === pkt.id || v.id === pkt.uuid)) return true;
          if (v.uuid && (v.uuid === packetUuid || v.uuid === pkt.uuid || v.uuid === pkt.id)) return true;
          if (v.originNode && pkt.originNode && v.originNode === pkt.originNode) return true;
          if (v.originNode && pkt.deviceId && v.originNode === pkt.deviceId) return true;
          if (v.deviceId && pkt.deviceId && v.deviceId === pkt.deviceId) return true;
          if (vName && (v.victimName === vName || (v.victimProfile?.name && v.victimProfile.name === vName))) return true;
          if (v.callsign && pkt.callsign && v.callsign === pkt.callsign) return true;
          return false;
        });

        isBrandNewCasualty = existingIdx < 0;

        const isCriticalBattery = Boolean(
          pkt.isLastGaspPacket ||
          pkt.type === 'CRITICAL_LAST_GASP_5PCT' ||
          (typeof pkt.battery === 'number' && pkt.battery <= 5)
        );

        const updatedVictim = {
          id: existingIdx >= 0 ? prev[existingIdx].id : victimId,
          uuid: existingIdx >= 0 ? prev[existingIdx].uuid : packetUuid,
          victimName: vName || (existingIdx >= 0 ? prev[existingIdx].victimName : null),
          victimProfile: pkt.victimProfile || (existingIdx >= 0 ? prev[existingIdx].victimProfile : null),
          callsign: pkt.callsign || (existingIdx >= 0 ? prev[existingIdx].callsign : 'VICTIM-UNKNOWN'),
          lat: coords.lat,
          lng: coords.lng,
          accuracy: typeof pkt.accuracy === 'number' && isFinite(pkt.accuracy) ? pkt.accuracy : 5,
          battery: typeof pkt.battery === 'number' && isFinite(pkt.battery) ? pkt.battery : 85,
          status: pkt.status || (existingIdx >= 0 ? prev[existingIdx].status : 'TRAPPED'),
          voiceNote: pkt.voiceNote || (existingIdx >= 0 ? prev[existingIdx].voiceNote : null),
          distressMessage: pkt.distressMessage || (existingIdx >= 0 ? prev[existingIdx].distressMessage : 'Critical Distress Signal Broadcast'),
          lastSeenMs: Date.now(),
          hopCount: pkt.hopCount || 1,
          originNode: pkt.originNode || pkt.senderNode || (existingIdx >= 0 ? prev[existingIdx].originNode : 'UNKNOWN'),
          isLastGaspPacket: isCriticalBattery,
          lastKnownLocation: pkt.lastKnownLocation || (isCriticalBattery ? {
            lat: coords.lat,
            lng: coords.lng,
            accuracy: typeof pkt.accuracy === 'number' && isFinite(pkt.accuracy) ? pkt.accuracy : 5,
            altitude: pkt.altitude || 215,
            lockedAt: Date.now()
          } : (existingIdx >= 0 ? prev[existingIdx].lastKnownLocation : null))
        };

        if (existingIdx >= 0) {
          const clone = [...prev];
          clone[existingIdx] = updatedVictim;
          return clone;
        } else {
          return [updatedVictim, ...prev];
        }
      });

      // Show high priority alert overlay & sound siren for new critical casualty OR 5% battery emergency packet
      const isCriticalBatteryPacket = Boolean(pkt.isLastGaspPacket || pkt.type === 'CRITICAL_LAST_GASP_5PCT' || (typeof pkt.battery === 'number' && pkt.battery <= 5));
      if ((isBrandNewCasualty || isCriticalBatteryPacket) && isNewPacket && (pkt.status === 'TRAPPED' || pkt.status === 'CRITICAL' || isCriticalBatteryPacket)) {
        setActiveAlertPopup({
          ...pkt,
          victimName: vName,
          lat: coords.lat,
          lng: coords.lng,
          isLastGaspPacket: isCriticalBatteryPacket,
          receivedAt: Date.now()
        });
        playEmergencySiren();
        if (isCriticalBatteryPacket) {
          addLog('ALERT', `🪫 CRITICAL 5% BATTERY TELEMETRY: ${vName || pkt.callsign || pkt.id} at [${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}]. Last known location locked!`);
        } else {
          addLog('ALERT', `🚨 NEW CRITICAL CASUALTY: ${vName || pkt.callsign || pkt.id} at [${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}]`);
        }
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

      // Offline DTN Packet Flush: Store-and-Forward across offline peer mesh
      try {
        const rawQueue = localStorage.getItem('aapad_dtn_offline_queue');
        if (rawQueue) {
          const queue = JSON.parse(rawQueue);
          if (Array.isArray(queue) && queue.length > 0) {
            queue.forEach(p => {
              try {
                conn.send(p);
              } catch (err) {}
            });
            addLog('DTN', `📦 Relayed ${queue.length} offline emergency packets to peer [${conn.peer.substring(0, 8)}]`);
          }
        }
      } catch (e) {}
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
          if (data.peers && Array.isArray(data.peers)) {
            const map = {};
            data.peers.forEach(p => {
              if (p && p.id && p.id !== myNodeId) {
                map[p.id] = p;
              }
            });
            setMeshPeersMap(map);
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
          if (Array.isArray(peers)) {
            const map = {};
            peers.forEach(p => {
              if (p && p.id && p.id !== myNodeId) {
                map[p.id] = p;
              }
            });
            setMeshPeersMap(map);
            connectToDiscoveredPeers(peers);
          }
        } catch (err) {}
      });

      eventSource.addEventListener('PEER_HEARTBEAT', (e) => {
        try {
          const p = JSON.parse(e.data);
          if (p && p.id && p.id !== myNodeId) {
            setMeshPeersMap(prev => ({ ...prev, [p.id]: p }));
            if (!activeConnectionsRef.current.has(p.id) && peerInstanceRef.current) {
              const conn = peerInstanceRef.current.connect(p.id, { reliable: true });
              registerConnection(conn);
            }
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

    // Periodic Heartbeat using dynamic refs
    const sendHeartbeat = () => {
      try {
        const curGps = latestGpsRef.current || DEFAULT_COORDS;
        const curProfile = latestProfileRef.current;
        const curDistress = latestDistressRef.current;
        const curRole = latestRoleRef.current;
        const curCallsign = latestCallsignRef.current;

        fetch('/api/mesh/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: myNodeId,
            shortId: myNodeId.substring(0, 8),
            name: (curProfile?.name && curProfile.name.trim()) || curCallsign,
            victimProfile: curProfile,
            role: curRole === 'ROLE_VICTIM' ? 'VICTIM' : 'RESPONDER',
            lat: curGps.lat,
            lng: curGps.lng,
            accuracy: curGps.accuracy,
            battery: latestBatteryRef.current,
            status: curDistress.isDistressActive ? curDistress.distressStatus : 'SAFE',
            isSosActive: curDistress.isDistressActive
          })
        })
          .then(res => res.json())
          .catch(() => {});
      } catch (err) {}
    };

    sendHeartbeat();
    const heartbeatTimer = setInterval(sendHeartbeat, 4000);

    // Prune stale peers disconnected more than 45 seconds ago
    const stalePruneTimer = setInterval(() => {
      const cutoff = Date.now() - 45000;
      setMeshPeersMap(prev => {
        let changed = false;
        const next = {};
        for (const [id, p] of Object.entries(prev)) {
          if (p.lastSeen && p.lastSeen > cutoff) {
            next[id] = p;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 10000);

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(stalePruneTimer);
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
    registerConnection,
    handleIncomingPacket,
    addLog
  ]);

  // Telemetry ref synchronization
  useEffect(() => {
    latestGpsRef.current = gpsLocation;
  }, [gpsLocation]);

  useEffect(() => {
    latestBatteryRef.current = batteryLevel;
  }, [batteryLevel]);

  useEffect(() => {
    latestDistressRef.current = { isDistressActive, distressStatus };
  }, [isDistressActive, distressStatus]);

  useEffect(() => {
    latestProfileRef.current = victimProfile;
  }, [victimProfile]);

  useEffect(() => {
    latestRoleRef.current = activeRole;
  }, [activeRole]);

  useEffect(() => {
    latestCallsignRef.current = effectiveCallsign;
  }, [effectiveCallsign]);

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
        victimName: (victimProfile?.name && victimProfile.name.trim()) || victimName.trim() || undefined,
        victimProfile: victimProfile,
        lat: gpsLocation.lat,
        lng: gpsLocation.lng,
        lon: gpsLocation.lng,
        accuracy: gpsLocation.accuracy,
        battery: batteryLevel,
        isCharging,
        status: distressStatus,
        distressMessage,
        medical: victimProfile?.healthIssues ? `Blood: ${victimProfile?.bloodGroup || 'N/A'}, Medical: ${victimProfile?.healthIssues}` : '',
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
    victimProfile,
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
    setIsStrobeActive(true);
    setIsVictimAudioMuted(false);
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
    setIsStrobeActive(false);
    setStrobeFlashState(false);
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

    // 1. Rescuer Location Marker (National Amber)
    try {
      const rescuerHtml = `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <span class="absolute w-7 h-7 rounded-full bg-[#D97706]/30 animate-ping"></span>
          <span class="relative w-4 h-4 rounded-full bg-[#D97706] border-2 border-white shadow-md"></span>
          <span class="absolute top-5 bg-[#1A222D] text-[#D97706] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-[#2D3848] whitespace-nowrap">YOU (Rescuer)</span>
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

        const colorClass = isSafe ? 'bg-[#16A34A]' : isInjured ? 'bg-[#D97706]' : 'bg-[#DC2626]';
        const badgeClass = isSafe
          ? 'bg-[#1A222D] text-[#16A34A] border-[#16A34A]'
          : isInjured
          ? 'bg-[#1A222D] text-[#D97706] border-[#D97706]'
          : 'bg-[#1A222D] text-[#DC2626] border-[#DC2626]';

        const dist = calculateHaversine(rescuerPos.lat, rescuerPos.lng, vCoords.lat, vCoords.lng);
        const displayName = v.victimName || (v.callsign && v.callsign.includes('(') ? v.callsign.split('(')[0].trim() : v.callsign) || 'CASUALTY';

        const markerHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer">
            ${isHighlighted ? `<span class="absolute w-10 h-10 rounded-full border-2 border-[#D97706] animate-ping"></span>` : ''}
            ${!isSafe ? `<span class="absolute w-7 h-7 rounded-full ${colorClass} opacity-30 animate-pulse"></span>` : ''}
            <span class="relative w-4 h-4 rounded-full ${colorClass} border-2 ${isSelected ? 'border-[#D97706] scale-125' : 'border-white'} shadow-md transition-transform"></span>
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

    // 3. Polyline to Selected Target (National Amber tactical dash)
    if (selectedVictim && selectedVictim.status !== 'SAFE') {
      try {
        const targetCoords = sanitizeCoords(selectedVictim.lat, selectedVictim.lng);
        const line = L.polyline(
          [
            [rescuerPos.lat, rescuerPos.lng],
            [targetCoords.lat, targetCoords.lng]
          ],
          {
            color: '#D97706',
            weight: 2.5,
            dashArray: '6, 8',
            opacity: 0.9
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
        color: isDistressActive ? '#DC2626' : '#D97706',
        fillColor: isDistressActive ? '#DC2626' : '#D97706',
        fillOpacity: 0.18,
        weight: 1.5,
        dashArray: '4, 4'
      }).addTo(markersLayer);
    } catch (e) {}

    // 2. High-Accuracy Casualty Pin
    try {
      const pinColor = isDistressActive ? 'bg-[#DC2626]' : 'bg-[#D97706]';
      const pingColor = isDistressActive ? 'bg-[#DC2626]/40' : 'bg-[#D97706]/40';
      const borderTheme = isDistressActive
        ? 'bg-[#1A222D] text-[#DC2626] border-[#DC2626]'
        : 'bg-[#1A222D] text-[#D97706] border-[#2D3848]';

      const markerHtml = `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <span class="absolute w-10 h-10 rounded-full ${pingColor} animate-ping"></span>
          <span class="relative w-4 h-4 rounded-full ${pinColor} border-2 border-white shadow-md"></span>
          <div class="absolute top-5 flex flex-col items-center pointer-events-none">
            <span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded border whitespace-nowrap shadow-md ${borderTheme}">
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

  // Filtered active victims (ALL, CRITICAL, INJURED + Radius Distance Filter)
  const displayedActiveVictims = useMemo(() => {
    let list = activeVictimsList;
    if (victimSubFilter === 'CRITICAL') {
      list = list.filter(v => v.status === 'TRAPPED' || v.status === 'CRITICAL');
    } else if (victimSubFilter === 'INJURED') {
      list = list.filter(v => v.status === 'INJURED');
    }
    if (radiusFilterMeters > 0) {
      list = list.filter(v => {
        const d = calculateHaversine(gpsLocation.lat, gpsLocation.lng, v.lat, v.lng);
        return d <= radiusFilterMeters;
      });
    }
    return list;
  }, [activeVictimsList, victimSubFilter, radiusFilterMeters, gpsLocation]);

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
  // RENDER UI: CIVIC TACTICAL DISASTER RESILIENCE DASHBOARD
  // ==========================================
  return (
    <div className={`min-h-screen bg-[#0F141C] text-[#F1F5F9] flex flex-col font-sans select-none pb-12 transition-colors duration-75 ${
      isDistressActive && isStrobeActive && strobeFlashState ? 'ring-8 ring-[#D97706] bg-[#161208]' : ''
    }`}>
      {/* Optical Screen Strobe Overlay */}
      {isDistressActive && isStrobeActive && strobeFlashState && (
        <div className="fixed inset-0 bg-amber-200/10 pointer-events-none z-30 transition-opacity" />
      )}
      {/* 1. TOP WEB AUDIO AUTOPLAY GUARD BANNER */}
      {!audioUnlocked && (
        <div
          id="audio-unlock-banner"
          onClick={unlockAudio}
          className="bg-[#DC2626] border-b border-[#B91C1C] text-white text-xs sm:text-sm font-bold px-4 py-2.5 flex items-center justify-between shadow-lg cursor-pointer hover:bg-[#B91C1C] transition sticky top-0 z-50"
        >
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-white animate-bounce shrink-0" />
            <span>🔊 TAP ANYWHERE TO ACTIVATE EMERGENCY RADAR &amp; SONAR SYNTHESIZER</span>
          </div>
          <span className="bg-black/40 px-2.5 py-0.5 rounded text-[11px] uppercase tracking-wider font-mono border border-white/30 shrink-0">
            Click to Enable
          </span>
        </div>
      )}

      {/* 2. PERSISTENT MESH STATUS & HEALTH HEADER */}
      <header className="bg-[#1A222D] border-b border-[#2D3848] px-4 py-2.5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Official Logo & Node Identity */}
          <div className="flex items-center gap-3">
            <img
              src="/image_1.png"
              alt="Aapad Setu"
              className="h-10 w-auto object-contain shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#F1F5F9]">
                  आपद सेतु <span className="text-xs text-[#94A3B8] font-mono">(Aapad Setu)</span>
                </h1>
                <span className="bg-[#16A34A]/20 border border-[#16A34A]/40 text-[#16A34A] text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                  OFFLINE MESH
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#94A3B8] font-mono">
                <span>Node: <strong className="text-[#F1F5F9]">{myNodeId}</strong></span>
                <span>•</span>
                <span>Identity: <strong className="text-[#D97706]">{effectiveCallsign}</strong></span>
              </div>
            </div>
          </div>

          {/* Real-time Mesh Health Pill */}
          <div className="flex items-center gap-3 bg-[#0B0F15] border border-[#2D3848] px-3 py-1.5 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-1.5">
              {meshStatus === 'CONNECTED' ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                  <span className="text-[#16A34A] font-bold">MESH ONLINE</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] animate-pulse" />
                  <span className="text-[#D97706] font-bold">SEARCHING PEERS</span>
                </>
              )}
            </div>
            <span className="text-[#2D3848]">|</span>
            <div className="flex items-center gap-1 text-[#94A3B8]">
              <Users className="w-3.5 h-3.5 text-[#D97706]" />
              <span><strong className="text-[#F1F5F9]">{connectedPeers.length}</strong> Peers</span>
            </div>
            <span className="text-[#2D3848]">|</span>
            <div className="flex items-center gap-1 text-[#94A3B8]">
              <Battery className="w-3.5 h-3.5 text-[#16A34A]" />
              <span className="text-[#F1F5F9]">{batteryLevel}%</span>
            </div>
          </div>

          {/* ROLE SELECTOR NAVIGATION TABS */}
          <div className="flex items-center bg-[#0B0F15] p-1 rounded-lg border border-[#2D3848]">
            <button
              id="tab-victim-mode"
              onClick={() => setActiveRole('ROLE_VICTIM')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition font-mono ${
                activeRole === 'ROLE_VICTIM'
                  ? 'bg-[#DC2626] text-white border border-[#DC2626]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1A222D]'
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition font-mono ${
                activeRole === 'ROLE_RESPONDER'
                  ? 'bg-[#D97706] text-white border border-[#D97706]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1A222D]'
              }`}
            >
              <Navigation className="w-4 h-4" />
              <span>Rescuer Dashboard</span>
              {triageCounts.critical > 0 && (
                <span className="bg-[#DC2626] text-white text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
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
          <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full space-y-5">
            {/* OFFICIAL AAPAD SETU CIVIC TACTICAL BRAND BANNER */}
            <div className="bg-[#1A222D] border border-[#2D3848] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left shadow-sm">
              <img
                src="/image_1.png"
                alt="Aapad Setu"
                className="h-16 w-auto object-contain shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-[#F1F5F9] tracking-tight">
                    आपद सेतु (Aapad Setu)
                  </h2>
                  <span className="bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                    CIVIC TACTICAL MESH
                  </span>
                </div>
                <p className="text-xs font-mono text-[#D97706] font-bold tracking-wider uppercase mt-0.5">
                  OFFLINE EMERGENCY MESH • ZERO-INFRASTRUCTURE DISASTER RESPONSE
                </p>
                <p className="text-xs text-[#94A3B8] mt-1 font-sans">
                  Autonomous peer-to-peer telemetry protocol. Broadcasts emergency location and identity over local device mesh to rescuers without cellular towers or internet.
                </p>
              </div>
            </div>

            {/* CIVILIAN IDENTITY & EMERGENCY MEDICAL PROFILE CARD */}
            <div className="bg-[#1A222D] border border-[#2D3848] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0B0F15] border border-[#2D3848] text-[#D97706]">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#F1F5F9]">
                      Civilian Identity &amp; Medical Triage Profile
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      Transmitted in SOS mesh packet so rescue squads know your blood type and health needs immediately.
                    </p>
                  </div>
                </div>
                {victimName.trim() && (
                  <span className="bg-[#16A34A]/20 border border-[#16A34A]/40 text-[#16A34A] text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    <span>Active</span>
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
                    className="w-full bg-[#0B0F15] border border-[#2D3848] rounded-lg px-3.5 py-2.5 text-xs text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#D97706] font-sans pr-8"
                  />
                  {victimName && (
                    <button
                      onClick={() => handleUpdateVictimName('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white p-0.5"
                      title="Clear name"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  id="btn-open-medical-profile"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="bg-[#DC2626] hover:bg-[#B91C1C] text-white border border-[#DC2626] px-3 py-2.5 rounded-lg text-xs font-bold font-mono transition flex items-center gap-1.5 shrink-0"
                  title="Edit Emergency Medical Profile (Blood Group, Allergies, Emergency Contacts)"
                >
                  <Heart className="w-3.5 h-3.5 text-white" />
                  <span>Medical Card</span>
                  <Edit3 className="w-3 h-3 text-white/80 ml-0.5" />
                </button>
              </div>

              {/* Medical summary snapshot */}
              <div className="bg-[#0B0F15] border border-[#2D3848] rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="bg-[#DC2626] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                    Blood: {victimProfile?.bloodGroup || 'O+'}
                  </span>
                  {victimProfile?.healthIssues ? (
                    <span className="text-[#D97706] font-sans truncate max-w-[260px] sm:max-w-xs font-medium">
                      ⚠️ {victimProfile.healthIssues}
                    </span>
                  ) : (
                    <span className="text-[#94A3B8] italic">No chronic medical conditions listed</span>
                  )}
                </div>

                {victimProfile?.emergencyContact && (
                  <span className="text-[#16A34A] font-mono text-[10px]">
                    📞 {victimProfile.emergencyContact}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono pt-1 text-[#94A3B8] border-t border-[#2D3848]">
                <div className="flex items-center gap-1.5">
                  <span>Rescue Dispatch Identity:</span>
                  <strong className="text-[#D97706] font-bold">{effectiveCallsign}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span>Hardware Node:</span>
                  <span className="text-[#F1F5F9]">{myNodeId}</span>
                </div>
              </div>
            </div>

            {/* DISTRESS ACTIVE BANNER / TRANSMITTING STATE */}
            {isDistressActive ? (
              <div className="bg-[#1A222D] border-2 border-[#DC2626] rounded-xl p-6 text-center relative overflow-hidden shadow-xl">
                <div className="relative z-10 flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#DC2626]/20 border-2 border-[#DC2626] flex items-center justify-center">
                    <Radio className="w-8 h-8 text-[#DC2626] animate-pulse" />
                  </div>

                  <div>
                    <span className="bg-[#DC2626] text-white text-xs font-black uppercase tracking-widest px-3 py-1 rounded">
                      DISTRESS BEACON TRANSMITTING
                    </span>
                    <h2 className="text-2xl font-bold text-[#F1F5F9] mt-2">
                      SOS Mesh Broadcast Active
                    </h2>
                    <p className="text-xs text-[#DC2626] font-mono mt-1 font-semibold">
                      Continuous telemetry streaming every 3 seconds across {connectedPeers.length} peer nodes
                    </p>
                  </div>

                  {/* Telemetry Matrix Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full bg-[#0B0F15] border border-[#2D3848] rounded-lg p-3.5 text-left font-mono text-xs">
                    <div>
                      <span className="text-[#94A3B8] block text-[10px]">STATUS</span>
                      <strong className="text-[#DC2626] font-bold">{distressStatus}</strong>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] block text-[10px]">GPS LOCK</span>
                      <strong className="text-[#16A34A] font-bold">
                        {gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] block text-[10px]">BATTERY</span>
                      <strong className="text-[#D97706] font-bold">{batteryLevel}%</strong>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] block text-[10px]">PACKETS RELAYED</span>
                      <strong className="text-[#F1F5F9] font-bold">{packetsSentCount}</strong>
                    </div>
                  </div>

                  {/* EMERGENCY FLASHLIGHT STROBE & SHARP ACOUSTIC SIREN PANEL */}
                  <div className="w-full bg-[#141C26] border border-[#D97706] rounded-lg p-4 text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2.5 rounded-lg border transition-all ${
                          strobeFlashState
                            ? 'bg-[#D97706] text-black border-white'
                            : 'bg-[#0B0F15] text-[#D97706] border-[#2D3848]'
                        }`}>
                          <Flashlight className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[#F1F5F9]">
                              Emergency Flashlight Strobe &amp; Sharp Sound Siren
                            </h3>
                            <span className="bg-[#D97706]/20 text-[#D97706] text-[10px] font-mono px-2 py-0.5 rounded border border-[#D97706]/40 font-bold">
                              ACTIVE
                            </span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8] font-mono mt-0.5">
                            {hasHardwareTorch
                              ? '🔦 Hardware rear camera torch pulsing high-frequency strobe.'
                              : '💡 Screen optical strobe active (fallback for devices without torch).'} Sharp piercing 3.5kHz locator siren broadcasting.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Strobe & Sound Toggle Controls */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        id="btn-toggle-victim-strobe"
                        onClick={() => setIsStrobeActive(prev => !prev)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-bold font-mono transition flex items-center justify-center gap-2 border ${
                          isStrobeActive
                            ? 'bg-[#D97706] text-white border-[#D97706]'
                            : 'bg-[#0B0F15] text-[#94A3B8] border-[#2D3848] hover:text-white'
                        }`}
                      >
                        <Flashlight className="w-4 h-4" />
                        <span>{isStrobeActive ? '🔦 Flashlight: STROBING' : '🔦 Flashlight: PAUSED'}</span>
                      </button>

                      <button
                        id="btn-toggle-victim-audio"
                        onClick={() => setIsVictimAudioMuted(prev => !prev)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-bold font-mono transition flex items-center justify-center gap-2 border ${
                          !isVictimAudioMuted
                            ? 'bg-[#DC2626] text-white border-[#DC2626]'
                            : 'bg-[#0B0F15] text-[#94A3B8] border-[#2D3848] hover:text-white'
                        }`}
                      >
                        {!isVictimAudioMuted ? <Volume2 className="w-4 h-4 animate-bounce" /> : <VolumeX className="w-4 h-4" />}
                        <span>{!isVictimAudioMuted ? '🔊 Sharp Siren: ACTIVE' : '🔇 Siren: MUTED'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 5% CRITICAL BATTERY BLACKBOX PACKET DISPATCH PANEL */}
                  <div className="w-full bg-[#141C26] border border-[#2D3848] rounded-lg p-4 text-left font-mono text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BatteryWarning className={`w-4 h-4 ${batteryLevel <= 5 ? 'text-[#DC2626] animate-ping' : 'text-[#D97706]'}`} />
                        <span className="font-bold text-[#F1F5F9] text-xs">5% Critical Battery Protocol (Offline DTN)</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        batteryLevel <= 5
                          ? 'bg-[#DC2626] text-white'
                          : 'bg-[#0B0F15] text-[#D97706] border border-[#2D3848]'
                      }`}>
                        Battery: {batteryLevel}%
                      </span>
                    </div>

                    <p className="text-[11px] text-[#94A3B8] font-sans leading-relaxed">
                      When your device reaches 5% battery, an emergency black-box packet with your identity, medical notes, and last known location is automatically constructed, saved offline in local storage, and broadcast across the peer mesh.
                    </p>

                    <div className="flex flex-wrap items-center justify-between pt-1.5 border-t border-[#2D3848] gap-2">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className={`w-2 h-2 rounded-full ${lastGaspPacketSent ? 'bg-[#16A34A]' : 'bg-[#D97706] animate-pulse'}`} />
                        <span className="text-[#94A3B8]">
                          {lastGaspPacketSent
                            ? '5% Black-Box Packet Dispatched & Cached Offline'
                            : 'Standby: Automatically triggers when battery reaches ≤5%'}
                        </span>
                      </div>

                      <button
                        id="btn-simulate-battery-5pct"
                        onClick={() => transmitCritical5PctBatteryPacket(5)}
                        className="bg-[#0B0F15] hover:bg-[#242F3E] text-[#D97706] border border-[#2D3848] text-[10px] font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 font-mono"
                        title="Simulate battery level hitting 5% to test emergency blackbox packet"
                      >
                        <Zap className="w-3 h-3 text-[#D97706]" />
                        <span>Test 5% Battery Packet (Offline Mesh)</span>
                      </button>
                    </div>
                  </div>

                  {/* Interactive Live Casualty Location Map */}
                  <div className="w-full bg-[#0B0F15] border border-[#2D3848] rounded-lg p-3 flex flex-col space-y-2 text-left">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#DC2626]">
                        <MapIcon className="w-4 h-4 text-[#DC2626]" />
                        <span>Pinned Casualty Location (Mesh Broadcast)</span>
                      </div>
                      <span className="text-[10px] font-mono bg-[#1A222D] text-[#D97706] border border-[#2D3848] px-2 py-0.5 rounded">
                        ±{gpsLocation.accuracy || 5}m Confidence Halo
                      </span>
                    </div>

                    {/* Leaflet Map Canvas */}
                    <div
                      ref={victimMapContainerRef}
                      className="w-full h-64 sm:h-72 rounded-lg overflow-hidden border border-[#2D3848] relative"
                    />

                    <div className="flex items-center justify-between text-[11px] font-mono text-[#94A3B8] px-1 pt-0.5">
                      <span>Coordinates: [{gpsLocation.lat.toFixed(5)}, {gpsLocation.lng.toFixed(5)}]</span>
                      <button
                        onClick={() => {
                          if (victimLeafletMapRef.current) {
                            victimLeafletMapRef.current.flyTo([gpsLocation.lat, gpsLocation.lng], 18, { animate: true });
                          }
                        }}
                        className="text-[#D97706] hover:underline text-[11px] font-bold"
                      >
                        Center on My Beacon
                      </button>
                    </div>
                  </div>

                  {/* Safety Message Input */}
                  <div className="w-full text-left">
                    <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-1">
                      Situation Notes (Relayed to Rescuers):
                    </label>
                    <input
                      type="text"
                      value={distressMessage}
                      onChange={e => setDistressMessage(e.target.value)}
                      className="w-full bg-[#0B0F15] border border-[#2D3848] rounded-lg px-3 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#DC2626]"
                    />
                  </div>

                  {/* Cancel / Safe Button */}
                  <button
                    id="btn-cancel-distress"
                    onClick={deactivateDistressBeacon}
                    className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white border border-[#16A34A] font-bold py-3 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-sm font-mono"
                  >
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <span>I AM SAFE / CANCEL DISTRESS BEACON</span>
                  </button>
                </div>
              </div>
            ) : (
              /* HOLD FOR SOS ACTIVATION CONTROLLER */
              <div className="bg-[#1A222D] border border-[#2D3848] rounded-xl p-6 sm:p-8 flex flex-col items-center text-center space-y-6 shadow-sm">
                <div>
                  <span className="bg-[#0B0F15] text-[#94A3B8] border border-[#2D3848] text-xs font-mono uppercase px-3 py-1 rounded">
                    Zero-Touch Emergency Distress
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9] mt-2">
                    Emergency Beacon Trigger
                  </h2>
                  <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto mt-1">
                    Hold the button below for 3 seconds or speak a distress keyword. While holding, your GPS fix is locked and broadcast.
                  </p>
                </div>

                {/* 3-Second Hold SOS Circular Button */}
                <div className="relative flex items-center justify-center">
                  <svg className="w-52 h-52 -rotate-90 transform">
                    <circle
                      cx="104"
                      cy="104"
                      r="90"
                      stroke="#2D3848"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="104"
                      cy="104"
                      r="90"
                      stroke="#DC2626"
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
                    className={`absolute w-40 h-40 rounded-full font-black text-xl flex flex-col items-center justify-center shadow-lg transition active:scale-95 ${
                      isHoldingTrigger
                        ? 'bg-[#DC2626] text-white scale-105 ring-4 ring-[#D97706]'
                        : 'bg-[#DC2626] hover:bg-[#B91C1C] text-white'
                    }`}
                  >
                    <Flame className={`w-8 h-8 mb-1 ${isHoldingTrigger ? 'animate-bounce text-[#D97706]' : ''}`} />
                    <span>{isHoldingTrigger ? `HOLD ${Math.round(holdProgress)}%` : 'HOLD FOR SOS'}</span>
                    <span className="text-[10px] text-white/80 font-mono mt-0.5">
                      {isHoldingTrigger ? 'LOCKING GPS...' : '3 SECONDS'}
                    </span>
                  </button>
                </div>

                {/* Live Real-time Triangulation Feedback during hold */}
                {isHoldingTrigger && (
                  <div className="w-full bg-[#0B0F15] border border-[#D97706] rounded-lg p-3 text-center flex flex-col items-center justify-center space-y-1.5 animate-pulse">
                    <div className="flex items-center gap-2 text-xs font-mono text-[#D97706] font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-ping" />
                      <span>🛰️ Triangulating Accuratest GPS Location...</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono">
                      <span className="text-[#94A3B8]">
                        Accuracy: <strong className="text-[#16A34A] font-bold">±{holdingGpsAccuracy || gpsLocation.accuracy || 5}m</strong>
                      </span>
                      <span className="text-[#2D3848]">|</span>
                      <span className="text-[#94A3B8]">
                        Lat: <strong className="text-[#F1F5F9]">{gpsLocation.lat.toFixed(5)}</strong>
                      </span>
                      <span className="text-[#94A3B8]">
                        Lng: <strong className="text-[#F1F5F9]">{gpsLocation.lng.toFixed(5)}</strong>
                      </span>
                    </div>
                  </div>
                )}

                {/* Location Map Preview Toggle & Interactive Map */}
                <div className="w-full">
                  <button
                    id="btn-toggle-victim-map"
                    onClick={() => setVictimShowMap(prev => !prev)}
                    className="w-full bg-[#0B0F15] hover:bg-[#242F3E] text-[#F1F5F9] border border-[#2D3848] rounded-lg py-2.5 px-4 text-xs font-mono font-bold flex items-center justify-between transition"
                  >
                    <div className="flex items-center gap-2">
                      <MapIcon className="w-4 h-4 text-[#D97706]" />
                      <span>{victimShowMap ? 'Hide Location Map' : '🗺️ Preview My Location on Map'}</span>
                    </div>
                    <span className="text-[10px] text-[#94A3B8] font-mono">
                      GPS: [{gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)}]
                    </span>
                  </button>

                  {victimShowMap && (
                    <div className="mt-2.5 bg-[#0B0F15] border border-[#2D3848] rounded-lg p-3 flex flex-col space-y-2 text-left">
                      <div className="flex items-center justify-between text-xs font-mono px-1">
                        <span className="text-[#D97706] font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                          GPS Confidence Halo: ±{gpsLocation.accuracy || 8}m
                        </span>
                        <button
                          onClick={() => {
                            if (victimLeafletMapRef.current) {
                              victimLeafletMapRef.current.flyTo([gpsLocation.lat, gpsLocation.lng], 17, { animate: true });
                            }
                          }}
                          className="text-[#D97706] hover:underline text-[11px] font-bold"
                        >
                          Center on Pin
                        </button>
                      </div>
                      <div
                        ref={victimMapContainerRef}
                        className="w-full h-56 sm:h-64 rounded-lg overflow-hidden border border-[#2D3848] relative"
                      />
                    </div>
                  )}
                </div>

                {/* Quick Status Category Selectors */}
                <div className="w-full">
                  <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-2 text-left">
                    Select Triage Category:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'TRAPPED', label: 'Trapped / Debris', color: 'border-[#DC2626] bg-[#DC2626]/10 text-[#DC2626]' },
                      { key: 'INJURED', label: 'Severe Injury', color: 'border-[#D97706] bg-[#D97706]/10 text-[#D97706]' },
                      { key: 'CRITICAL', label: 'Life Critical', color: 'border-[#DC2626] bg-[#DC2626] text-white' }
                    ].map(st => (
                      <button
                        key={st.key}
                        onClick={() => activateDistressBeacon(st.key)}
                        className={`p-3 rounded-lg border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${st.color} hover:brightness-110`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>{st.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hands-Free Voice SOS Trigger */}
                <div className="w-full bg-[#141C26] border border-[#2D3848] rounded-lg p-3.5 flex items-center justify-between gap-3">
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-[#F1F5F9] flex items-center gap-1.5">
                      <Mic className="w-4 h-4 text-[#D97706]" />
                      <span>Hands-Free Voice SOS Listener</span>
                    </h4>
                    <p className="text-[11px] text-[#94A3B8] font-mono">
                      Say "Help", "Bachao", or "Emergency" to auto-broadcast
                    </p>
                    {speechTranscript && (
                      <p className="text-xs text-[#D97706] font-mono mt-1">"{speechTranscript}"</p>
                    )}
                  </div>
                  <button
                    id="btn-voice-sos"
                    onClick={toggleVoiceSosListener}
                    className={`px-3 py-2 rounded-lg text-xs font-bold font-mono transition flex items-center gap-1.5 ${
                      isListeningVoice
                        ? 'bg-[#DC2626] text-white animate-pulse'
                        : 'bg-[#0B0F15] text-[#94A3B8] border border-[#2D3848] hover:text-white'
                    }`}
                  >
                    {isListeningVoice ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    <span>{isListeningVoice ? 'LISTENING...' : 'ACTIVATE MIC'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mesh Store-and-Forward Telemetry Info */}
            <div className="bg-[#1A222D] border border-[#2D3848] rounded-xl p-3.5 text-xs font-mono text-[#94A3B8] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#16A34A] animate-pulse" />
                <span>Store-and-Forward Mesh Relay: <strong className="text-[#16A34A]">ACTIVE</strong></span>
              </div>
              <span className="text-slate-500">TTL 10 Hops</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW B: RESCUER DASHBOARD (ROLE_RESPONDER)                                 */}
        {/* ========================================================================= */}
        {activeRole === 'ROLE_RESPONDER' && (
          <div className="flex-1 flex flex-col space-y-5">
            {/* AREA TRIAGE METRICS BANNER */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#1A222D] border border-[#2D3848] rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#DC2626] uppercase font-mono">Critical / Trapped</span>
                  <AlertTriangle className="w-4 h-4 text-[#DC2626] animate-pulse" />
                </div>
                <div className="text-3xl font-bold text-[#F1F5F9] mt-1">{triageCounts.critical}</div>
                <span className="text-[11px] text-[#94A3B8] font-mono">Immediate Extraction</span>
              </div>

              <div className="bg-[#1A222D] border border-[#2D3848] rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#D97706] uppercase font-mono">Injured Persons</span>
                  <Activity className="w-4 h-4 text-[#D97706]" />
                </div>
                <div className="text-3xl font-bold text-[#F1F5F9] mt-1">{triageCounts.injured}</div>
                <span className="text-[11px] text-[#94A3B8] font-mono">Medical Aid Required</span>
              </div>

              <div className="bg-[#1A222D] border border-[#2D3848] rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#16A34A] uppercase font-mono">Rescued / Safe</span>
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                </div>
                <div className="text-3xl font-bold text-[#F1F5F9] mt-1">{triageCounts.safe}</div>
                <span className="text-[11px] text-[#94A3B8] font-mono">Evacuated / Stabilized</span>
              </div>

              <div className="bg-[#1A222D] border border-[#2D3848] rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#94A3B8] uppercase font-mono">Active Mesh Nodes</span>
                  <Radio className="w-4 h-4 text-[#D97706]" />
                </div>
                <div className="text-3xl font-bold text-[#F1F5F9] mt-1">{connectedPeers.length + 1}</div>
                <span className="text-[11px] text-[#94A3B8] font-mono">P2P STUN WebRTC</span>
              </div>
            </div>

            {/* NOTIFICATION FEEDBACK BANNER */}
            {notificationMsg && (
              <div className="bg-[#1A222D] border border-[#16A34A] text-[#16A34A] px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  <span>{notificationMsg}</span>
                </div>
                <button
                  onClick={() => setNotificationMsg(null)}
                  className="text-[#94A3B8] hover:text-white text-xs px-2 py-0.5 rounded hover:bg-[#0B0F15]"
                >
                  ✕
                </button>
              </div>
            )}

            {/* TWO-COLUMN TACTICAL VIEW: SPATIAL NAVIGATOR (MAP/RADAR) + TRIAGE ROSTER */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
              {/* LEFT COLUMN: TACTICAL SPATIAL NAVIGATOR (DUAL MAP / GYRO RADAR) */}
              <div className="lg:col-span-6 bg-[#1A222D] border border-[#2D3848] rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm space-y-3">
                {/* Spatial View Header & Switcher Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2D3848] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[#0B0F15] p-1 rounded-lg border border-[#2D3848]">
                      <button
                        id="tab-view-map"
                        onClick={() => setSpatialViewMode('MAP')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition font-mono ${
                          spatialViewMode === 'MAP'
                            ? 'bg-[#D97706] text-white'
                            : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                        }`}
                      >
                        <MapIcon className="w-3.5 h-3.5" />
                        <span>Tactical Map</span>
                      </button>
                      <button
                        id="tab-view-radar"
                        onClick={() => setSpatialViewMode('RADAR')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition font-mono ${
                          spatialViewMode === 'RADAR'
                            ? 'bg-[#D97706] text-white'
                            : 'text-[#94A3B8] hover:text-[#F1F5F9]'
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
                          className="bg-[#0B0F15] hover:bg-[#242F3E] text-[#F1F5F9] text-[10px] font-bold px-2.5 py-1 rounded-lg border border-[#2D3848] font-mono flex items-center gap-1"
                          title="Center Map on Rescuer"
                        >
                          <Crosshair className="w-3 h-3 text-[#D97706]" />
                          <span>Center You</span>
                        </button>
                        {selectedVictim && (
                          <button
                            id="btn-map-center-victim"
                            onClick={() => locateVictimOnMap(selectedVictim)}
                            className="bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[10px] font-bold px-2.5 py-1 rounded-lg border border-[#DC2626] font-mono flex items-center gap-1"
                            title="Center Map on Selected Casualty"
                          >
                            <MapPin className="w-3 h-3 text-white" />
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
                            className="bg-[#0B0F15] hover:bg-[#242F3E] text-[#D97706] text-[10px] font-bold px-2 py-1 rounded-lg border border-[#2D3848] flex items-center gap-1 font-mono"
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
                          className="bg-[#0B0F15] hover:bg-[#242F3E] text-[#94A3B8] hover:text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-[#2D3848] font-mono"
                        >
                          {radarHeadingMode === 'HEAD_UP' ? '🧭 HEAD-UP' : '🗺️ NORTH-UP'}
                        </button>
                        <button
                          id="btn-test-sonar-ping"
                          onClick={testAudioPing}
                          className="bg-[#0B0F15] hover:bg-[#242F3E] text-[#D97706] border border-[#2D3848] text-[10px] font-bold px-2 py-1 rounded-lg font-mono flex items-center gap-1 transition"
                          title="Play a test acoustic sonar ping (1150Hz)"
                        >
                          <Volume2 className="w-3 h-3 text-[#D97706]" />
                          <span>TEST PING</span>
                        </button>
                        <button
                          id="btn-toggle-sonar-mute"
                          onClick={() => setIsSonarMuted(prev => !prev)}
                          className={`p-1.5 rounded-lg border text-xs ${
                            isSonarMuted
                              ? 'bg-[#DC2626]/20 border-[#DC2626] text-[#DC2626]'
                              : 'bg-[#16A34A]/20 border-[#16A34A] text-[#16A34A]'
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
                <div className="relative flex-1 min-h-[340px] sm:min-h-[380px] rounded-lg overflow-hidden border border-[#2D3848] bg-[#0B0F15] flex flex-col justify-center">
                  {spatialViewMode === 'MAP' ? (
                    /* 1. INTERACTIVE TACTICAL LEAFLET MAP */
                    <div className="relative w-full h-full flex-1 min-h-[340px] sm:min-h-[380px]">
                      <div ref={mapContainerRef} className="w-full h-full min-h-[340px] sm:min-h-[380px] z-10" />

                      {/* Overlaid Target Lock HUD Pill on Map */}
                      {currentRadarTarget && (
                        <div className="absolute top-2 left-2 z-20 bg-[#1A222D] border border-[#2D3848] text-[#F1F5F9] rounded-lg px-3 py-1.5 font-mono text-xs shadow-md pointer-events-none flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#D97706] animate-ping" />
                          <span>
                            Target: <strong className="text-[#D97706]">{currentRadarTarget.victimName ? `${currentRadarTarget.victimName} (${currentRadarTarget.callsign})` : currentRadarTarget.callsign}</strong> ({currentTargetDistance.toFixed(1)}m away)
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
                          <circle cx="160" cy="160" r="150" fill="#0B0F15" stroke="#2D3848" strokeWidth="2" />

                          {/* Concentric Range Rings */}
                          <circle cx="160" cy="160" r="120" fill="none" stroke="#2D3848" strokeWidth="1" strokeDasharray="4 4" />
                          <circle cx="160" cy="160" r="80" fill="none" stroke="#2D3848" strokeWidth="1" strokeDasharray="4 4" />
                          <circle cx="160" cy="160" r="40" fill="none" stroke="#2D3848" strokeWidth="1" strokeDasharray="4 4" />

                          {/* Crosshairs */}
                          <line x1="160" y1="10" x2="160" y2="310" stroke="#2D3848" strokeWidth="1" />
                          <line x1="10" y1="160" x2="310" y2="160" stroke="#2D3848" strokeWidth="1" />

                          {/* Cardinal Direction Markers */}
                          <text x="160" y="24" fill="#D97706" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            {radarHeadingMode === 'HEAD_UP' ? 'AHD' : 'N'}
                          </text>
                          <text x="304" y="164" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">E</text>
                          <text x="160" y="306" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">S</text>
                          <text x="16" y="164" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">W</text>

                          {/* Animated Radar Sweep Beam */}
                          <g transform={`rotate(${compassHeading} 160 160)`}>
                            <line x1="160" y1="160" x2="160" y2="10" stroke="#D97706" strokeWidth="2" strokeOpacity="0.8" />
                          </g>

                          {/* Rescuer Center Blip */}
                          <circle cx="160" cy="160" r="6" fill="#D97706" stroke="#ffffff" strokeWidth="2" />

                          {/* PLOTTED CASUALTY VICTIM BLIPS (STRICTLY ONLY VICTIMS IN DANGER) */}
                          {endangeredVictims.length === 0 ? (
                            <g>
                              {/* Green sector clear indicator when no casualties are in danger */}
                              <circle cx="160" cy="160" r="36" fill="#16A34A" fillOpacity="0.08" stroke="#16A34A" strokeWidth="1" strokeDasharray="3 3" />
                              <text x="160" y="200" fill="#16A34A" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                                ALL SECTORS CLEAR
                              </text>
                              <text x="160" y="214" fill="#94A3B8" fontSize="8" textAnchor="middle" fontFamily="monospace">
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
                              const blipColor = victim.status === 'INJURED' ? '#D97706' : '#DC2626';
                              const displayName = victim.victimName || (victim.callsign && victim.callsign.includes('(') ? victim.callsign.split('(')[0].trim() : victim.callsign);

                              return (
                                <g
                                  key={victim.uuid || victim.id}
                                  transform={`translate(${x}, ${y})`}
                                  onClick={() => locateVictimOnMap(victim)}
                                  className="cursor-pointer"
                                >
                                  {isHighlighted && (
                                    <circle r="14" fill="none" stroke="#D97706" strokeWidth="2" className="animate-ping" />
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
                <div className="bg-[#141C26] border border-[#2D3848] rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#94A3B8]">Scale:</span>
                      {[20, 50, 100, 500].map(scale => (
                        <button
                          key={scale}
                          onClick={() => setRadarScaleMeters(scale)}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            radarScaleMeters === scale
                              ? 'bg-[#D97706] text-white'
                              : 'bg-[#0B0F15] text-[#94A3B8] border border-[#2D3848] hover:text-white'
                          }`}
                        >
                          {scale}m
                        </button>
                      ))}
                    </div>

                    {/* Proximity Sonar Status Indicator */}
                    <div className="flex items-center gap-1.5 text-[10px] bg-[#0B0F15] px-2 py-1 rounded border border-[#2D3848]">
                      <span className={`w-2 h-2 rounded-full ${isSonarMuted ? 'bg-slate-600' : sonarProximityTarget ? 'bg-[#16A34A] animate-ping' : 'bg-slate-500'}`} />
                      <span className="text-[#94A3B8]">Sonar:</span>
                      <strong className={isSonarMuted ? 'text-[#94A3B8]' : sonarProximityTarget ? 'text-[#16A34A]' : 'text-[#94A3B8]'}>
                        {isSonarMuted
                          ? 'Muted'
                          : sonarProximityTarget
                          ? `Active (≤50m: ${(sonarProximityTarget.victim.victimName || sonarProximityTarget.victim.callsign)} at ${sonarProximityTarget.distance.toFixed(0)}m)`
                          : 'Silent (No victims within 50m)'}
                      </strong>
                    </div>
                  </div>

                  {currentRadarTarget ? (
                    <div className="text-right">
                      <span className="text-[#94A3B8] block text-[10px]">LOCKED TARGET</span>
                      <strong className="text-[#D97706] font-bold">
                        {currentRadarTarget.victimName ? `${currentRadarTarget.victimName} · ` : ''}{currentRadarTarget.callsign} — {currentTargetDistance.toFixed(1)}m (
                        {Math.round(relativeTargetBearing)}° rel)
                      </strong>
                    </div>
                  ) : (
                    <div className="text-right">
                      <span className="text-[#16A34A] font-mono text-[11px] font-bold">
                        🟢 All Sectors Clear
                      </span>
                      <span className="text-[#94A3B8] block text-[9px] font-mono">Radar Clear</span>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: AREA CASUALTY TRIAGE ROSTER (SEPARATED VICTIMS & RESCUED LISTS) */}
              <div className="lg:col-span-6 bg-[#1A222D] border border-[#2D3848] rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm space-y-4">
                {/* Roster Header with PRIMARY TAB SWITCHER: VICTIMS vs RESCUED */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2D3848] pb-3">
                  <div className="flex items-center gap-2">
                    {/* Tab 1: VICTIMS */}
                    <button
                      id="tab-roster-victims"
                      onClick={() => setRosterTab('VICTIMS')}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition font-mono ${
                        rosterTab === 'VICTIMS'
                          ? 'bg-[#DC2626] text-white border border-[#DC2626]'
                          : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#0B0F15]'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-white" />
                      <span>Victims</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                          activeVictimsList.length > 0 ? 'bg-white text-[#DC2626]' : 'bg-[#0B0F15] text-[#94A3B8]'
                        }`}
                      >
                        {activeVictimsList.length}
                      </span>
                    </button>

                    {/* Tab 2: RESCUED */}
                    <button
                      id="tab-roster-rescued"
                      onClick={() => setRosterTab('RESCUED')}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition font-mono ${
                        rosterTab === 'RESCUED'
                          ? 'bg-[#16A34A] text-white border border-[#16A34A]'
                          : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#0B0F15]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      <span>Rescued</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#0B0F15] text-[#16A34A] border border-[#2D3848]">
                        {rescuedList.length}
                      </span>
                    </button>
                  </div>

                  {/* Sub-Filters: Status & Radius Proximity + Drill Button */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {rosterTab === 'VICTIMS' && (
                      <>
                        {/* Status Filter */}
                        <div className="flex items-center bg-[#0B0F15] p-0.5 rounded-lg border border-[#2D3848] text-[10px] font-bold font-mono">
                          {['ALL', 'CRITICAL', 'INJURED'].map(f => (
                            <button
                              key={f}
                              onClick={() => setVictimSubFilter(f)}
                              className={`px-2 py-0.5 rounded transition ${
                                victimSubFilter === f
                                  ? 'bg-[#D97706] text-white'
                                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                              }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>

                        {/* Proximity Radius Filter */}
                        <div className="flex items-center bg-[#0B0F15] p-0.5 rounded-lg border border-[#2D3848] text-[10px] font-bold font-mono">
                          {[
                            { label: 'All Dist', val: 0 },
                            { label: '<500m', val: 500 },
                            { label: '<1km', val: 1000 },
                            { label: '<2km', val: 2000 }
                          ].map(r => (
                            <button
                              key={r.val}
                              onClick={() => setRadiusFilterMeters(r.val)}
                              className={`px-1.5 py-0.5 rounded transition ${
                                radiusFilterMeters === r.val
                                  ? 'bg-[#D97706] text-white'
                                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                              }`}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    <button
                      id="btn-simulate-casualty"
                      onClick={simulateDrillVictim}
                      className="bg-[#0B0F15] hover:bg-[#242F3E] text-[#D97706] text-[10px] font-bold px-2 py-1 rounded-lg border border-[#2D3848] font-mono transition flex items-center gap-1"
                      title="Inject simulated drill victim near your coordinates"
                    >
                      <span>+ Drill</span>
                    </button>
                  </div>
                </div>

                {/* CASUALTIES LIST SCROLL CONTAINER */}
                <div className="flex-1 overflow-y-auto max-h-[380px] space-y-3 pr-1">
                  {/* VIEW 1: ACTIVE VICTIMS LIST */}
                  {rosterTab === 'VICTIMS' && (
                    <>
                      {displayedActiveVictims.length === 0 ? (
                        <div className="text-center py-12 text-[#94A3B8] font-mono text-xs flex flex-col items-center justify-center space-y-2">
                          <CheckCircle2 className="w-8 h-8 text-[#16A34A]" />
                          <span className="text-[#F1F5F9] font-bold">No active unrescued victims in current filter sector.</span>
                          <span className="text-[11px] text-[#94A3B8]">
                            {rescuedList.length > 0
                              ? `All ${rescuedList.length} casualties are safe in the Rescued list.`
                              : 'Click "+ Drill" to simulate an emergency casualty.'}
                          </span>
                        </div>
                      ) : (
                        displayedActiveVictims.map(v => {
                          const dist = calculateHaversine(gpsLocation.lat, gpsLocation.lng, v.lat, v.lng);
                          const isSelected = selectedVictim?.id === v.id || selectedVictim?.uuid === v.uuid;
                          const isHighlighted = locateHighlightId === (v.uuid || v.id);
                          const profile = v.victimProfile;

                          return (
                            <div
                              key={v.uuid || v.id}
                              onClick={() => setSelectedVictim(v)}
                              className={`p-3.5 rounded-lg border transition cursor-pointer flex flex-col space-y-2.5 ${
                                isHighlighted
                                  ? 'border-[#D97706] ring-2 ring-[#D97706] bg-[#1A222D]'
                                  : isSelected
                                  ? 'border-[#D97706] bg-[#1A222D]'
                                  : v.status === 'INJURED'
                                  ? 'border-[#2D3848] bg-[#141C26]'
                                  : 'border-[#2D3848] bg-[#141C26]'
                              }`}
                            >
                              {/* Card Top Row with Clear Victim Name */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-3 h-3 rounded-full shrink-0 ${
                                      v.status === 'INJURED'
                                        ? 'bg-[#D97706]'
                                        : 'bg-[#DC2626] animate-pulse'
                                    }`}
                                  />
                                  <div className="flex flex-col text-left">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-bold text-[#F1F5F9] tracking-wide">
                                        {v.victimName || (v.callsign && v.callsign.includes('(') ? v.callsign.split('(')[0].trim() : v.callsign)}
                                      </span>
                                      <span className="text-[10px] bg-[#0B0F15] text-[#94A3B8] border border-[#2D3848] px-1.5 py-0.5 rounded font-mono">
                                        {dist.toFixed(0)}m away
                                      </span>
                                      {profile?.bloodGroup && (
                                        <span className="bg-[#DC2626] text-white text-[9px] font-mono font-bold px-1.5 py-0.2 rounded">
                                          Blood: {profile.bloodGroup}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-[#94A3B8] font-mono">
                                      Node / Callsign: <strong className="text-[#D97706]">{v.callsign}</strong>
                                    </span>
                                  </div>
                                </div>

                                <span
                                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono ${
                                    v.status === 'INJURED'
                                      ? 'bg-[#D97706] text-white'
                                      : 'bg-[#DC2626] text-white'
                                  }`}
                                >
                                  {v.status}
                                </span>
                              </div>

                              {/* Distress Message Notes */}
                              <p className="text-xs text-[#F1F5F9] font-sans leading-relaxed text-left">
                                {v.distressMessage || 'Distress Telemetry Packet Stream Active'}
                              </p>

                              {/* 5% Critical Battery "Last Gasp" Alert Badge */}
                              {Boolean(v.isLastGaspPacket || (typeof v.battery === 'number' && v.battery <= 5) || v.status?.includes('5%')) && (
                                <div className="bg-[#0B0F15] border border-[#D97706] rounded-lg p-2.5 flex items-start gap-2">
                                  <BatteryWarning className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5 animate-pulse" />
                                  <div className="text-[11px] font-mono leading-tight space-y-0.5 text-left">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-[#D97706]">🪫 CRITICAL 5% BATTERY LAST-GASP PACKET</span>
                                      <span className="bg-[#D97706]/20 text-[#D97706] text-[9px] px-1.5 py-0.2 rounded border border-[#D97706]/40">
                                        OFFLINE MESH RELAYED
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-[#94A3B8] font-sans">
                                      Victim's phone power dropped to 5%. Last known coordinates locked: <strong>[{(v.lastKnownLocation?.lat || v.lat).toFixed(5)}, {(v.lastKnownLocation?.lng || v.lng).toFixed(5)}]</strong> (±{(v.lastKnownLocation?.accuracy || v.accuracy || 5).toFixed(0)}m).
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Emergency Medical Alerts & Triage Insights */}
                              {(profile?.healthIssues || profile?.emergencyContact || v.medical) && (
                                <div className="bg-[#0B0F15] border border-[#2D3848] rounded-lg p-2 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                                  <div className="flex items-center gap-1.5 text-[#D97706]">
                                    <Heart className="w-3 h-3 text-[#DC2626] shrink-0" />
                                    <span className="font-sans font-medium">
                                      {profile?.healthIssues || v.medical}
                                    </span>
                                  </div>
                                  {profile?.emergencyContact && (
                                    <span className="text-[#16A34A] font-mono">
                                      Contact: {profile.emergencyContact}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Telemetry & Action Buttons */}
                              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#2D3848] text-[11px] font-mono gap-2">
                                <span className="text-[#94A3B8] text-[10px]">
                                  Battery: <strong className="text-[#F1F5F9]">{v.battery}%</strong> | [ {v.lat.toFixed(4)}, {v.lng.toFixed(4)} ]
                                </span>

                                <div className="flex items-center gap-2">
                                  {/* OPTION TO LOCATE VICTIM ON MAP */}
                                  <button
                                    id={`btn-locate-${v.id || v.uuid}`}
                                    onClick={e => {
                                      e.stopPropagation();
                                      locateVictimOnMap(v);
                                    }}
                                    className="bg-[#0B0F15] hover:bg-[#242F3E] text-[#F1F5F9] px-2.5 py-1 rounded-lg border border-[#2D3848] text-[11px] font-bold font-mono transition flex items-center gap-1"
                                    title="Locate victim on tactical map"
                                  >
                                    <MapPin className="w-3.5 h-3.5 text-[#D97706]" />
                                    <span>Locate on Map</span>
                                  </button>

                                  {/* MARK VICTIM SAFE (MOVES TO RESCUED LIST) */}
                                  <button
                                    id={`btn-mark-safe-${v.id || v.uuid}`}
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleUpdateVictimStatus(v.id || v.uuid, 'SAFE');
                                    }}
                                    className="bg-[#16A34A] hover:bg-[#15803D] text-white px-2.5 py-1 rounded-lg border border-[#16A34A] text-[11px] font-bold font-mono transition flex items-center gap-1"
                                    title="Mark victim safe and move to Rescued list"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                    <span>Mark Safe</span>
                                  </button>

                                  {/* Secondary triage option */}
                                  {v.status !== 'INJURED' && (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleUpdateVictimStatus(v.id || v.uuid, 'INJURED');
                                      }}
                                      className="bg-[#0B0F15] hover:bg-[#242F3E] text-[#D97706] px-2 py-1 rounded-lg border border-[#2D3848] text-[10px] font-bold font-mono transition"
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
                        <div className="text-center py-12 text-[#94A3B8] font-mono text-xs flex flex-col items-center justify-center space-y-2">
                          <LifeBuoy className="w-8 h-8 text-[#64748B]" />
                          <span className="text-[#F1F5F9] font-bold">No rescued casualties recorded yet.</span>
                          <span className="text-[11px] text-[#94A3B8]">
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
                              className={`p-3.5 rounded-lg border transition cursor-pointer flex flex-col space-y-2.5 ${
                                isHighlighted
                                  ? 'border-[#16A34A] ring-2 ring-[#16A34A] bg-[#1A222D]'
                                  : isSelected
                                  ? 'border-[#16A34A] bg-[#1A222D]'
                                  : 'border-[#2D3848] bg-[#141C26]'
                              }`}
                            >
                              {/* Card Top Row with Rescued Civilian Name */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                                  <div className="flex flex-col text-left">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-bold text-[#F1F5F9] tracking-wide">
                                        {v.victimName || (v.callsign && v.callsign.includes('(') ? v.callsign.split('(')[0].trim() : v.callsign)}
                                      </span>
                                      <span className="text-[10px] bg-[#0B0F15] text-[#94A3B8] border border-[#2D3848] px-1.5 py-0.5 rounded font-mono">
                                        {dist.toFixed(0)}m away
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-[#94A3B8] font-mono">
                                      Node / Callsign: <strong className="text-[#16A34A]">{v.callsign}</strong>
                                    </span>
                                  </div>
                                </div>

                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/40 font-mono">
                                  ✓ RESCUED / SAFE
                                </span>
                              </div>

                              {/* Distress Message Notes */}
                              <p className="text-xs text-[#94A3B8] font-sans leading-relaxed text-left">
                                {v.distressMessage || 'Casualty stabilized and marked Safe.'}
                              </p>

                              {/* Telemetry & Action Buttons */}
                              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#2D3848] text-[11px] font-mono gap-2">
                                <span className="text-[#94A3B8] text-[10px]">
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
                                    className="bg-[#0B0F15] hover:bg-[#242F3E] text-[#F1F5F9] px-2.5 py-1 rounded-lg border border-[#2D3848] text-[11px] font-bold font-mono transition flex items-center gap-1"
                                    title="Locate safe point on tactical map"
                                  >
                                    <MapPin className="w-3.5 h-3.5 text-[#16A34A]" />
                                    <span>Locate on Map</span>
                                  </button>

                                  {/* Return to Active Victims if needed */}
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleUpdateVictimStatus(v.id || v.uuid, 'INJURED');
                                    }}
                                    className="bg-[#0B0F15] hover:bg-[#242F3E] text-[#D97706] px-2 py-1 rounded-lg border border-[#2D3848] text-[10px] font-bold font-mono transition flex items-center gap-1"
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
                <div className="bg-[#0B0F15] border border-[#2D3848] rounded-lg p-3 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-[#94A3B8] text-[10px] border-b border-[#2D3848] pb-1 mb-1.5">
                    <span>LIVE EMERGENCY DISPATCH LOGS ( आपद सेतु )</span>
                    <span className="text-[#16A34A] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-ping" /> STREAMING
                    </span>
                  </div>
                  <div className="max-h-20 overflow-y-auto space-y-1 text-[#F1F5F9] text-left">
                    {protocolLogs.slice(0, 6).map(l => (
                      <div key={l.id} className="flex items-start gap-1.5 leading-tight">
                        <span className="text-[#64748B]">[{l.timestamp}]</span>
                        <span className="text-[#D97706]">[{l.category}]</span>
                        <span className="text-[#F1F5F9]">{l.text}</span>
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
          <div className="bg-[#1A222D] border-2 border-[#DC2626] rounded-xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#DC2626]/20 border-2 border-[#DC2626] flex items-center justify-center mx-auto animate-bounce">
              <AlertTriangle className="w-7 h-7 text-[#DC2626]" />
            </div>

            <div>
              <span className="bg-[#DC2626] text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded font-mono">
                TACTICAL EMERGENCY ALERT
              </span>
              <h3 className="text-xl font-bold text-[#F1F5F9] mt-1">
                New Critical Casualty Detected!
              </h3>
              <div className="mt-1 flex flex-col items-center">
                <span className="text-base font-bold text-[#D97706] tracking-wide">
                  Victim: {activeAlertPopup.victimName || (activeAlertPopup.callsign?.includes('(') ? activeAlertPopup.callsign.split('(')[0].trim() : activeAlertPopup.callsign)}
                </span>
                <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
                  Node / Callsign: <strong className="text-[#F1F5F9]">{activeAlertPopup.callsign || activeAlertPopup.id}</strong>
                </p>
              </div>
            </div>

            <div className="bg-[#0B0F15] border border-[#2D3848] rounded-lg p-3 text-left font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Status:</span>
                <strong className="text-[#DC2626]">{activeAlertPopup.status}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">GPS Coordinates:</span>
                <strong className="text-[#F1F5F9]">
                  {activeAlertPopup.lat?.toFixed(4)}, {activeAlertPopup.lng?.toFixed(4)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Battery Level:</span>
                <strong className="text-[#D97706]">{activeAlertPopup.battery}%</strong>
              </div>
              {(activeAlertPopup.victimProfile?.bloodGroup || activeAlertPopup.victimProfile?.healthIssues || activeAlertPopup.medical) && (
                <div className="pt-1 border-t border-[#2D3848] mt-1 space-y-0.5">
                  {activeAlertPopup.victimProfile?.bloodGroup && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#DC2626]">Blood Type:</span>
                      <strong className="text-white bg-[#DC2626] px-1.5 py-0.2 rounded font-mono">
                        {activeAlertPopup.victimProfile.bloodGroup}
                      </strong>
                    </div>
                  )}
                  {(activeAlertPopup.victimProfile?.healthIssues || activeAlertPopup.medical) && (
                    <p className="text-[#D97706] text-[11px] font-sans">
                      ⚠️ Medical: {activeAlertPopup.victimProfile?.healthIssues || activeAlertPopup.medical}
                    </p>
                  )}
                </div>
              )}
              {Boolean(activeAlertPopup.isLastGaspPacket || (typeof activeAlertPopup.battery === 'number' && activeAlertPopup.battery <= 5) || activeAlertPopup.status?.includes('5%')) && (
                <div className="bg-[#141C26] border border-[#D97706] rounded-lg p-2 mt-1.5 flex items-start gap-2">
                  <BatteryWarning className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5 animate-pulse" />
                  <div className="text-[10px] font-mono leading-tight">
                    <span className="font-bold text-[#D97706]">🪫 CRITICAL 5% BATTERY LAST-GASP PACKET</span>
                    <p className="text-[#94A3B8] mt-0.5 font-sans">
                      Device reached 5% battery shutdown threshold. Last known coordinates autonomously locked and routed offline over mesh.
                    </p>
                  </div>
                </div>
              )}
              <p className="text-[#F1F5F9] font-sans text-xs pt-1 border-t border-[#2D3848] mt-1">
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
                className="w-full sm:flex-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold py-2.5 px-3 rounded-lg text-xs transition flex items-center justify-center gap-2 font-mono"
              >
                <MapPin className="w-4 h-4 text-white" />
                <span>Locate on Map &amp; Track</span>
              </button>
              <button
                onClick={() => setActiveAlertPopup(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#0B0F15] hover:bg-[#242F3E] text-[#94A3B8] hover:text-white font-bold rounded-lg text-xs transition font-mono border border-[#2D3848]"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. EMERGENCY CIVILIAN MEDICAL PROFILE MODAL DIALOG                        */}
      {/* ========================================================================= */}
      <EmergencyProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentProfile={victimProfile}
        onSave={handleSaveVictimProfile}
      />
    </div>
  );
}
