import React, { useState, useEffect, useRef } from 'react';
import {
  Bluetooth,
  BluetoothSearching,
  Wifi,
  Radio,
  Volume2,
  VolumeX,
  Zap,
  Sliders,
  AlertCircle,
  X,
  CheckCircle2,
  Activity,
  Compass,
  Layers,
  Battery
} from 'lucide-react';
import { isWebBluetoothSupported } from '../utils/bluetooth';

export function BluetoothScannerModal({
  isOpen,
  onClose,
  bleManager,
  bleTelemetry,
  telemetry,
  onScanAndPair,
  onDisconnect,
  onUpdateManualRssi,
  sonarEngine,
  addLog,
  showToast
}) {
  const activeTelemetry = bleTelemetry || telemetry;
  const [isScanning, setIsScanning] = useState(false);
  const [manualDistance, setManualDistance] = useState(activeTelemetry?.distanceMeters || 12.0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isPulseActive, setIsPulseActive] = useState(false);
  const supported = isWebBluetoothSupported();

  const safeToast = (title, desc, type = 'info') => {
    if (typeof showToast === 'function') {
      showToast(title, desc, type);
    } else if (typeof addLog === 'function') {
      addLog('BLE', `${title}: ${desc}`);
    }
  };

  useEffect(() => {
    if (activeTelemetry?.distanceMeters) {
      setManualDistance(activeTelemetry.distanceMeters);
    }
  }, [activeTelemetry]);

  const handlePairClick = async () => {
    setIsScanning(true);
    try {
      if (typeof onScanAndPair === 'function') {
        await onScanAndPair();
      } else if (bleManager && typeof bleManager.requestAndPairDevice === 'function') {
        await bleManager.requestAndPairDevice();
      }
      safeToast('🔗 BLE Device Paired', 'Tracking physical Bluetooth RSSI and proximity.', 'success');
    } catch (err) {
      if (err?.name === 'NotFoundError') {
        safeToast('ℹ️ Scanner Cancelled', 'No Bluetooth device was selected.', 'info');
      } else {
        safeToast('⚠️ Bluetooth Error', err?.message || 'Bluetooth scan failed.', 'alert');
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleDisconnect = () => {
    if (typeof onDisconnect === 'function') {
      onDisconnect();
    } else if (bleManager && typeof bleManager.disconnect === 'function') {
      bleManager.disconnect();
    }
    safeToast('🔌 Disconnected', 'Bluetooth device unlinked.', 'info');
  };

  const handleSliderChange = (e) => {
    const dist = parseFloat(e.target.value);
    setManualDistance(dist);
    // Approximate RSSI = TxPower - 10 * n * log10(dist)
    const rssi = Math.round(-59 - 25 * Math.log10(dist));
    if (typeof onUpdateManualRssi === 'function') {
      onUpdateManualRssi(rssi, 'Calibrated BLE Proximity Beacon');
    } else if (bleManager && typeof bleManager.updateManualRssi === 'function') {
      bleManager.updateManualRssi(rssi, 'Calibrated BLE Proximity Beacon');
    }
    if (sonarEngine) {
      sonarEngine.updateDistance(dist);
      sonarEngine.emitSinglePulse(dist);
      setIsPulseActive(true);
      setTimeout(() => setIsPulseActive(false), 200);
    }
  };

  const toggleMute = () => {
    if (sonarEngine) {
      const nextMuted = !isAudioMuted;
      sonarEngine.setMuted(nextMuted);
      setIsAudioMuted(nextMuted);
      if (!nextMuted) {
        sonarEngine.emitSinglePulse(manualDistance);
      }
    }
  };

  if (!isOpen) return null;

  const rssi = activeTelemetry?.rssi || -72;
  const distance = activeTelemetry?.distanceMeters || manualDistance;
  const isConnected = activeTelemetry?.connected || false;
  const deviceName = activeTelemetry?.name || 'Local BLE Sensor Beacon';

  // Calculate audio interval & pitch for visual feedback
  const intervalMs = sonarEngine ? sonarEngine.calculateIntervalMs(distance) : 800;
  const pitchHz = sonarEngine ? sonarEngine.calculatePitchHz(distance) : 600;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f172a] border-2 border-indigo-600/80 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-950 border border-indigo-600 text-indigo-400 shadow-md">
              <Bluetooth className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                REAL-WORLD BLUETOOTH (BLE) PROXIMITY RADAR
              </h2>
              <p className="text-xs text-slate-400">
                Web Bluetooth Low Energy (BLE) RSSI Distance Meter &amp; Dynamic Acoustic Beeper
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser compatibility banner */}
        {!supported && (
          <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-600 text-amber-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Web Bluetooth Notice:</strong> Native BLE scanning is fully supported in <strong>Chrome on Android/Desktop</strong> and <strong>Bluefy on iOS</strong>. You can use the hardware calibration slider below to test the live audio proximity beeper and radar mathematics in any browser!
            </div>
          </div>
        )}

        {/* Live Hardware Connection Status */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">BLE Connection Status</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 border ${
              isConnected
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              {isConnected ? '🟢 HARDWARE PAIRED' : '⚪ READY TO SCAN'}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300 font-semibold">{deviceName}</span>
            {activeTelemetry?.batteryLevel && (
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                <Battery className="w-3.5 h-3.5" />
                {activeTelemetry.batteryLevel}% Battery
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handlePairClick}
              disabled={isScanning}
              className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
                isScanning
                  ? 'bg-indigo-950 border border-indigo-700 text-indigo-300 animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {isScanning ? <BluetoothSearching className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
              <span>{isScanning ? 'Searching Nearby Devices...' : '🔍 Scan & Pair Physical BLE Device'}</span>
            </button>

            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-300 text-xs font-bold transition cursor-pointer"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Radar & Audio Proximity Beeper Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">SIGNAL RSSI</span>
            <strong className={`text-lg font-mono font-black ${
              rssi >= -60 ? 'text-emerald-400' : rssi >= -75 ? 'text-cyan-400' : 'text-amber-400'
            }`}>
              {rssi} dBm
            </strong>
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">EST. DISTANCE</span>
            <strong className={`text-lg font-mono font-black ${
              distance <= 1.5 ? 'text-red-400 animate-pulse' : distance <= 6.0 ? 'text-amber-400' : 'text-indigo-300'
            }`}>
              {distance.toFixed(1)}m
            </strong>
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">BEEP PITCH</span>
            <strong className="text-lg font-mono font-black text-cyan-300">
              {pitchHz} Hz
            </strong>
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">PULSE RATE</span>
            <strong className="text-lg font-mono font-black text-emerald-300">
              {intervalMs} ms
            </strong>
          </div>
        </div>

        {/* Visual Pulse Waveform Ring */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-[#0d1627] to-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full transition-all duration-150 ${
              isPulseActive
                ? 'bg-red-500 text-white shadow-[0_0_24px_#ef4444] scale-110'
                : distance <= 2.0
                ? 'bg-amber-600/80 text-white'
                : 'bg-indigo-950 text-indigo-400'
            }`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {distance <= 1.5 ? '🚨 IMMEDIATE PROXIMITY (<1.5m) — TOUCH RANGE' : distance <= 6.0 ? '⚠️ RAPID APPROACH (<6m) — WITHIN VISUAL SIGHT' : '📡 LONG RANGE SEARCH (>6m)'}
              </h4>
              <p className="text-[11px] text-slate-400">
                Acoustic pitch and haptic vibrations scale automatically as devices close in.
              </p>
            </div>
          </div>

          <button
            onClick={toggleMute}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
              isAudioMuted
                ? 'bg-slate-900 border-slate-700 text-slate-400'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
            }`}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 animate-bounce" />}
            <span>{isAudioMuted ? 'Muted' : 'Audio ACTIVE'}</span>
          </button>
        </div>

        {/* Interactive Distance & Proximity Calibration Slider */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Simulate Real-Life Device Distance (0.2m to 50m):
            </span>
            <span className="font-mono font-bold text-cyan-300 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
              {distance.toFixed(1)} meters
            </span>
          </div>

          <input
            type="range"
            min="0.2"
            max="45.0"
            step="0.1"
            value={distance}
            onChange={handleSliderChange}
            className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span className="text-red-400 font-bold">0.2m (Touching)</span>
            <span className="text-amber-400 font-bold">5m (Close)</span>
            <span className="text-cyan-400">20m (Nearby)</span>
            <span className="text-slate-400">45m (Far)</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="min-h-[42px] px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
