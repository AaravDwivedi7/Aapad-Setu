/**
 * Aapad Setu — Real-Time Adaptive Sonar Proximity Beeper Engine (Web Audio API)
 * Synthesizes dynamic acoustic sonar chirps whose pulse frequency, pitch, and
 * haptic vibration intervals scale mathematically as 2 devices approach in real life.
 */

export interface SonarFeedbackState {
  isPlaying: boolean;
  distanceMeters: number;
  currentIntervalMs: number;
  currentPitchHz: number;
  proximityCategory: 'IMMEDIATE' | 'NEAR' | 'FAR' | 'LOST';
}

export class SonarAudioEngine {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private pulseTimer: any = null;
  private currentDistance: number = 25.0;
  private isRunning: boolean = false;
  private onPulseCallback: ((pulse: { pitch: number; distance: number }) => void) | null = null;

  constructor(onPulse?: (pulse: { pitch: number; distance: number }) => void) {
    if (onPulse) this.onPulseCallback = onPulse;
  }

  private initContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Calculates the beep interval in milliseconds based on distance in meters.
   * Distance <= 1m -> 90ms (Rapid SOS chirp)
   * Distance = 5m -> 300ms
   * Distance = 15m -> 750ms
   * Distance >= 35m -> 1600ms
   */
  public calculateIntervalMs(distance: number): number {
    if (distance <= 0.8) return 80;
    if (distance <= 1.5) return 130;
    if (distance <= 3.0) return 220;
    if (distance <= 6.0) return 360;
    if (distance <= 12.0) return 600;
    if (distance <= 20.0) return 900;
    if (distance <= 30.0) return 1300;
    return 1800;
  }

  /**
   * Calculates pitch frequency (Hz) based on distance.
   * Closer -> Higher pitch (urgency acoustic cue).
   */
  public calculatePitchHz(distance: number): number {
    if (distance <= 1.0) return 1320; // High urgent C6
    if (distance <= 3.0) return 1100;
    if (distance <= 6.0) return 950;
    if (distance <= 12.0) return 820;
    if (distance <= 20.0) return 700;
    if (distance <= 30.0) return 600;
    return 520;
  }

  /**
   * Plays a single sonar pulse burst with dual harmonic overtone and exponential envelope
   */
  public emitSinglePulse(distance: number) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const pitch = this.calculatePitchHz(distance);
      const duration = distance <= 2.0 ? 0.045 : 0.075;

      // Primary Oscillator (Fundamental frequency)
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // Harmonic Oscillator (Adds crisp tactical radar sonar acoustic presence)
      const subOsc = this.audioCtx.createOscillator();
      const subGain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      // Slight downward chirp sweep for tactical radar feel
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.85, now + duration);

      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(pitch * 1.5, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.28, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.exponentialRampToValueAtTime(0.12, now + 0.008);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      subOsc.connect(subGain);
      gain.connect(this.audioCtx.destination);
      subGain.connect(this.audioCtx.destination);

      osc.start(now);
      subOsc.start(now);
      osc.stop(now + duration + 0.02);
      subOsc.stop(now + duration + 0.02);

      // Hardware haptic vibration for mobile proximity (if supported)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        if (distance <= 1.5) {
          navigator.vibrate([60, 30, 60]);
        } else if (distance <= 5.0) {
          navigator.vibrate(50);
        }
      }

      if (this.onPulseCallback) {
        this.onPulseCallback({ pitch, distance });
      }
    } catch (e) {
      console.warn('Sonar audio pulse error:', e);
    }
  }

  /**
   * Updates current target distance and dynamically reschedules the interval.
   * Automatically starts sonar beeping when distance <= 20m and pauses when > 20m.
   */
  public updateDistance(distance: number) {
    this.currentDistance = Math.max(0.2, distance);
    if (this.currentDistance <= 20.0) {
      if (!this.isRunning) {
        this.start(this.currentDistance);
      } else {
        this.rescheduleLoop();
      }
    } else {
      if (this.isRunning) {
        this.stop();
      }
    }
  }

  public unlockAudioContext() {
    this.initContext();
  }

  private rescheduleLoop() {
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    if (!this.isRunning) return;

    const interval = this.calculateIntervalMs(this.currentDistance);
    this.emitSinglePulse(this.currentDistance);

    this.pulseTimer = setTimeout(() => {
      this.rescheduleLoop();
    }, interval);
  }

  public start(initialDistance = 25.0) {
    this.currentDistance = initialDistance;
    this.isRunning = true;
    this.initContext();
    this.rescheduleLoop();
  }

  public stop() {
    this.isRunning = false;
    if (this.pulseTimer) {
      clearTimeout(this.pulseTimer);
      this.pulseTimer = null;
    }
  }

  public destroy() {
    this.stop();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close().catch(() => {});
      } catch (e) {}
      this.audioCtx = null;
    }
  }

  public getStatus(): SonarFeedbackState {
    return {
      isPlaying: this.isRunning && !this.isMuted,
      distanceMeters: this.currentDistance,
      currentIntervalMs: this.calculateIntervalMs(this.currentDistance),
      currentPitchHz: this.calculatePitchHz(this.currentDistance),
      proximityCategory: this.currentDistance <= 1.5 ? 'IMMEDIATE' : this.currentDistance <= 6.0 ? 'NEAR' : 'FAR'
    };
  }
}
