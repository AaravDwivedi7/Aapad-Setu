import React, { useState } from 'react';
import {
  X,
  Terminal,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Smartphone,
  Radio,
  Server,
  Zap,
  ArrowRight,
  Bot,
  Wifi,
  WifiOff,
  Battery,
  Sliders,
  Send,
  UploadCloud
} from 'lucide-react';

export default function NetworkInspectorDrawer({
  isOpen,
  onClose,
  nodes,
  setNodes,
  metrics,
  logs,
  setLogs,
  logFilter,
  setLogFilter,
  selectedHopTarget,
  setSelectedHopTarget,
  forwardAtoB,
  executeRelayHop,
  executeGatewaySync,
  simulateFullPulse,
  copiedKey,
  copyText,
  manualCoords,
  showToast
}) {
  const [expandedBuffers, setExpandedBuffers] = useState({
    nodeA: true,
    nodeB: true,
    nodeC: true
  });

  if (!isOpen) return null;

  const filteredLogs = logs.filter(l => logFilter === 'ALL' || l.type === logFilter);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0b101d] border-t-2 border-indigo-500 w-full max-w-7xl max-h-[92vh] flex flex-col rounded-t-3xl shadow-2xl overflow-hidden">
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#070b14]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                ResQ Network Inspector &amp; Protocol Diagnostics
              </h3>
              <p className="text-xs text-slate-400">
                Low-level Delay-Tolerant Networking (DTN) packet visualizer, topology trace, and immutable logs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={simulateFullPulse}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>1-Click Multi-Hop Pulse</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin">
          {/* Protocol Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs font-mono">
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-slate-400 block text-[10px]">CREATED</span>
              <strong className="text-base text-white">{metrics.packetsCreated}</strong>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-slate-400 block text-[10px]">RELAYED</span>
              <strong className="text-base text-indigo-400">{metrics.packetsRelayed}</strong>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-slate-400 block text-[10px]">HOPS DONE</span>
              <strong className="text-base text-blue-400">{metrics.hopsCompleted}</strong>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-slate-400 block text-[10px]">DUPLICATES DROPPED</span>
              <strong className="text-base text-amber-400">{metrics.duplicatesRejected}</strong>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-slate-400 block text-[10px]">PEER BROADCASTS</span>
              <strong className="text-base text-cyan-400">{metrics.broadcastsReceived}</strong>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-slate-400 block text-[10px]">CLOUD SYNCED</span>
              <strong className="text-base text-emerald-400">{metrics.packetsSynced}</strong>
            </div>
          </div>

          {/* 3-NODE TOPOLOGY DIAGRAM */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Node 1: Victim This Device */}
            <div className="bg-slate-900/90 border-2 border-red-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-red-400" />
                  Node 1 (This Device)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-700">
                  LIVE SENSORS
                </span>
              </div>
              <div className="text-xs text-slate-300 font-mono space-y-1">
                <div>Battery: {nodes.nodeA.battery}% • Status: {nodes.nodeA.status}</div>
                <div>Buffer: {nodes.nodeA.packets.length} packet(s)</div>
              </div>
              <button
                onClick={forwardAtoB}
                disabled={nodes.nodeA.packets.length === 0}
                className="w-full py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Forward → Node 2</span>
              </button>
            </div>

            {/* Node 2: Dummy Relay Alpha */}
            <div className="bg-slate-900/90 border-2 border-indigo-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-indigo-400" />
                  Node 2 (Dummy Relay)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700">
                  SIMULATED
                </span>
              </div>
              <div className="text-xs text-slate-300 font-mono space-y-1">
                <div>Battery: {nodes.nodeB.battery}% • RSSI: {nodes.nodeB.rssiToA} dBm</div>
                <div>Cached: {nodes.nodeB.packets.length} packet(s)</div>
              </div>
              <button
                onClick={executeRelayHop}
                disabled={nodes.nodeB.packets.length === 0}
                className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Forward → Node 3 (Gateway)</span>
              </button>
            </div>

            {/* Node 3: Dummy Gateway Beta */}
            <div className="bg-slate-900/90 border-2 border-emerald-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-emerald-400" />
                  Node 3 (Dummy Gateway)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                  {nodes.nodeC.isOnline ? 'ONLINE (5G)' : 'OFFLINE'}
                </span>
              </div>
              <div className="text-xs text-slate-300 font-mono space-y-1">
                <div>Battery: {nodes.nodeC.battery}% • Uplink: 5G/Starlink</div>
                <div>Queue: {nodes.nodeC.packets.length} packet(s)</div>
              </div>
              <button
                onClick={executeGatewaySync}
                disabled={nodes.nodeC.packets.length === 0}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Dispatch to Cloud Console</span>
              </button>
            </div>
          </div>

          {/* RAW JSON PACKET BUFFER INSPECTORS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            {/* Buffer A */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-2 border-b border-slate-800 pb-1">
                <span className="font-bold text-red-400">Node 1 Outbox ({nodes.nodeA.packets.length})</span>
                {nodes.nodeA.packets.length > 0 && (
                  <button
                    onClick={() => copyText(nodes.nodeA.packets[0], 'inspectNodeA')}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedKey === 'inspectNodeA' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
              <pre className="text-[11px] text-slate-300 bg-black/40 p-2.5 rounded max-h-36 overflow-y-auto whitespace-pre-wrap break-all">
                {nodes.nodeA.packets.length > 0 ? JSON.stringify(nodes.nodeA.packets[0], null, 2) : '// Empty buffer'}
              </pre>
            </div>

            {/* Buffer B */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-2 border-b border-slate-800 pb-1">
                <span className="font-bold text-indigo-400">Node 2 Cache ({nodes.nodeB.packets.length})</span>
                {nodes.nodeB.packets.length > 0 && (
                  <button
                    onClick={() => copyText(nodes.nodeB.packets[0], 'inspectNodeB')}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedKey === 'inspectNodeB' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
              <pre className="text-[11px] text-slate-300 bg-black/40 p-2.5 rounded max-h-36 overflow-y-auto whitespace-pre-wrap break-all">
                {nodes.nodeB.packets.length > 0 ? JSON.stringify(nodes.nodeB.packets[0], null, 2) : '// Empty buffer'}
              </pre>
            </div>

            {/* Buffer C */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-2 border-b border-slate-800 pb-1">
                <span className="font-bold text-emerald-400">Node 3 Queue ({nodes.nodeC.packets.length})</span>
                {nodes.nodeC.packets.length > 0 && (
                  <button
                    onClick={() => copyText(nodes.nodeC.packets[0], 'inspectNodeC')}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedKey === 'inspectNodeC' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
              <pre className="text-[11px] text-slate-300 bg-black/40 p-2.5 rounded max-h-36 overflow-y-auto whitespace-pre-wrap break-all">
                {nodes.nodeC.packets.length > 0 ? JSON.stringify(nodes.nodeC.packets[0], null, 2) : '// Empty buffer'}
              </pre>
            </div>
          </div>

          {/* SYSTEM LOGS TERMINAL */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase text-white">System Protocol Logs</span>
              </div>
              <button
                onClick={() => setLogs([])}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-1 text-xs">
              {['ALL', 'GPS', 'SOS', 'RELAY', 'MESH', 'CLOUD', 'DEDUP', 'BATTERY'].map(t => (
                <button
                  key={t}
                  onClick={() => setLogFilter(t)}
                  className={`px-2.5 py-0.5 rounded font-mono font-bold transition cursor-pointer ${
                    logFilter === t ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Log Stream */}
            <div className="bg-black/90 p-3 rounded-lg font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
              {filteredLogs.map(l => (
                <div key={l.id} className="flex items-start gap-2 text-slate-300 border-b border-slate-900/60 pb-1">
                  <span className="text-slate-500 text-[11px]">[{l.time}]</span>
                  <span className="px-1 py-0.2 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                    {l.type}
                  </span>
                  <span className="break-all">{l.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
