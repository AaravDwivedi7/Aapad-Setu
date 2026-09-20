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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 animate-in fade-in duration-150 overflow-y-auto font-sans">
      <div className="bg-[#1A222D] border border-[#2D3848] rounded-xl p-5 sm:p-6 max-w-lg w-full text-left relative my-auto shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#0B0F15] text-[#94A3B8] hover:text-white border border-[#2D3848] hover:bg-[#2D3848] transition"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-[#2D3848] pb-4 mb-4">
          <div className="p-2.5 rounded-lg bg-[#DC2626] text-white">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <span className="bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              Offline Triage Readiness
            </span>
            <h2 className="text-lg font-bold text-[#F1F5F9] mt-1">
              Emergency Medical &amp; Identity Profile
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Broadcast to rescuers during SOS to ensure immediate, life-saving medical triage.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* 1. Full Name */}
          <div>
            <label className="block text-[#F1F5F9] font-bold mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#D97706]" />
              <span>Full Name <span className="text-[#DC2626]">*</span></span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma, Ananya Verma..."
              className="w-full bg-[#0B0F15] border border-[#2D3848] rounded-lg px-3.5 py-2.5 text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#D97706] font-sans"
            />
            <p className="text-[10px] text-[#94A3B8] mt-1 font-mono">
              Rescuers and responders will address you by this name upon arrival.
            </p>
          </div>

          {/* 2. Blood Group */}
          <div>
            <label className="block text-[#F1F5F9] font-bold mb-1.5 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#DC2626]" />
              <span>Blood Group</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {BLOOD_GROUPS.map((bg) => (
                <button
                  type="button"
                  key={bg}
                  onClick={() => setBloodGroup(bg)}
                  className={`py-2 px-1 rounded-lg font-mono font-bold text-center border transition ${
                    bloodGroup === bg
                      ? 'bg-[#DC2626] text-white border-[#DC2626]'
                      : 'bg-[#0B0F15] text-[#94A3B8] border-[#2D3848] hover:border-[#94A3B8] hover:text-white'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Chronic Health Issues & Medical Allergies */}
          <div>
            <label className="block text-[#F1F5F9] font-bold mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
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
                    className={`text-[10px] font-sans px-2.5 py-1 rounded-md border transition ${
                      active
                        ? 'bg-[#D97706]/20 text-[#D97706] border-[#D97706] font-bold'
                        : 'bg-[#0B0F15] text-[#94A3B8] border-[#2D3848] hover:text-white'
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
              className="w-full bg-[#0B0F15] border border-[#2D3848] rounded-lg px-3.5 py-2 text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#D97706] font-sans resize-none"
            />
          </div>

          {/* 4. Emergency Contact Details */}
          <div>
            <label className="block text-[#F1F5F9] font-bold mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Emergency Contact (Family / Next of Kin)</span>
            </label>
            <input
              type="text"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="e.g. +91 98201 23456 (Father - Mr. Sharma)"
              className="w-full bg-[#0B0F15] border border-[#2D3848] rounded-lg px-3.5 py-2.5 text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#16A34A] font-sans"
            />
          </div>

          {/* 5. Special Notes */}
          <div>
            <label className="block text-[#94A3B8] font-medium mb-1">
              Special Evacuation Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2nd floor apartment, elderly grandmother with me..."
              className="w-full bg-[#0B0F15] border border-[#2D3848] rounded-lg px-3.5 py-2 text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#2D3848] font-sans"
            />
          </div>

          {/* Save Action */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-[#2D3848] hover:bg-[#3B485C] text-[#F1F5F9] font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4 text-white" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 text-white" />
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
