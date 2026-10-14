// Web Audio API Procedural Water Sound Synthesizer
// Generates realistic water drops, sphere splashes, and rain without external audio files.

class WaterSoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.6;
    this.masterGain = null;
    this.lastDropTime = 0;
    this.lastSplashTime = 0;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  // Gentle water droplet "plop" or "bloop"
  playDrop(strength = 0.5) {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (now - this.lastDropTime < 0.04) return; // rate limit
    this.lastDropTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Water bloop characteristic: frequency sweeps quickly upward then downward
    const baseFreq = 400 + Math.random() * 450;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 0.7, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.025);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.09);

    const amp = Math.min(0.3, Math.max(0.04, strength * 0.22));
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Deep resonant impact splash when the sphere enters water
  playSplash(intensity = 0.8) {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (now - this.lastSplashTime < 0.12) return; // rate limit
    this.lastSplashTime = now;

    // 1. Low frequency thud / water displacement
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);

    const thudAmp = Math.min(0.45, Math.max(0.1, intensity * 0.35));
    oscGain.gain.setValueAtTime(thudAmp, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);

    // 2. Filtered noise splash burst
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(250, now + 0.25);
    filter.Q.setValueAtTime(2.5, now);

    const noiseGain = this.ctx.createGain();
    const noiseAmp = Math.min(0.35, Math.max(0.05, intensity * 0.25));
    noiseGain.gain.setValueAtTime(noiseAmp, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.3);

    // 3. Secondary droplets shortly after
    setTimeout(() => {
      this.playDrop(intensity * 0.6);
    }, 70);
    setTimeout(() => {
      this.playDrop(intensity * 0.4);
    }, 140);
  }
}

window.waterAudio = new WaterSoundEngine();
