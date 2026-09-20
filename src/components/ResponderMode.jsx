import React, { useState } from 'react';
import {
  Globe,
  Wifi,
  WifiOff,
  UploadCloud,
  ExternalLink,
  Shield,
  Activity,
  AlertTriangle,
  UserCheck,
  MapPin,
  Signal,
  Clock,
  Volume2,
  VolumeX,
  Compass,
  Sliders,
  ArrowRight,
  Navigation,
  RotateCcw,
  Check,
  Copy,
  Users,
  Terminal,
  CheckCircle2,
  Share2,
  Radio,
  Server,
  Zap,
  Waves,
  Mic,
  Bluetooth,
  QrCode
} from 'lucide-react';

export default function ResponderMode({
  nodes,
  setNodes,
  metrics,
  dispatchLedger,
  selectedIncident,
  setSelectedIncident,
  victimAggregator,
  nodeCOnlineStatus,
  toggleNodeCUplink,
  syncPacketsToCloud,
  markIncidentDispatched,
  manualCoords,
  gpsState,
  rescuerOffset,
  setRescuerOffset,
  radarScale,
  setRadarScale,
  isRadarMuted,
  toggleRadarAudioMute,
  emitAcousticPulse,
  isAcousticPulseEmitting,
  compassHeading = 0,
  isGyroActive = false,
  isGyroSupported = true,
  gyroPermissionState = 'prompt',
  requestGyroPermission,
  isCalibrating = false,
  calibrationProgress = 0,
  calibrateCompass,
  compassAccuracy = 'HIGH',
  isSimulatedHeading = false,
  setIsSimulatedHeading,
  simulatedHeading = 0,
  setSimulatedHeading,
  calculateHaversine,
  calculateBearing,
  calculateRSSI,
  getCardinalDirection,
  detectedPeers,
  stepCloserToVictim,
  stepAwayFromVictim,
  setSliderDistance,
  moveRescuerDelta,
  formatTimeSince,
  markVictimSafe,
  injectSimulatedCasualties,
  clearSimulatedVictims,
  copiedKey,
  copyText,
  executeRelayHop,
  executeGatewaySync,
  onOpenBleModal,
  onOpenP2PModal,
  bleTelemetry,
  p2pConnectionState
}) {
  const [rosterFilter, setRosterFilter] = useState('ALL');
  const [showGyroSimulator, setShowGyroSimulator] = useState(false);
  // RADAR DISPLAY ORIENTATION: 'HEAD_UP' (Track-Up / Forward Relative) or 'NORTH_UP' (True Geographic North Fixed at 12 o'clock)
  const [radarOrientationMode, setRadarOrientationMode] = useState('HEAD_UP');

  // Motion Trail and Approach Speed Engine
  const [motionTrail, setMotionTrail] = useState([]);
  const prevDistRef = React.useRef(22.0);
  const [closingSpeed, setClosingSpeed] = useState(0);
  const [isAutoWalking, setIsAutoWalking] = useState(false);

  // Auto-walk continuous simulation loop (1.2 m/s forward approach)
  React.useEffect(() => {
    let interval = null;
    if (isAutoWalking) {
      interval = setInterval(() => {
        setRescuerOffset(prev => {
          const hyp = Math.sqrt(prev.dLat * prev.dLat + prev.dLng * prev.dLng);
          if (hyp <= 0.000015) { // within ~1.5m
            setTimeout(() => setIsAutoWalking(false), 0);
            return prev;
          }
          const stepRatio = 0.000012 / hyp; // ~1.3 meters per tick
          return {
            dLat: prev.dLat - prev.dLat * stepRatio,
            dLng: prev.dLng - prev.dLng * stepRatio
          };
        });
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutoWalking, setRescuerOffset]);

  // Live calculation variables for Node A (Victim) & Node B (Rescuer)
  const victimLat = Number(manualCoords.lat) || gpsState.lat || 19.0760;
  const victimLng = Number(manualCoords.lng) || gpsState.lng || 72.8777;
  const rescuerLat = victimLat + rescuerOffset.dLat;
  const rescuerLng = victimLng + rescuerOffset.dLng;

  // Effective Heading (either live hardware gyro heading or manual simulated heading)
  const effectiveHeading = isSimulatedHeading
    ? (Number(simulatedHeading) || 0)
    : (isGyroActive ? (Number(compassHeading) || 0) : 0);

  const isOrientationActive = isGyroActive || isSimulatedHeading;

  // Mathematical Distance (Haversine in meters)
  const liveDistance = calculateHaversine(rescuerLat, rescuerLng, victimLat, victimLng);
  // True Geographic Bearing (0° to 360° clockwise from True North)
  const liveBearing = calculateBearing(rescuerLat, rescuerLng, victimLat, victimLng);
  // Relative Bearing adjusted for device orientation (0° = straight ahead in direction user is facing)
  const relativeBearing = isOrientationActive
    ? (liveBearing - effectiveHeading + 360) % 360
    : liveBearing;

  // Estimated BLE RSSI in dBm
  const liveRSSI = calculateRSSI(liveDistance);
  // Cardinal Directions
  const targetCardinal = getCardinalDirection(liveBearing);
  const headingCardinal = getCardinalDirection(effectiveHeading);

  // SVG Coordinate Mapping (viewBox="0 0 250 250")
  const svgCenter = 125;
  const svgMaxRadius = 96;
  const currentScale = radarScale;

  // Clamp scaled radius to radar circle
  const scaledRadius = Math.min(svgMaxRadius, (liveDistance / currentScale) * svgMaxRadius);

  // In Head-Up mode: display angle = relativeBearing. In North-Up mode: display angle = liveBearing
  const displayPlotAngle = radarOrientationMode === 'HEAD_UP' ? relativeBearing : liveBearing;
  // Relative angle in radians (SVG 0 rad is East = 90 deg, so subtract 90 deg)
  const angleRad = ((displayPlotAngle - 90) * Math.PI) / 180;
  const victimX = svgCenter + scaledRadius * Math.cos(angleRad);
  const victimY = svgCenter + scaledRadius * Math.sin(angleRad);

  // Update motion trail and speed
  React.useEffect(() => {
    const diff = prevDistRef.current - liveDistance;
    prevDistRef.current = liveDistance;
    if (Math.abs(diff) > 0.05) {
      setClosingSpeed(Math.max(0, diff * 1.5));
    }
    setMotionTrail(prev => {
      const p = { x: victimX, y: victimY, dist: liveDistance, id: Date.now() };
      return [p, ...prev.slice(0, 4)];
    });
  }, [victimX, victimY, liveDistance]);

  // REAL-TIME TACTICAL TURN GUIDANCE (Shortest signed turn angle between heading and victim bearing)
  // Range: -180° (Turn Left) to +180° (Turn Right)
  const signedTurnAngle = ((liveBearing - effectiveHeading + 540) % 360) - 180;
  const absTurnAngle = Math.abs(signedTurnAngle);

  let navGuidance = {
    instruction: '🎯 TARGET DEAD AHEAD — PROCEED STRAIGHT',
    subtext: 'Bearing aligned with forward device heading (±8°)',
    colorClass: 'text-emerald-300 bg-emerald-950/90 border-emerald-500 shadow-emerald-950/60',
    arrowSymbol: '▲'
  };

  if (absTurnAngle <= 8) {
    navGuidance = {
      instruction: '🎯 TARGET DEAD AHEAD — PROCEED STRAIGHT',
      subtext: `Target aligned directly on heading ${effectiveHeading.toFixed(0)}° (${headingCardinal})`,
      colorClass: 'text-emerald-300 bg-emerald-950/90 border-emerald-500 shadow-emerald-950/60',
      arrowSymbol: '▲'
    };
  } else if (signedTurnAngle > 8 && signedTurnAngle < 165) {
    navGuidance = {
      instruction: `▶ TURN ${Math.round(signedTurnAngle)}° RIGHT TO FACE CASUALTY`,
      subtext: `Casualty is at True ${liveBearing.toFixed(0)}° (${targetCardinal}) • Rotate phone right`,
      colorClass: 'text-cyan-300 bg-cyan-950/90 border-cyan-500 shadow-cyan-950/60',
      arrowSymbol: '▶'
    };
  } else if (signedTurnAngle < -8 && signedTurnAngle > -165) {
    navGuidance = {
      instruction: `◀ TURN ${Math.round(absTurnAngle)}° LEFT TO FACE CASUALTY`,
      subtext: `Casualty is at True ${liveBearing.toFixed(0)}° (${targetCardinal}) • Rotate phone left`,
      colorClass: 'text-cyan-300 bg-cyan-950/90 border-cyan-500 shadow-cyan-950/60',
      arrowSymbol: '◀'
    };
  } else {
    navGuidance = {
      instruction: '▼ TARGET IS DIRECTLY BEHIND YOU — TURN AROUND 180°',
      subtext: `Casualty is in opposite direction (${liveBearing.toFixed(0)}° ${targetCardinal})`,
      colorClass: 'text-amber-300 bg-amber-950/90 border-amber-500 shadow-amber-950/60',
      arrowSymbol: '▼'
    };
  }

  // Anti-clipping box placement for target tag
  const isTagRightSide = victimX > 135;
  const isTagTopSide = victimY < 45;
  const tagBoxX = isTagRightSide ? -82 : 8;
  const tagBoxY = isTagTopSide ? 6 : -12;

  // Concentric Ring Radii in Pixels
  const ring5Px = (5 / currentScale) * svgMaxRadius;
  const ring15Px = (15 / currentScale) * svgMaxRadius;
  const ring30Px = (30 / currentScale) * svgMaxRadius;
  const ringMaxPx = svgMaxRadius;

  return (
    <div id="responder-mode-container" className="space-y-6">
      {/* 1. CENTRALIZED ADMIN PANEL SYNC STATUS */}
      <div
        id="admin-panel-sync-status"
        className="bg-gradient-to-r from-[#0d1728] via-[#0f1f38] to-[#0a1526] border-2 border-indigo-700/70 rounded-2xl p-5 shadow-2xl space-y-4"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-950/90 border border-indigo-600/80 text-indigo-400 shadow-md">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-white tracking-wide">
                  ADMINISTRATIVE CLOUD UPLINK &amp; DISPATCH PIPELINE
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono border flex items-center gap-1.5 ${
                  nodeCOnlineStatus
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-sm'
                    : 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                }`}>
                  {nodeCOnlineStatus ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  <span>{nodeCOnlineStatus ? '🟢 LINK ONLINE - Cloud Sync Active' : '🔴 LINK OFFLINE - Queued Locally'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Centralized gateway synchronization bridge routing packets from decentralized P2P mesh into governmental dispatch consoles.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap w-full md:w-auto">
            <button
              id="sync-packets-now-btn"
              onClick={() => syncPacketsToCloud(true)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-lg flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Push Packets to Cloud Now</span>
            </button>

            <button
              id="toggle-uplink-btn"
              onClick={toggleNodeCUplink}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                nodeCOnlineStatus
                  ? 'bg-red-950/80 hover:bg-red-900 border-red-700 text-red-300'
                  : 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-700 text-emerald-300'
              }`}
            >
              {nodeCOnlineStatus ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
              <span>{nodeCOnlineStatus ? 'Kill Internet (Simulate Outage)' : 'Restore Internet'}</span>
            </button>
          </div>
        </div>

        {/* Sync telemetry bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs font-mono text-slate-300">
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">PACKETS SYNCED TO CLOUD</span>
            <strong className="text-base text-emerald-400 font-bold">{metrics.packetsSynced} synced</strong>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">QUEUED IN GATEWAY BUFFER</span>
            <strong className="text-base text-indigo-400 font-bold">{nodes.nodeC.packets.length} queued</strong>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">CENTRAL REST ENDPOINT</span>
            <span className="text-[11px] text-cyan-300 truncate block">api.resq.gov/v1/sos_sync</span>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">GATEWAY HARDWARE NODE</span>
            <strong className="text-white text-[11px]">GATEWAY-B2 (Starlink/5G)</strong>
          </div>
        </div>
      </div>

      {/* 2. AREA CASUALTY & HAZARD OVERVIEW METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Trapped / Critical */}
        <div className="bg-[#12162a] border border-red-800/60 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-red-400">Trapped / Critical</span>
            <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {(victimAggregator?.trappedCount || 0) + (victimAggregator?.criticalCount || 0)}
          </div>
          <span className="text-[11px] text-red-300 font-medium">Immediate Extraction</span>
        </div>

        {/* Injured */}
        <div className="bg-[#12162a] border border-amber-800/60 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-amber-400">Injured Persons</span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {victimAggregator?.injuredCount || 0}
          </div>
          <span className="text-[11px] text-amber-300 font-medium">Medical Aid Required</span>
        </div>

        {/* Safe */}
        <div className="bg-[#12162a] border border-emerald-800/60 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-emerald-400">Safe / Accounted</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {victimAggregator?.safeCount || 0}
          </div>
          <span className="text-[11px] text-emerald-300 font-medium">Sheltered / Evacuated</span>
        </div>

        {/* Active Mesh Nodes */}
        <div className="bg-[#12162a] border border-indigo-800/60 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-indigo-400">Active Mesh Nodes</span>
            <Radio className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {Object.keys(detectedPeers).length + 3}
          </div>
          <div className="flex items-center justify-between text-[11px] text-indigo-300 pt-0.5">
            <span>DTN Topology</span>
            <button
              onClick={injectSimulatedCasualties}
              className="text-cyan-400 hover:underline font-bold"
            >
              + Influx
            </button>
          </div>
        </div>
      </div>

      {/* 3. TACTICAL PROXIMITY RADAR & TRIANGULATION SEARCH ENGINE */}
      <div className="bg-[#0e1628] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-400" />
                Tactical Proximity Radar &amp; Directional Sonar
              </h3>
              
              {/* Live Compass Telemetry Badge */}
              <div
                id="compass-telemetry-badge"
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition ${
                  isGyroActive
                    ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-emerald-950/50 shadow-md'
                    : isSimulatedHeading
                    ? 'bg-cyan-950/90 border-cyan-500 text-cyan-300 shadow-cyan-950/50 shadow-md'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
                title="Real-time orientation from device gyroscope & magnetometer"
              >
                <Compass className={`w-4 h-4 ${isGyroActive ? 'text-emerald-400 animate-spin-slow' : isSimulatedHeading ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>
                  🧭 Compass Heading: <strong>{effectiveHeading}° {headingCardinal}</strong>{' '}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ml-1 ${
                    isGyroActive ? 'bg-emerald-900/80 text-emerald-200' : isSimulatedHeading ? 'bg-cyan-900/80 text-cyan-200' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isGyroActive ? 'GYRO ACTIVE' : isSimulatedHeading ? 'SIMULATED' : 'NORTH-UP'}
                  </span>
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Live orientation-aware vector navigation with dynamic gyro compass rose &amp; distance-adaptive sonar ping.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* REAL-WORLD BLUETOOTH RSSI & DYNAMIC PROXIMITY BEEPER BUTTON */}
            <button
              id="responder-ble-scanner-btn"
              onClick={onOpenBleModal}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer shadow flex items-center gap-1.5 ${
                bleTelemetry?.connected
                  ? 'bg-blue-600 border-blue-400 text-white animate-pulse shadow-blue-900/50'
                  : 'bg-slate-900 hover:bg-slate-800 border-blue-600/70 text-blue-300'
              }`}
              title="Pair physical BLE hardware device to measure real RSSI and beep dynamically"
            >
              <Bluetooth className="w-4 h-4 text-blue-400" />
              <span>
                {bleTelemetry?.connected ? `BLE: ${bleTelemetry.distanceMeters.toFixed(1)}m` : '🔍 Real BLE Radar'}
              </span>
            </button>

            {/* DIRECT P2P PHONE-TO-PHONE PAIRING BUTTON */}
            <button
              id="responder-p2p-pairing-btn"
              onClick={onOpenP2PModal}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer shadow flex items-center gap-1.5 ${
                p2pConnectionState === 'CONNECTED'
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-900/50'
                  : 'bg-slate-900 hover:bg-slate-800 border-emerald-600/70 text-emerald-300'
              }`}
              title="Pair physical responder phone offline via QR or Sound Modem"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>{p2pConnectionState === 'CONNECTED' ? 'P2P Online' : '📡 Offline P2P Link'}</span>
            </button>

            {/* COMPASS CALIBRATION BUTTON (FIGURE-8) */}
            <button
              id="calibrate-compass-btn"
              onClick={calibrateCompass}
              className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition cursor-pointer shadow flex items-center gap-1.5"
              title="Calibrate compass sensors by rotating phone in a figure-8 pattern"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>♾️ Calibrate Compass (Figure-8)</span>
            </button>

            {/* iOS GYROSCOPE PERMISSION REQUEST BUTTON */}
            {gyroPermissionState !== 'granted' && (
              <button
                id="request-gyro-btn"
                onClick={requestGyroPermission}
                className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold border border-indigo-500 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 transition cursor-pointer shadow flex items-center gap-1.5"
                title="Request device orientation sensor permissions (iOS / Safari)"
              >
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span>Enable Gyroscope</span>
              </button>
            )}

            {/* DESKTOP SIMULATOR TOGGLE */}
            <button
              id="toggle-gyro-sim-btn"
              onClick={() => {
                setShowGyroSimulator(prev => !prev);
                if (!showGyroSimulator) {
                  setIsSimulatedHeading(true);
                }
              }}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer shadow flex items-center gap-1.5 ${
                showGyroSimulator || isSimulatedHeading
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle manual heading rotation slider for desktop browser testing"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showGyroSimulator ? 'Hide Gyro Dial' : '🎛️ Desktop Gyro Dial'}</span>
            </button>

            {/* 3. ULTRASONIC / ACOUSTIC PULSE PROXIMITY SIGNAL (GPS-DENIED MODE) */}
            <button
              id="emit-acoustic-pulse-btn"
              onClick={emitAcousticPulse}
              disabled={isAcousticPulseEmitting}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer shadow-lg flex items-center gap-2 ${
                isAcousticPulseEmitting
                  ? 'bg-amber-600 border-amber-400 text-white animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white shadow-indigo-950/50'
              }`}
              title="Emit 2000Hz frequency sweep pulse to localize victims under rubble/GPS-denied locations"
            >
              <Waves className={`w-4 h-4 ${isAcousticPulseEmitting ? 'animate-spin text-amber-200' : 'text-indigo-200'}`} />
              <span>{isAcousticPulseEmitting ? '🔊 Emitting 2000Hz FM Sweep...' : '🔊 Emit Acoustic Pulse (GPS-Denied Mode)'}</span>
            </button>

            {/* FLOATING MUTE / UNMUTE BEEP BUTTON */}
            <button
              id="toggle-radar-audio-btn"
              onClick={toggleRadarAudioMute}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer shadow-lg flex items-center gap-2 ${
                isRadarMuted
                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white animate-pulse'
              }`}
            >
              {isRadarMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-white" />}
              <span>{isRadarMuted ? 'Proximity Beep MUTED' : 'Proximity Beep ACTIVE'}</span>
            </button>

            {/* Radar scale selector */}
            <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-mono">
              {[30, 45, 60].map(s => (
                <button
                  key={s}
                  onClick={() => setRadarScale(s)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-bold ${
                    radarScale === s ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* DESKTOP GYROSCOPE SIMULATION CONTROLLER (COLLAPSIBLE / TOGGLEABLE) */}
        {(showGyroSimulator || isSimulatedHeading) && (
          <div className="bg-slate-950/90 border border-cyan-800/60 rounded-xl p-4 shadow-lg space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Desktop Gyroscope Orientation Simulator (Rotate Rescuer Body):
              </span>
              <div className="flex items-center gap-3">
                <span className="text-white font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-700">
                  {effectiveHeading}° {headingCardinal}
                </span>
                {isSimulatedHeading && (
                  <button
                    onClick={() => {
                      setIsSimulatedHeading(false);
                      setShowGyroSimulator(false);
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    Reset to Hardware
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400 font-mono">0°</span>
              <input
                id="gyro-heading-slider"
                type="range"
                min="0"
                max="359"
                step="1"
                value={effectiveHeading}
                onChange={(e) => {
                  setSimulatedHeading(parseInt(e.target.value, 10));
                  setIsSimulatedHeading(true);
                }}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="text-[11px] text-slate-400 font-mono">359°</span>
            </div>

            {/* Quick Cardinal Preset Buttons */}
            <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
              <span className="text-slate-400 text-[11px]">Quick Angles:</span>
              {[
                { label: 'North (0°)', deg: 0 },
                { label: 'East (90°)', deg: 90 },
                { label: 'South (180°)', deg: 180 },
                { label: 'West (270°)', deg: 270 },
                { label: `🎯 Lock to Victim (${Math.round(liveBearing)}°)`, deg: Math.round(liveBearing) }
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => {
                    setSimulatedHeading(p.deg);
                    setIsSimulatedHeading(true);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    effectiveHeading === p.deg
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TACTICAL NAVIGATION GUIDANCE HUD BANNER */}
        <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs font-mono shadow-xl transition-all ${navGuidance.colorClass}`}>
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-black/40 flex items-center justify-center text-base font-black shrink-0 animate-pulse">
              {navGuidance.arrowSymbol}
            </span>
            <div>
              <div className="font-extrabold text-white text-xs sm:text-sm tracking-wide">
                {navGuidance.instruction}
              </div>
              <div className="text-[11px] opacity-90 font-normal text-slate-300">
                {navGuidance.subtext}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0 hidden sm:block">
            <div className="text-[10px] text-slate-300 uppercase tracking-wider font-bold">Target Vector</div>
            <div className="text-xs font-black text-white">
              {liveBearing.toFixed(0)}° {targetCardinal} ({liveDistance.toFixed(1)}m)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* REAL-TIME ORIENTATION-AWARE SVG RADAR SCREEN */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center p-4 bg-slate-950/90 rounded-2xl border border-slate-800 relative overflow-hidden">
            
            {/* Reticle Forward Heading Header & Orientation Mode Switcher */}
            <div className="w-full flex items-center justify-between text-[11px] font-mono mb-2 text-slate-400 px-1 gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className={`flex items-center gap-1 font-bold ${radarOrientationMode === 'HEAD_UP' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                  {radarOrientationMode === 'HEAD_UP'
                    ? `▲ FORWARD HEADING: ${effectiveHeading.toFixed(0)}° (${headingCardinal})`
                    : `▲ TRUE NORTH (0° N) • Heading: ${effectiveHeading.toFixed(0)}°`}
                </span>
              </div>
              
              {/* Head-Up vs North-Up Toggle */}
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 text-[10px]">
                <button
                  id="radar-mode-headup-btn"
                  onClick={() => setRadarOrientationMode('HEAD_UP')}
                  className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                    radarOrientationMode === 'HEAD_UP'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Head-Up / Track-Up: Forward direction of phone is always at the top of the radar"
                >
                  🧭 Head-Up
                </button>
                <button
                  id="radar-mode-northup-btn"
                  onClick={() => setRadarOrientationMode('NORTH_UP')}
                  className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                    radarOrientationMode === 'NORTH_UP'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="North-Up: True North is locked at the top of the radar"
                >
                  🌐 North-Up
                </button>
              </div>
            </div>

            <svg
              id="proximity-radar-svg"
              viewBox="0 0 250 250"
              className="w-full max-w-[280px] sm:max-w-[320px] aspect-square"
            >
              <defs>
                <radialGradient id="radarGridGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#047857" stopOpacity="0.35" />
                  <stop offset="70%" stopColor="#064e3b" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#022c22" stopOpacity="0.06" />
                </radialGradient>
                <linearGradient id="sweepBeam" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="rescuerFovGlow" cx="50%" cy="100%" r="100%">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.6" />
                  <stop offset="80%" stopColor="#3b82f6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Background Radar Circle */}
              <circle cx={svgCenter} cy={svgCenter} r={ringMaxPx} fill="url(#radarGridGlow)" stroke="#065f46" strokeWidth="2" />

              {/* Concentric Distance Range Rings */}
              {ring5Px > 0 && <circle cx={svgCenter} cy={svgCenter} r={ring5Px} fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />}
              {ring15Px > 0 && <circle cx={svgCenter} cy={svgCenter} r={ring15Px} fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />}
              {ring30Px > 0 && <circle cx={svgCenter} cy={svgCenter} r={ring30Px} fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />}

              {/* Fixed Screen Axes Crosshairs */}
              <line x1={svgCenter} y1="20" x2={svgCenter} y2="230" stroke="#047857" strokeWidth="1" opacity="0.5" strokeDasharray="2 2" />
              <line x1="20" y1={svgCenter} x2="230" y2={svgCenter} stroke="#047857" strokeWidth="1" opacity="0.5" strokeDasharray="2 2" />

              {/* DYNAMIC COMPASS ROSE (Rotates by -effectiveHeading in Head-Up, Fixed 0° in North-Up) */}
              <g
                id="gyro-compass-rose-group"
                transform={`rotate(${radarOrientationMode === 'HEAD_UP' ? -effectiveHeading : 0}, ${svgCenter}, ${svgCenter})`}
                style={{ transition: 'transform 0.08s ease-out' }}
              >
                {/* Outer Azimuth Degree Ticks */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
                  const rad = ((deg - 90) * Math.PI) / 180;
                  const isCardinal = deg % 90 === 0;
                  const tickLength = isCardinal ? 8 : 4;
                  const x1 = svgCenter + (svgMaxRadius - tickLength) * Math.cos(rad);
                  const y1 = svgCenter + (svgMaxRadius - tickLength) * Math.sin(rad);
                  const x2 = svgCenter + svgMaxRadius * Math.cos(rad);
                  const y2 = svgCenter + svgMaxRadius * Math.sin(rad);
                  return (
                    <line
                      key={deg}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={deg === 0 ? '#ef4444' : isCardinal ? '#10b981' : '#059669'}
                      strokeWidth={isCardinal ? '2' : '1'}
                      opacity="0.85"
                    />
                  );
                })}

                {/* Cardinal Point Labels on Compass Dial */}
                {/* North: with Red Indicator Triangle & Label */}
                <polygon points={`${svgCenter},20 ${svgCenter - 4},27 ${svgCenter + 4},27`} fill="#ef4444" />
                <text x={svgCenter} y="15" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="extrabold" fontFamily="sans-serif">
                  N
                </text>
                
                {/* East (90°) */}
                <text x="240" y={svgCenter + 3.5} textAnchor="end" fill="#64748b" fontSize="9" fontWeight="bold" fontFamily="sans-serif">
                  E
                </text>
                
                {/* South (180°) */}
                <text x={svgCenter} y="244" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="bold" fontFamily="sans-serif">
                  S
                </text>
                
                {/* West (270°) */}
                <text x="10" y={svgCenter + 3.5} textAnchor="start" fill="#64748b" fontSize="9" fontWeight="bold" fontFamily="sans-serif">
                  W
                </text>

                {/* Ordinals */}
                <text x="207" y="47" textAnchor="middle" fill="#047857" fontSize="7" fontWeight="bold">NE</text>
                <text x="207" y="210" textAnchor="middle" fill="#047857" fontSize="7" fontWeight="bold">SE</text>
                <text x="43" y="210" textAnchor="middle" fill="#047857" fontSize="7" fontWeight="bold">SW</text>
                <text x="43" y="47" textAnchor="middle" fill="#047857" fontSize="7" fontWeight="bold">NW</text>
              </g>

              {/* Fixed Top Reticle Pointer */}
              <polygon points={`${svgCenter},6 ${svgCenter - 5},14 ${svgCenter + 5},14`} fill={radarOrientationMode === 'HEAD_UP' ? '#10b981' : '#6366f1'} />

              {/* Rescuer Field of View Cone */}
              {/* In Head-Up: Points Straight Up (0°). In North-Up: Rotates with rescuer heading (+effectiveHeading) */}
              <g transform={`rotate(${radarOrientationMode === 'NORTH_UP' ? effectiveHeading : 0}, ${svgCenter}, ${svgCenter})`}>
                <path
                  d={`M ${svgCenter},${svgCenter} L ${svgCenter - 42},${svgCenter - 75} A 85 85 0 0 1 ${svgCenter + 42},${svgCenter - 75} Z`}
                  fill="url(#rescuerFovGlow)"
                  opacity="0.4"
                />
              </g>

              {/* Rotating Green Radar Sweep Scanning Line */}
              <g className="animate-[spin_4s_linear_infinite]" style={{ transformOrigin: '125px 125px' }}>
                <line x1={svgCenter} y1={svgCenter} x2={svgCenter} y2={svgCenter - ringMaxPx} stroke="#34d399" strokeWidth="2" opacity="0.8" />
              </g>

              {/* Motion History Trail (Ghost blips showing movement trajectory as object comes closer) */}
              {motionTrail.map((pt, idx) => {
                const opacity = Math.max(0.15, 0.65 - idx * 0.15);
                const r = Math.max(2, 4.5 - idx * 0.8);
                return (
                  <circle
                    key={`trail-${pt.id}-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={r}
                    fill="#ef4444"
                    opacity={opacity}
                  />
                );
              })}

              {/* Dashed Target Vector Line from Rescuer to Target */}
              <line
                x1={svgCenter}
                y1={svgCenter}
                x2={victimX}
                y2={victimY}
                stroke={liveDistance <= 2.0 ? '#ef4444' : liveDistance <= 6.0 ? '#f59e0b' : '#38bdf8'}
                strokeWidth={liveDistance <= 2.0 ? '2.5' : '1.5'}
                strokeDasharray={liveDistance <= 2.0 ? 'none' : '3 3'}
                opacity="0.8"
              />

              {/* Secondary Discovered Mesh Peer Blips (Over BroadcastChannel / BLE) */}
              {Object.values(detectedPeers || {}).map((peer) => {
                if (!peer.lat || !peer.lng) return null;
                const pDist = calculateHaversine(rescuerLat, rescuerLng, peer.lat, peer.lng);
                const pBearing = calculateBearing(rescuerLat, rescuerLng, peer.lat, peer.lng);
                const pRelBearing = isOrientationActive ? (pBearing - effectiveHeading + 360) % 360 : pBearing;
                const pPlotAngle = radarOrientationMode === 'HEAD_UP' ? pRelBearing : pBearing;
                const pRad = ((pPlotAngle - 90) * Math.PI) / 180;
                const pScaledR = Math.min(svgMaxRadius, (pDist / currentScale) * svgMaxRadius);
                const px = svgCenter + pScaledR * Math.cos(pRad);
                const py = svgCenter + pScaledR * Math.sin(pRad);
                const isVeryClose = pDist <= 5.0;

                return (
                  <g key={`mesh-peer-${peer.id}`} transform={`translate(${px}, ${py})`}>
                    <circle r={isVeryClose ? 6 : 4} fill={isVeryClose ? '#ef4444' : '#06b6d4'} stroke="#ffffff" strokeWidth="1.2" opacity="0.95">
                      {isVeryClose && <animate attributeName="r" values="5;10;5" dur="0.8s" repeatCount="indefinite" />}
                    </circle>
                    <text x="7" y="3" fill="#38bdf8" fontSize="6.5" fontWeight="bold" fontFamily="monospace">
                      {peer.id ? peer.id.substring(0, 8) : 'PEER'} ({pDist.toFixed(1)}m)
                    </text>
                  </g>
                );
              })}

              {/* Secondary Multi-Victim Casualty Blips (if any exist in incident command) */}
              {(victimAggregator?.victims || victimAggregator?.victimsList || []).filter(v => v && v.uuid !== nodes?.nodeA?.uuid).map((v) => {
                const vDist = calculateHaversine(rescuerLat, rescuerLng, v.lat, v.lng);
                const vBearing = calculateBearing(rescuerLat, rescuerLng, v.lat, v.lng);
                const vRelBearing = isOrientationActive ? (vBearing - effectiveHeading + 360) % 360 : vBearing;
                const vPlotAngle = radarOrientationMode === 'HEAD_UP' ? vRelBearing : vBearing;
                const vRad = ((vPlotAngle - 90) * Math.PI) / 180;
                const vScaledR = Math.min(svgMaxRadius, (vDist / currentScale) * svgMaxRadius);
                const vx = svgCenter + vScaledR * Math.cos(vRad);
                const vy = svgCenter + vScaledR * Math.sin(vRad);
                const vColor = v.status === 'SAFE' ? '#10b981' : v.isCritical ? '#ef4444' : '#f59e0b';
                
                return (
                  <g key={v.uuid || v.id} transform={`translate(${vx}, ${vy})`}>
                    <circle r="4" fill={vColor} stroke="#ffffff" strokeWidth="1" opacity="0.9" />
                    <text x="6" y="3" fill="#cbd5e1" fontSize="6" fontFamily="monospace">
                      {v.callsign ? v.callsign.substring(0, 7) : 'PEER'}
                    </text>
                  </g>
                );
              })}

              {/* Primary Target Dot: Node A (Victim - Live Target) */}
              <g transform={`translate(${victimX}, ${victimY})`} id="target-victim-blip">
                {/* Dynamic Doppler / Proximity Lock-On Reticle */}
                {liveDistance <= 2.0 ? (
                  <g className="animate-spin" style={{ transformOrigin: '0px 0px', animationDuration: '3s' }}>
                    <circle r="18" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="6 4" opacity="0.9" />
                    <polygon points="0,-22 4,-16 -4,-16" fill="#ef4444" />
                    <polygon points="22,0 16,4 16,-4" fill="#ef4444" />
                    <polygon points="0,22 4,16 -4,16" fill="#ef4444" />
                    <polygon points="-22,0 -16,4 -16,-4" fill="#ef4444" />
                  </g>
                ) : (
                  <circle r="14" fill="none" stroke={liveDistance <= 6.0 ? '#f59e0b' : '#ef4444'} strokeWidth="1.5" opacity="0.85">
                    <animate attributeName="r" values="5;22" dur={liveDistance <= 5.0 ? '0.6s' : '1.2s'} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0" dur={liveDistance <= 5.0 ? '0.6s' : '1.2s'} repeatCount="indefinite" />
                  </circle>
                )}
                
                <circle
                  r={liveDistance <= 2.0 ? '7' : '5.5'}
                  fill={liveDistance <= 2.0 ? '#ef4444' : liveDistance <= 6.0 ? '#f59e0b' : '#ef4444'}
                  stroke="#ffffff"
                  strokeWidth="1.8"
                />
                
                {/* Anti-clipping Dynamic Callout Box */}
                <rect x={tagBoxX} y={tagBoxY} width="78" height="24" rx="4" fill="#0f172a" fillOpacity="0.95" stroke={liveDistance <= 2.0 ? '#ef4444' : '#38bdf8'} strokeWidth="1" />
                <text x={tagBoxX + 4} y={tagBoxY + 10} fill="#ffffff" fontSize="7.5" fontWeight="extrabold" fontFamily="monospace">
                  {liveDistance <= 2.0 ? '🎯 LOCK-ON' : 'Victim'} ({liveDistance.toFixed(1)}m)
                </text>
                <text x={tagBoxX + 4} y={tagBoxY + 18} fill="#93c5fd" fontSize="6.5" fontFamily="monospace">
                  {targetCardinal} ({liveBearing.toFixed(0)}°) • {liveRSSI}dBm
                </text>
              </g>

              {/* Center Dot: Rescuer (Node B) with Directional Arrow */}
              {/* In Head-Up: Arrow points Straight UP. In North-Up: Arrow rotates with heading */}
              <g transform={`rotate(${radarOrientationMode === 'NORTH_UP' ? effectiveHeading : 0}, ${svgCenter}, ${svgCenter})`}>
                <circle cx={svgCenter} cy={svgCenter} r="7" fill="#4f46e5" stroke="#ffffff" strokeWidth="2" />
                <polygon points={`${svgCenter},${svgCenter - 5} ${svgCenter - 3.5},${svgCenter + 3} ${svgCenter + 3.5},${svgCenter + 3}`} fill="#ffffff" />
              </g>
            </svg>

            {/* Radar Telemetry Footer with Live Approach Speed */}
            <div className="w-full mt-3 pt-2.5 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between flex-wrap gap-2">
              <span>Dist: <strong className={liveDistance <= 2.0 ? 'text-red-400 font-extrabold animate-pulse' : liveDistance <= 6.0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>{liveDistance.toFixed(1)}m</strong></span>
              <span>Bearing: <strong className="text-cyan-400 font-bold">{liveBearing.toFixed(0)}° {targetCardinal}</strong></span>
              <span>Speed: <strong className="text-amber-300 font-bold">{closingSpeed > 0 ? `${closingSpeed.toFixed(1)} m/s` : 'Stationary'}</strong></span>
              <span>RSSI: <strong className="text-amber-400 font-bold">{liveRSSI} dBm</strong></span>
            </div>
          </div>

          {/* Interactive Controls & Directional Pad */}
          <div className="lg:col-span-6 space-y-4">
            {/* Live Distance Slider & Real-Time Walk Simulator */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  Proximity Distance Tracker:
                </span>
                <span className="font-mono text-emerald-400 font-bold">{liveDistance.toFixed(1)} meters</span>
              </div>
              <input
                type="range"
                min="1.0"
                max={radarScale}
                step="0.5"
                value={Math.min(radarScale, Math.max(1.0, liveDistance))}
                onChange={(e) => setSliderDistance(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => stepCloserToVictim(3.0)}
                  className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Step Closer (-3.0m)
                </button>
                <button
                  onClick={() => stepAwayFromVictim(3.0)}
                  className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Step Away (+3.0m)
                </button>
              </div>

              {/* Real-time Continuous Approach Walk Button */}
              <button
                onClick={() => {
                  if (liveDistance <= 2.0 && !isAutoWalking) {
                    setRescuerOffset({ dLat: -0.00022, dLng: -0.00018 }); // reset to ~30m
                  }
                  setIsAutoWalking(prev => !prev);
                }}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer border ${
                  isAutoWalking
                    ? 'bg-amber-600 text-white border-amber-400 animate-pulse'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-600 hover:bg-emerald-900'
                }`}
              >
                <span>{isAutoWalking ? '⏸ Pause Continuous Approach Walk' : '🚶 Simulate Real-Time Walk to Target (Test Radar & Acoustic Beep)'}</span>
              </button>
            </div>

            {/* D-Pad Rescuer Motion with exact geographic coordinates */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-center space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">Move Rescuer Position:</span>
                <span className="font-mono text-cyan-400 text-[11px]">
                  {(rescuerOffset.dLat * 111320).toFixed(1)}m N, {(rescuerOffset.dLng * 111320 * Math.cos(19.076 * Math.PI / 180)).toFixed(1)}m E
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => moveRescuerDelta(4, 0)}
                  className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 active:scale-95 transition cursor-pointer"
                  title="Move Rescuer 4m North (Increases latitude)"
                >
                  ▲ North (+4m)
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveRescuerDelta(0, -4)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 active:scale-95 transition cursor-pointer"
                    title="Move Rescuer 4m West (Decreases longitude)"
                  >
                    ◀ West (-4m)
                  </button>
                  <button
                    onClick={() => setRescuerOffset({ dLat: -0.00016, dLng: -0.00012 })}
                    className="p-2 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 active:scale-95 transition cursor-pointer"
                    title="Reset Rescuer position to ~22m Southwest of Victim"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveRescuerDelta(0, 4)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 active:scale-95 transition cursor-pointer"
                    title="Move Rescuer 4m East (Increases longitude)"
                  >
                    East (+4m) ▶
                  </button>
                </div>
                <button
                  onClick={() => moveRescuerDelta(-4, 0)}
                  className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 active:scale-95 transition cursor-pointer"
                  title="Move Rescuer 4m South (Decreases latitude)"
                >
                  ▼ South (-4m)
                </button>
              </div>
            </div>

            {/* Open in OSM Button */}
            <a
              href={`https://www.openstreetmap.org/?mlat=${victimLat}&mlon=${victimLng}#map=18/${victimLat}/${victimLng}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>Open Target in OpenStreetMap</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>
      </div>

      {/* 4. INTERACTIVE COMPASS CALIBRATION MODAL (FIGURE-8 ANIMATION) */}
      {isCalibrating && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border-2 border-cyan-500 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-center gap-2 text-cyan-400">
              <Compass className="w-7 h-7 animate-spin" />
              <h3 className="text-xl font-black text-white tracking-wide">Calibrate Compass</h3>
            </div>

            <p className="text-xs text-slate-300">
              Rotate your phone slowly in a horizontal <strong>Figure-8 infinity motion</strong> to normalize magnetometer and gyro sensor bias.
            </p>

            {/* Animated Figure-8 Infinity Path */}
            <div className="flex justify-center my-4 py-2">
              <svg width="180" height="90" viewBox="0 0 180 90" className="overflow-visible">
                <defs>
                  <linearGradient id="fig8Grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                {/* Figure-8 Infinity Path */}
                <path
                  id="fig8Path"
                  d="M 90,45 C 55,5 15,5 15,45 C 15,85 55,85 90,45 C 125,5 165,5 165,45 C 165,85 125,85 90,45 Z"
                  fill="none"
                  stroke="url(#fig8Grad)"
                  strokeWidth="4"
                  strokeDasharray="6 4"
                  className="animate-pulse"
                />
                {/* Traveling orb representing phone motion */}
                <circle r="8" fill="#38bdf8" stroke="#ffffff" strokeWidth="2">
                  <animateMotion
                    path="M 90,45 C 55,5 15,5 15,45 C 15,85 55,85 90,45 C 125,5 165,5 165,45 C 165,85 125,85 90,45 Z"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-cyan-300">
                <span>Sensor Calibration Progress:</span>
                <span>{calibrationProgress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-100"
                  style={{ width: `${calibrationProgress}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              Normalizing Magnetometer Zero-Bias Drift &amp; Sensor Accel Matrix...
            </div>
          </div>
        </div>
      )}

      {/* 4. SIMPLIFIED VICTIM ROSTER & TRIAGE MANAGER */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Casualty Triage Roster &amp; Field Manifest
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Active victims detected over Delay-Tolerant mesh packets. Responders can mark individuals rescued and safe.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            {['ALL', 'CRITICAL', 'INJURED', 'SAFE'].map(f => (
              <button
                key={f}
                onClick={() => setRosterFilter(f)}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  rosterFilter === f
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Victims list */}
        <div className="space-y-3">
          {(victimAggregator?.victims || victimAggregator?.victimsList || [])
            .filter(v => {
              if (!v) return false;
              if (rosterFilter === 'CRITICAL') return v.status === 'TRAPPED' || v.isCritical;
              if (rosterFilter === 'INJURED') return v.status === 'INJURED';
              if (rosterFilter === 'SAFE') return v.status === 'SAFE';
              return true;
            })
            .map(v => {
              const isTrap = v.status === 'TRAPPED';
              const isInj = v.status === 'INJURED';
              const isSafe = v.status === 'SAFE';

              return (
                <div
                  key={v.id}
                  className={`p-4 rounded-xl border transition shadow flex flex-col md:flex-row md:items-center justify-between gap-3.5 ${
                    isTrap
                      ? 'bg-red-950/30 border-red-900/70 hover:border-red-600'
                      : isInj
                      ? 'bg-amber-950/30 border-amber-900/70 hover:border-amber-600'
                      : 'bg-emerald-950/20 border-emerald-900/60 hover:border-emerald-600'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-white font-mono">{v.callsign}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                        isTrap
                          ? 'bg-red-950 text-red-300 border border-red-700 animate-pulse'
                          : isInj
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      }`}>
                        {v.rawStatus || v.status}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                        Batt: {v.battery}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
                      <strong className="text-slate-400">Medical:</strong>
                      <span className="text-slate-200">{v.medical}</span>
                    </div>

                    {v.voiceNote && (
                      <div className="bg-slate-950/90 px-2.5 py-1 rounded-md border border-amber-500/40 text-amber-300 text-[11px] font-mono flex items-center gap-1.5">
                        <Mic className="w-3 h-3 text-amber-400 shrink-0" />
                        <span><strong>Voice Note:</strong> {v.voiceNote}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono flex-wrap">
                      <span className="flex items-center gap-1 text-cyan-300">
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        {Number(v.lat).toFixed(5)}, {Number(v.lng).toFixed(5)} (±{v.accuracy}m)
                      </span>
                      <span className="flex items-center gap-1 text-amber-300">
                        <Signal className="w-3 h-3 text-amber-400" />
                        RSSI: {v.rssi} dBm
                      </span>
                      <span className="flex items-center gap-1 text-indigo-300">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        {formatTimeSince(v.timestamp)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {!isSafe && (
                      <button
                        onClick={() => markVictimSafe(v.id)}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Mark Safe</span>
                      </button>
                    )}
                    <button
                      onClick={() => copyText(`${v.lat}, ${v.lng}`, `roster-${v.id}`)}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1 border border-slate-700"
                    >
                      {copiedKey === `roster-${v.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 5. ADMIN / CLOUD DISPATCH CONSOLE (LIVE INCIDENT STREAM) */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400" />
              RECEIVED AT DISPATCH CENTER (LIVE INCIDENT STREAM)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Centralized governmental emergency dispatch ledger receiving telemetry bursts from Gateway Node C.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono text-xs font-bold">
            {dispatchLedger.length} Incidents Synchronized
          </span>
        </div>

        {dispatchLedger.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Feed Column */}
            <div className="space-y-3 lg:col-span-1 max-h-[480px] overflow-y-auto scrollbar-thin pr-1">
              {dispatchLedger.map((inc) => (
                <div
                  key={inc.uuid}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    selectedIncident?.uuid === inc.uuid
                      ? 'bg-slate-800/95 border-emerald-500 shadow-md'
                      : 'bg-slate-900/70 border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-xs text-red-400">{inc.uuid}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {inc.isDispatched ? 'DISPATCHED' : 'PENDING SQUAD'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono space-y-1">
                    <div>Coords: {inc.lat.toFixed(5)}, {inc.lng.toFixed(5)}</div>
                    <div>Gateway: <strong className="text-indigo-400">Node C</strong> • {inc.hops} hops</div>
                    <div className="text-[11px] text-emerald-400">Route: SYNC_TO_CLOUD: SUCCESS</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Incident Details & OSM Iframe */}
            <div className="lg:col-span-2 space-y-4">
              {selectedIncident && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="font-bold text-white text-base">Incident Command Geolocation</h4>
                      <p className="text-xs text-slate-400 font-mono">
                        Lat: {selectedIncident.lat.toFixed(6)}, Lng: {selectedIncident.lng.toFixed(6)} (Accuracy: ±{selectedIncident.accuracy}m)
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => markIncidentDispatched(selectedIncident.uuid)}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                          selectedIncident.isDispatched
                            ? 'bg-emerald-950 border border-emerald-600 text-emerald-300'
                            : 'bg-red-600 hover:bg-red-500 text-white shadow'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{selectedIncident.isDispatched ? 'Dispatched (Squad Assigned)' : 'Mark Dispatched'}</span>
                      </button>

                      <a
                        href={selectedIncident.osmLink}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1"
                      >
                        <span>Open in OSM</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Tactical GIS Geolocation Vector Map Display */}
                  <div className="relative w-full h-72 rounded-xl overflow-hidden border border-slate-700 bg-[#070d18] flex items-center justify-center select-none shadow-inner">
                    {/* Tactical Coordinate Grid Overlay */}
                    <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="tactical-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="2 2" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#tactical-grid-pattern)" />
                    </svg>

                    {/* Concentric Radar / Accuracy Halos */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-56 h-56 rounded-full border border-cyan-500/20 animate-pulse" />
                      <div className="w-40 h-40 rounded-full border border-cyan-500/30 absolute" />
                      <div className="w-24 h-24 rounded-full border border-red-500/40 bg-red-500/5 absolute" />
                      {/* Crosshairs */}
                      <div className="absolute w-full h-[1px] bg-cyan-500/20" />
                      <div className="absolute h-full w-[1px] bg-cyan-500/20" />
                    </div>

                    {/* Target Distress Location Beacon Pin */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="relative flex items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-red-400 opacity-75" />
                        <div className="relative w-9 h-9 rounded-full bg-red-600 border-2 border-white flex items-center justify-center shadow-lg shadow-red-950/80">
                          <AlertTriangle className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div className="mt-2 bg-slate-900/90 backdrop-blur-sm px-3 py-1 rounded-lg border border-red-500/50 shadow-md text-center">
                        <div className="text-[11px] font-mono font-bold text-red-400 tracking-wider">
                          TARGET LOCK: {selectedIncident.uuid.slice(0, 12)}...
                        </div>
                        <div className="text-[10px] text-slate-300 font-mono">
                          {selectedIncident.lat.toFixed(6)}° N, {selectedIncident.lng.toFixed(6)}° E (±{selectedIncident.accuracy}m)
                        </div>
                      </div>
                    </div>

                    {/* GIS Coordinates & Scale HUD */}
                    <div className="absolute top-2.5 left-3 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-md border border-slate-700/80 text-[10px] font-mono text-cyan-300">
                      GRID: WGS84 • ZOOM: 18x TACTICAL
                    </div>

                    <div className="absolute bottom-2.5 right-3 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-md border border-slate-700/80 text-[10px] font-mono text-slate-400">
                      ELEVATION: {selectedIncident.altitude ? `${selectedIncident.altitude.toFixed(1)}m MSL` : 'GROUND LEVEL'}
                    </div>
                  </div>

                  {/* Incident Verification Details */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono space-y-1.5 text-slate-300">
                    <div>UUID: <strong className="text-white">{selectedIncident.uuid}</strong></div>
                    <div>Medical Notes: <strong className="text-amber-400">{selectedIncident.medical || 'None'}</strong></div>
                    {selectedIncident.voiceNote && (
                      <div className="text-amber-300 flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Voice Telemetry: <strong>"{selectedIncident.voiceNote}"</strong></span>
                      </div>
                    )}
                    <div>Synced Timestamp: <span className="text-emerald-400">{selectedIncident.syncedAt}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3 bg-slate-900/40 rounded-xl border border-slate-800">
            <Globe className="w-10 h-10 text-slate-600 mx-auto" />
            <h4 className="font-bold text-white text-base">No Incidents Synced to Cloud Dispatch Center</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Distress beacons forwarded to Dummy Gateway Beta (Node C) will automatically sync to this administrative stream.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
