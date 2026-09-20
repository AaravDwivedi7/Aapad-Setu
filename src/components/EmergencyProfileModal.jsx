import React, { useState } from 'react';
import { User, Heart, Shield, Phone, AlertTriangle, CheckCircle, X, Activity } from 'lucide-react';

const BLOOD_GROUPS = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-', 'Unknown'];

const COMMON_CONDITIONS = [
  'Asthma (Needs Inhaler)',
  'Type 1/2 Diabetic',
  'Heart Condition / Pacemaker',
  'Severe Penicillin Allergy',
  'Hypertension (BP)',
  'Mobility Impaired / Wheelchair',
  'Carrying Infant / Child'
];

export default function EmergencyProfileModal({ isOpen, onClose, currentProfile, onSave }) {
  const [name, setName] = useState(currentProfile?.name || '');
  const [bloodGroup, setBloodGroup] = useState(currentProfile?.bloodGroup || 'O+');
  const [healthIssues, setHealthIssues] = useState(currentProfile?.healthIssues || '');
  const [emergencyContact, setEmergencyContact] = useState(currentProfile?.emergencyContact || '');
  const [notes, setNotes] = useState(currentProfile?.notes || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const toggleCondition = (cond) => {
    if (healthIssues.includes(cond)) {
      const updated = healthIssues
        .split(',')
        .map(s => s.trim())
        .filter(s => s && s !== cond)
        .join(', ');
      setHealthIssues(updated);
    } else {
      const updated = healthIssues.trim()
        ? `${healthIssues.trim()}, ${cond}`
        : cond;
      setHealthIssues(updated);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const updated = {
      name: name.trim(),
      bloodGroup,
      healthIssues: healthIssues.trim(),
      emergencyContact: emergencyContact.trim(),
      notes: notes.trim(),
      updatedAt: Date.now()
    };
    onSave(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#0e1424] border-2 border-cyan-600/70 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl shadow-cyan-950 text-left relative my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-lg shadow-red-950/60">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <span className="bg-red-950 text-red-300 border border-red-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Offline Triage Readiness
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white mt-1">
              Emergency Medical & Identity Profile
            </h2>
            <p className="text-xs text-slate-400">
              Broadcast to rescuers during SOS to ensure immediate, life-saving medical triage.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* 1. Full Name */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Full Name <span className="text-red-400">*</span></span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma, Ananya Verma..."
              className="w-full bg-[#070a14] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans shadow-inner"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Rescuers and responders will address you by this name upon arrival.
            </p>
          </div>

          {/* 2. Blood Group */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-red-400" />
              <span>Blood Group</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {BLOOD_GROUPS.map((bg) => (
                <button
                  type="button"
                  key={bg}
                  onClick={() => setBloodGroup(bg)}
                  className={`py-2 px-1 rounded-xl font-mono font-bold text-center border transition ${
                    bloodGroup === bg
                      ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950'
                      : 'bg-[#070a14] text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Chronic Health Issues & Medical Allergies */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Health Issues, Allergies &amp; Chronic Conditions</span>
            </label>
            
            {/* Quick condition chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_CONDITIONS.map((cond) => {
                const active = healthIssues.includes(cond);
                return (
                  <button
                    type="button"
                    key={cond}
                    onClick={() => toggleCondition(cond)}
                    className={`text-[10px] font-sans px-2.5 py-1 rounded-lg border transition ${
                      active
                        ? 'bg-amber-950 text-amber-300 border-amber-600 font-semibold'
                        : 'bg-[#080d1a] text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}{cond}
                  </button>
                );
              })}
            </div>

            <textarea
              rows={2}
              value={healthIssues}
              onChange={(e) => setHealthIssues(e.target.value)}
              placeholder="e.g. Asthma, Penicillin allergy, takes daily insulin, heart stent..."
              className="w-full bg-[#070a14] border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans shadow-inner resize-none"
            />
          </div>

          {/* 4. Emergency Contact Details */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Emergency Contact (Family / Next of Kin)</span>
            </label>
            <input
              type="text"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="e.g. +91 98201 23456 (Father - Mr. Sharma)"
              className="w-full bg-[#070a14] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans shadow-inner"
            />
          </div>

          {/* 5. Special Notes */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Special Evacuation Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2nd floor apartment, elderly grandmother with me..."
              className="w-full bg-[#070a14] border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans shadow-inner"
            />
          </div>

          {/* Save Action */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-2.5 px-4 rounded-xl shadow-lg shadow-cyan-950 flex items-center justify-center gap-2 transition"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 text-cyan-300" />
                  <span>Save Emergency Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
