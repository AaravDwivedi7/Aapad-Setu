import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Smartphone,
  WifiOff,
  Radio,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  X,
  Zap,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export function P2PPairingModal({
  isOpen,
  onClose,
  p2pMesh,
  connectionState,
  addLog,
  showToast
}) {
  const [activeTab, setActiveTab] = useState('HOST'); // 'HOST' (create offer) | 'CLIENT' (accept offer)
  const [offerCode, setOfferCode] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [remoteOfferInput, setRemoteOfferInput] = useState('');
  const [remoteAnswerInput, setRemoteAnswerInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate Offer when Host tab opens
  useEffect(() => {
    if (isOpen && activeTab === 'HOST' && p2pMesh && !offerCode) {
      generateOffer();
    }
  }, [isOpen, activeTab, p2pMesh]);

  const generateOffer = async () => {
    if (!p2pMesh) return;
    setIsGenerating(true);
    try {
      const offer = await p2pMesh.createOffer();
      setOfferCode(offer);
      const url = await QRCode.toDataURL(offer, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrDataUrl(url);
      addLog('P2P', 'Offline WebRTC Offer QR Code synthesized.');
    } catch (e) {
      console.warn('Error generating offer:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAnswer = async () => {
    if (!p2pMesh || !remoteOfferInput.trim()) return;
    setIsGenerating(true);
    try {
      const answer = await p2pMesh.createAnswerFromOffer(remoteOfferInput.trim());
      setAnswerCode(answer);
      const url = await QRCode.toDataURL(answer, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrDataUrl(url);
      showToast('✅ Answer Generated', 'Provide this Answer token back to the Host phone.', 'success');
      addLog('P2P', 'WebRTC Answer synthesized from remote Offer.');
    } catch (err) {
      showToast('⚠️ Invalid Offer Code', 'Failed to decode WebRTC Offer payload.', 'alert');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalizeHost = async () => {
    if (!p2pMesh || !remoteAnswerInput.trim()) return;
    try {
      await p2pMesh.finalizeWithAnswer(remoteAnswerInput.trim());
      showToast('🎉 Physical Phones Paired!', 'Offline WebRTC DataChannel established.', 'success');
      addLog('P2P', '🎉 Physical multi-phone WebRTC P2P DataChannel connection finalized!');
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      showToast('⚠️ Finalization Failed', 'Check the Answer token format.', 'alert');
    }
  };

  const copyToClipboard = (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        showToast('📋 Copied to Clipboard', 'Paste into the second device.', 'info');
      }).catch(() => {});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f172a] border-2 border-indigo-600/80 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-950 border border-indigo-600 text-indigo-400 shadow-md">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                OFFLINE P2P MULTI-PHONE DIRECT BRIDGE
              </h2>
              <p className="text-xs text-slate-400">
                Direct Device-to-Device WebRTC DataChannel (0 Internet / 0 Cellular Required)
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

        {/* Connection Status Badge */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-xs font-bold text-slate-300">P2P Channel Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 border ${
            connectionState === 'CONNECTED'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500 animate-pulse'
              : 'bg-slate-900 text-slate-400 border-slate-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connectionState === 'CONNECTED' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            {connectionState === 'CONNECTED' ? '🟢 P2P HARDWARE LINK ACTIVE' : '⚪ DISCONNECTED (Offline Ready)'}
          </span>
        </div>

        {/* Tabs: Device 1 (Host) vs Device 2 (Joiner) */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('HOST')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'HOST'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Phone 1 (Host / Beacon)</span>
          </button>
          <button
            onClick={() => setActiveTab('CLIENT')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'CLIENT'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Phone 2 (Joiner / Rescuer)</span>
          </button>
        </div>

        {/* TAB 1: HOST (Generate Offer, Receive Answer) */}
        {activeTab === 'HOST' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-900 flex items-center justify-center text-[11px] text-white">1</span>
                Scan QR or Copy Offer Token on Phone 2:
              </h3>

              {qrDataUrl ? (
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-inner max-w-[220px] mx-auto">
                  <img src={qrDataUrl} alt="WebRTC Pairing QR" className="w-48 h-48 rounded-lg" />
                  <span className="text-[10px] text-black font-bold font-mono mt-1">OFFLINE WEBRTC OFFER</span>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                  Synthesizing cryptographic pairing key...
                </div>
              )}

              {offerCode && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={offerCode}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 truncate"
                  />
                  <button
                    onClick={() => copyToClipboard(offerCode)}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Paste Answer from Phone 2 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-900 flex items-center justify-center text-[11px] text-white">2</span>
                Paste Answer Token from Phone 2:
              </h3>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Paste Answer token here..."
                  value={remoteAnswerInput}
                  onChange={(e) => setRemoteAnswerInput(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleFinalizeHost}
                  disabled={!remoteAnswerInput.trim()}
                  className="min-h-[42px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-lg"
                >
                  <Zap className="w-4 h-4" />
                  <span>Connect P2P</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CLIENT (Paste Offer, Generate Answer) */}
        {activeTab === 'CLIENT' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-900 flex items-center justify-center text-[11px] text-white">1</span>
                Paste Phone 1's Offer Token:
              </h3>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Paste Phone 1's Offer token..."
                  value={remoteOfferInput}
                  onChange={(e) => setRemoteOfferInput(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleGenerateAnswer}
                  disabled={!remoteOfferInput.trim() || isGenerating}
                  className="min-h-[42px] px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-lg"
                >
                  <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>Generate Answer</span>
                </button>
              </div>
            </div>

            {/* Display Answer QR/Token */}
            {answerCode && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-900 flex items-center justify-center text-[11px] text-white">2</span>
                  Provide This Answer Token Back to Phone 1:
                </h3>

                {qrDataUrl && (
                  <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-inner max-w-[220px] mx-auto">
                    <img src={qrDataUrl} alt="Answer QR" className="w-48 h-48 rounded-lg" />
                    <span className="text-[10px] text-black font-bold font-mono mt-1">OFFLINE WEBRTC ANSWER</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={answerCode}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 truncate"
                  />
                  <button
                    onClick={() => copyToClipboard(answerCode)}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-900/60 text-xs text-slate-300 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>True Zero-Infrastructure Resilience:</strong> Once connected, disaster telemetry, GPS vectors, and SOS triggers hop directly between physical device radios without requiring any Wi-Fi routers, towers, or Internet access.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="min-h-[42px] px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
