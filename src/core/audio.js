export class AmbientAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.source = null;
    this.drone = null;
    this.playing = false;
  }

  init() {
    if (this.context) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);

    const seconds = 4;
    const length = this.context.sampleRate * seconds;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      channel[i] = last * 3.2;
    }

    this.source = this.context.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 430;
    filter.Q.value = 0.4;

    const noiseGain = this.context.createGain();
    noiseGain.gain.value = 0.16;
    this.source.connect(filter).connect(noiseGain).connect(this.master);

    this.drone = this.context.createOscillator();
    this.drone.type = 'sine';
    this.drone.frequency.value = 110;
    const droneGain = this.context.createGain();
    droneGain.gain.value = 0.018;
    this.drone.connect(droneGain).connect(this.master);

    this.source.start();
    this.drone.start();
  }

  async toggle() {
    this.init();
    if (!this.context) return false;
    if (this.context.state === 'suspended') await this.context.resume();

    this.playing = !this.playing;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(this.playing ? 0.5 : 0, now + 0.55);
    return this.playing;
  }

  setEnabled(enabled) {
    if (this.playing !== enabled) this.toggle();
  }
}
