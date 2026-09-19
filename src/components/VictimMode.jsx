import React from 'react';
import {
  AlertTriangle,
  Flame,
  Volume2,
  VolumeX,
  Battery,
  BatteryCharging,
  Satellite,
  Send,
  Sliders,
  CheckCircle2,
  Radio,
  Copy,
  Check,
  Zap,
  Phone,
  Heart,
  FileText,
  Mic,
  MicOff,
  Flashlight,
  Sparkles,
  Activity,
  Bluetooth,
  QrCode
} from 'lucide-react';

export default function VictimMode({
  nodes,
  setNodes,
  gpsState,
  setGpsState,
  manualCoords,
  setManualCoords,
  holdProgress,
  isHolding,
  startHoldTimer,
  cancelHoldTimer,
  isBeaconActive,
  setIsBeaconActive,
  morseFlash,
  morseInfo,
  isVoiceSosListening,
  voiceTranscript,
  voiceDetectedKeyword,
  voiceSosSupported,
  toggleVoiceSos,
  simulateVoiceKeyword,
  isSirenPlaying,
  toggleSirenTone,
  forwardAtoB,
  simulateFullPulse,
  userProfile,
  setUserProfile,
  batteryAlertBanner,
  setBatteryAlertBanner,
  addLog,
  copiedKey,
  copyText,
  onOpenBleModal,
  onOpenP2PModal,
  bleTelemetry,
  p2pConnectionState
}) {
  const currentPacket = nodes.nodeA.packets?.[0];
  const isEmergencyActive = nodes.nodeA.packets.length > 0;

  return (
    <div id="victim-mode-container" className="space-y-6 max-w-4xl mx-auto">
      {/* CRITICAL BATTERY EMERGENCY DISPATCH (<5%) RED ALERT BANNER */}
      {batteryAlertBanner && (
        <div
          id="critical-battery-alert-banner"
          className="bg-red-950/95 border-2 border-red-500 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-red-900/60 text-red-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-red-600 text-white shadow-lg shrink-0 mt-0.5">
              <Flame className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base tracking-wide text-white">
                  ⚠️ CRITICAL BATTERY EMERGENCY DISPATCH (&lt;5% TRIGGER)
                </h3>
                <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded bg-red-800 text-white">
                  TERMINAL_DISPATCH
                </span>
              </div>
              <p className="text-xs text-red-200 mt-1 leading-relaxed">
                Node A battery power exhausted ({nodes.nodeA.battery}%). High-priority Last Known Location Packet was synthesized with maximum TTL and broadcasted locally over <code className="bg-red-900/80 px-1 py-0.5 rounded font-mono text-white">resq_mesh_network</code>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap w-full md:w-auto">
            <button
              onClick={() => {
                setNodes(prev => ({
                  ...prev,
                  nodeA: { ...prev.nodeA, battery: 85 }
                }));
                setBatteryAlertBanner(false);
                addLog('BATTERY', 'Node A battery recharged/restored to 85%.');
              }}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition cursor-pointer shadow flex items-center gap-1.5"
            >
              <BatteryCharging className="w-4 h-4" />
              <span>Restore Battery (85%)</span>
            </button>
            <button
              onClick={() => setBatteryAlertBanner(false)}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-red-800 text-red-200 text-xs font-semibold transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* HERO SOS ACTIVATION CENTER */}
      <div className="bg-gradient-to-b from-[#161224] to-[#0d1322] border-2 border-red-600/60 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-600/80 text-red-300 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Emergency Citizen Distress Beacon
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Hold the Button to Transmit SOS Signal
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
              Broadcasts your GPS coordinates, battery level, and medical profile across offline mesh relays to nearest first responders.
            </p>
          </div>

          {/* CIRCULAR 3-SECOND HOLD BUTTON WITH ANIMATED PROGRESS RING */}
          <div className="py-4 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              {/* Outer SVG Progress Ring */}
              <svg className="w-56 h-56 -rotate-90 transform" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  className="stroke-slate-800"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  className="stroke-red-500 transition-all duration-75"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 52}
                  strokeDashoffset={(2 * Math.PI * 52) * (1 - holdProgress / 100)}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              {/* Central Trigger Button */}
              <button
                id="main-sos-button"
                onMouseDown={startHoldTimer}
                onMouseUp={cancelHoldTimer}
                onMouseLeave={cancelHoldTimer}
                onTouchStart={startHoldTimer}
                onTouchEnd={cancelHoldTimer}
                className={`absolute w-44 h-44 rounded-full flex flex-col items-center justify-center gap-1 text-white font-black transition-all transform active:scale-95 cursor-pointer shadow-2xl ${
                  isEmergencyActive
                    ? 'bg-gradient-to-br from-red-600 to-rose-700 shadow-red-600/50 animate-pulse'
                    : isHolding
                    ? 'bg-gradient-to-br from-red-700 to-rose-900 scale-95 shadow-red-700/60'
                    : 'bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 shadow-red-900/60'
                }`}
              >
                <AlertTriangle className="w-10 h-10 mb-0.5 drop-shadow" />
                <span className="text-xl tracking-wider uppercase font-black">
                  {isEmergencyActive ? 'SOS ACTIVE' : isHolding ? `${Math.ceil(3 - (holdProgress / 100) * 3)}s...` : 'HOLD FOR SOS'}
                </span>
                <span className="text-[10px] font-medium tracking-normal text-red-100 opacity-90">
                  {isEmergencyActive ? 'Broadcasting on Mesh' : '3 Seconds Hold'}
                </span>
              </button>
            </div>

            {/* Hold progress text */}
            <div className="mt-4 font-mono text-xs font-bold text-slate-300">
              {isHolding ? (
                <span className="text-red-400 animate-pulse">Arming emergency packet... {Math.round(holdProgress)}%</span>
              ) : isEmergencyActive ? (
                <span className="text-emerald-400 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Distress Beacon Packet Dispatched to P2P Mesh
                </span>
              ) : (
                <span className="text-slate-400">Press &amp; hold circle for 3 seconds</span>
              )}
            </div>
          </div>

          {/* QUICK STATUS TOGGLES */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Instant Triage Condition Selector:
            </span>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto">
              {[
                { status: 'CRITICAL - TRAPPED', label: '🚨 Trapped', color: 'bg-red-950/80 border-red-600 text-red-300' },
                { status: 'INJURED', label: '⚠️ Injured', color: 'bg-amber-950/80 border-amber-600 text-amber-300' },
                { status: 'SAFE', label: '✅ Safe', color: 'bg-emerald-950/80 border-emerald-600 text-emerald-300' }
              ].map(item => (
                <button
                  key={item.status}
                  onClick={() => {
                    setNodes(prev => ({
                      ...prev,
                      nodeA: { ...prev.nodeA, status: item.status }
                    }));
                  }}
                  className={`py-2 px-3 rounded-xl border font-bold text-xs sm:text-sm transition cursor-pointer ${
                    nodes.nodeA.status === item.status
                      ? `${item.color} shadow-lg ring-2 ring-red-400`
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LIVE TELEMETRY & CITIZEN STATUS CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* GPS Sensor */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <Satellite className="w-4 h-4 text-indigo-400" />
              GPS Geolocation
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold">
              ±{gpsState.accuracy}m Accuracy
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-white pt-1">
            {Number(manualCoords.lat).toFixed(5)}° N, {Number(manualCoords.lng).toFixed(5)}° E
          </div>
          <div className="text-xs text-slate-400">
            {manualCoords.label || 'Sector 4, Block G (Disaster Zone)'}
          </div>
        </div>

        {/* Battery & Last-Gasp Sensor */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <Battery className="w-4 h-4 text-emerald-400" />
              Device Battery
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
              nodes.nodeA.battery < 10
                ? 'bg-red-950 border-red-700 text-red-300 animate-pulse'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}>
              {nodes.nodeA.battery}% Power
            </span>
          </div>
          <div className="text-xs text-slate-300">
            <strong className="text-emerald-400">Last-Gasp Protection:</strong> Auto-transmits terminal coordinate burst at &lt;5%.
          </div>
          <button
            onClick={() => {
              setNodes(prev => ({
                ...prev,
                nodeA: { ...prev.nodeA, battery: 3 }
              }));
            }}
            className="w-full py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-800 text-red-300 text-[11px] font-bold transition cursor-pointer"
          >
            Simulate &lt;5% Battery Drain
          </button>
        </div>

        {/* Mesh Network Status */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-cyan-400" />
              Mesh Protocol
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold">
              BroadcastChannel
            </span>
          </div>
          <div className="text-xs text-slate-300 leading-relaxed">
            Zero Cellular Required. Packets hop peer-to-peer across phones until reaching a satellite/cellular gateway.
          </div>
          <button
            onClick={simulateFullPulse}
            className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>1-Click Multi-Hop Pulse</span>
          </button>
        </div>
      </div>

      {/* EMERGENCY TOOLS: SIREN, OPTICAL MORSE BEACON & VOICE-ACTIVATED SOS */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Hardware Emergency Beacons &amp; Telemetry Upgrades
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-bold">
            Optical • Acoustic • Voice
          </span>
        </div>

        {/* 1. OPTICAL MORSE CODE STROBE & ACOUSTIC SIREN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Siren */}
          <button
            onClick={toggleSirenTone}
            className={`min-h-[48px] p-3.5 rounded-xl border font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition cursor-pointer ${
              isSirenPlaying
                ? 'bg-amber-600 border-amber-500 text-white animate-bounce'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {isSirenPlaying ? <Volume2 className="w-5 h-5 text-amber-200" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
            <span>{isSirenPlaying ? 'Acoustic Siren ACTIVE (Warble)' : '🔊 Sound 880Hz Acoustic Siren'}</span>
          </button>

          {/* Optical Morse SOS Beacon Switch */}
          <button
            id="toggle-optical-beacon-btn"
            onClick={() => setIsBeaconActive(!isBeaconActive)}
            className={`min-h-[48px] p-3.5 rounded-xl border font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition cursor-pointer relative overflow-hidden ${
              isBeaconActive
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/50'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Flashlight className={`w-5 h-5 ${isBeaconActive ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`} />
            <span>{isBeaconActive ? '🔦 Optical Morse Beacon ACTIVE' : '🔦 Toggle Optical Beacon'}</span>
          </button>
        </div>

        {/* Visual Morse Code Rhythm Visualizer */}
        {isBeaconActive && (
          <div className="bg-slate-950 p-3.5 rounded-xl border border-red-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-3.5 h-3.5 rounded-full shrink-0 transition-colors ${
                morseFlash ? 'bg-amber-300 shadow-[0_0_12px_#f59e0b]' : 'bg-slate-800'
              }`} />
              <div className="font-mono">
                <strong className="text-amber-300 font-bold">Visual Morse Code Strobe: </strong>
                <span className="text-slate-200">SOS (... --- ...) Torch &amp; Screen Strobe</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className={`px-2 py-0.5 rounded font-bold ${morseInfo.letter === 'S' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                S (···)
              </span>
              <span className={`px-2 py-0.5 rounded font-bold ${morseInfo.letter === 'O' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                O (———)
              </span>
              <span className={`px-2 py-0.5 rounded font-bold ${morseInfo.letter === 'S' && morseInfo.stepIndex > 10 ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                S (···)
              </span>
            </div>
          </div>
        )}

        {/* 2. VOICE-ACTIVATED HANDS-FREE SOS (Speech Recognition) */}
        <div className="bg-gradient-to-r from-slate-950 to-indigo-950/40 p-4 rounded-xl border border-indigo-900/60 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${isVoiceSosListening ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                {isVoiceSosListening ? <Mic className="w-4 h-4 text-cyan-300" /> : <MicOff className="w-4 h-4" />}
              </div>
              <div>
                <h4 className="font-bold text-white text-xs sm:text-sm">
                  🎙️ Hands-Free Voice SOS Trigger (Speech Recognition)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Continuous keyword monitor. Triggers 3-second SOS burst when distress phrases are spoken.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              id="toggle-voice-sos-btn"
              onClick={toggleVoiceSos}
              className={`min-h-[38px] px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow ${
                isVoiceSosListening
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400 shadow-emerald-950/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {isVoiceSosListening ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>Listening (Active)</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Enable Voice SOS</span>
                </>
              )}
            </button>
          </div>

          {/* Trigger Keyword Badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Distress Keywords:</span>
            {['HELP', 'TRAPPED', 'INJURED', 'STUCK', 'MAYDAY'].map(kw => (
              <span
                key={kw}
                className={`px-2 py-0.5 rounded font-mono font-bold border ${
                  voiceDetectedKeyword === kw.toLowerCase()
                    ? 'bg-red-600 border-red-400 text-white animate-bounce'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                "{kw}"
              </span>
            ))}
          </div>

          {/* Live Transcript Readout & Simulated Test Buttons */}
          <div className="bg-black/60 p-2.5 rounded-lg border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 overflow-hidden w-full">
              <span className="text-[10px] uppercase font-bold text-indigo-400 font-mono shrink-0">Live Transcript:</span>
              <span className="text-slate-200 italic truncate font-mono text-[11px]">
                {voiceTranscript ? `"${voiceTranscript}"` : isVoiceSosListening ? 'Listening for speech...' : 'Microphone idle. Speak keyword or simulate below.'}
              </span>
            </div>

            {/* Simulated Trigger Buttons for Sandbox Testing */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-slate-400">Quick Test:</span>
              <button
                onClick={() => simulateVoiceKeyword('HELP')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-red-700 text-slate-200 hover:text-white text-[10px] font-mono font-bold transition cursor-pointer"
                title="Test trigger with keyword 'HELP'"
              >
                "HELP"
              </button>
              <button
                onClick={() => simulateVoiceKeyword('TRAPPED')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-red-700 text-slate-200 hover:text-white text-[10px] font-mono font-bold transition cursor-pointer"
                title="Test trigger with keyword 'TRAPPED'"
              >
                "TRAPPED"
              </button>
              <button
                onClick={() => simulateVoiceKeyword('INJURED')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-red-700 text-slate-200 hover:text-white text-[10px] font-mono font-bold transition cursor-pointer"
                title="Test trigger with keyword 'INJURED'"
              >
                "INJURED"
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVE PACKET TELEMETRY PREVIEW (INCLUDING VOICE NOTE) */}
      {isEmergencyActive && currentPacket && (
        <div className="bg-red-950/40 border border-red-800/80 rounded-2xl p-4 shadow-lg space-y-2 text-xs">
          <div className="flex items-center justify-between text-red-300 font-bold border-b border-red-900/60 pb-1.5">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              Active Broadcast Packet: {currentPacket.uuid}
            </span>
            <span className="font-mono text-[10px] text-slate-400">Hops: {currentPacket.hops} • TTL: {currentPacket.ttl}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-slate-300">
            <div><span className="text-slate-400">Status:</span> <strong className="text-red-400">{currentPacket.status}</strong></div>
            <div><span className="text-slate-400">Coords:</span> {Number(currentPacket.lat).toFixed(4)}°, {Number(currentPacket.lng).toFixed(4)}°</div>
            <div><span className="text-slate-400">Battery:</span> {currentPacket.battery}%</div>
            <div><span className="text-slate-400">Medical:</span> {currentPacket.medical}</div>
          </div>
          {currentPacket.voiceNote && (
            <div className="bg-black/50 p-2 rounded-lg border border-red-900/80 text-amber-300 font-mono text-[11px] flex items-center gap-2">
              <Mic className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span><strong>Voice Telemetry:</strong> {currentPacket.voiceNote}</span>
            </div>
          )}
        </div>
      )}

      {/* CITIZEN EMERGENCY MEDICAL PROFILE */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-400" />
            Emergency Medical Data (Embedded in SOS Payload)
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">Triage Tag: Node A</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1">Blood Group:</label>
            <select
              value={userProfile.bloodGroup}
              onChange={e => setUserProfile(prev => ({ ...prev, bloodGroup: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
            >
              {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Emergency Contact:</label>
            <input
              type="text"
              value={userProfile.emergencyContact}
              onChange={e => setUserProfile(prev => ({ ...prev, emergencyContact: e.target.value }))}
              placeholder="+1 (555) 911-RESQ"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Critical Conditions / Notes:</label>
            <input
              type="text"
              value={userProfile.medicalNotes}
              onChange={e => setUserProfile(prev => ({ ...prev, medicalNotes: e.target.value }))}
              placeholder="Asthmatic, conscious under debris"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* PHYSICAL HARDWARE BLUETOOTH & ZERO-INTERNET P2P PEER ACTIONS */}
      <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-800/60 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-blue-900/50 pb-2.5">
          <div>
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400" />
              Real Physical Phone &amp; Bluetooth Proximity Hardware
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Connect real-life Bluetooth beacons or pair two physical phones offline without cellular/Wi-Fi.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 border border-blue-700 text-blue-300 font-bold">
            Web Bluetooth &amp; WebRTC
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={onOpenBleModal}
            className={`min-h-[44px] p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition cursor-pointer ${
              bleTelemetry?.connected
                ? 'bg-blue-900/60 border-blue-400 text-white shadow-lg shadow-blue-950/60'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-600/30 text-blue-400">
                <Bluetooth className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {bleTelemetry?.connected ? 'Real BLE Connected' : 'Scan & Track Real BLE Device'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {bleTelemetry?.connected
                    ? `${bleTelemetry.deviceName} • ${bleTelemetry.distanceMeters.toFixed(1)}m`
                    : 'Pair beacon for dynamic audio beep'}
                </div>
              </div>
            </div>
            <span className="text-xs text-blue-400 font-bold">Open →</span>
          </button>

          <button
            type="button"
            onClick={onOpenP2PModal}
            className={`min-h-[44px] p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition cursor-pointer ${
              p2pConnectionState === 'CONNECTED'
                ? 'bg-emerald-900/60 border-emerald-400 text-white shadow-lg shadow-emerald-950/60'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-600/30 text-emerald-400">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {p2pConnectionState === 'CONNECTED' ? 'P2P DataChannel Online' : 'Pair 2nd Phone (Zero-Internet)'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {p2pConnectionState === 'CONNECTED' ? 'Direct P2P Link Established' : 'WebRTC QR or Acoustic Sound Modem'}
                </div>
              </div>
            </div>
            <span className="text-xs text-emerald-400 font-bold">Pair →</span>
          </button>
        </div>
      </div>

      {/* RELAY FORWARD ACTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-white text-sm">Step 2: Forward Signal to Nearby Relay (Node B)</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulate opportunistic Bluetooth/Wi-Fi Direct handshake to neighboring citizen phone.
          </p>
        </div>
        <button
          id="forward-a-to-b-manual-btn"
          onClick={forwardAtoB}
          disabled={nodes.nodeA.packets.length === 0}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-indigo-600 hover:from-red-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="w-4 h-4" />
          <span>Forward Hop → Dummy Relay Alpha</span>
        </button>
      </div>
    </div>
  );
}
