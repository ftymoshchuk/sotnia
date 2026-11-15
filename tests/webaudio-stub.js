'use strict';
/* A stand-in for the Web Audio API, for running the music's scheduling outside a browser. It makes
 * no sound. It keeps the rules a browser enforces where breaking them throws: times that are not
 * finite or are below zero, sources started twice, empty buffers, exponential ramps to zero, and
 * any automation that lands inside a value curve's span. The game catches a throw from the music,
 * so in the browser a broken rule would only mean silence; here it fails a test. */

class Param {
  constructor(value) { this.value = value; this.events = []; }
  add(type, time, extra) {
    if (!Number.isFinite(time) || time < 0) throw new RangeError(`${type} at ${time}`);
    for (const e of this.events) {
      if (e.type === 'curve' && time >= e.time && time < e.time + e.duration) throw new Error(`NotSupportedError: ${type} at ${time} is inside a curve from ${e.time} for ${e.duration} s`);
    }
    this.events.push(Object.assign({ type, time }, extra));
    return this;
  }
  setValueAtTime(v, t) { if (!Number.isFinite(v)) throw new TypeError(`value ${v}`); return this.add('set', t, { v }); }
  linearRampToValueAtTime(v, t) { if (!Number.isFinite(v)) throw new TypeError(`value ${v}`); return this.add('linear', t, { v }); }
  exponentialRampToValueAtTime(v, t) { if (!Number.isFinite(v) || v === 0) throw new RangeError(`exponential ramp to ${v}`); return this.add('exp', t, { v }); }
  setTargetAtTime(v, t, c) { if (!Number.isFinite(v)) throw new TypeError(`value ${v}`); if (!(c >= 0)) throw new RangeError(`time constant ${c}`); return this.add('target', t, { v, c }); }
  setValueCurveAtTime(values, t, d) {
    if (!(d > 0)) throw new RangeError(`curve lasting ${d}`);
    if (values.length < 2) throw new Error(`InvalidStateError: a curve of ${values.length} values`);
    for (const x of values) if (!Number.isFinite(x)) throw new TypeError(`curve value ${x}`);
    for (const e of this.events) if (e.time > t && e.time < t + d) throw new Error(`NotSupportedError: a curve from ${t} for ${d} s over an event at ${e.time}`);
    return this.add('curve', t, { duration: d });
  }
  cancelScheduledValues(t) { if (!(t >= 0)) throw new RangeError(`cancel at ${t}`); this.events = this.events.filter(e => e.time < t); return this; }
}
class AudioNode {
  constructor(ctx) { this.context = ctx; this.outputs = []; ctx.nodes++; }
  connect(target) {
    if (!target || (!(target instanceof AudioNode) && !(target instanceof Param))) throw new TypeError('connect to something that is not a node or a parameter');
    this.outputs.push(target);
    return target;
  }
  disconnect() { this.outputs = []; }
}
class Source extends AudioNode {
  start(t = 0, offset = 0) {
    if (this.startedAt !== undefined) throw new Error('InvalidStateError: started twice');
    if (!(t >= 0) || !(offset >= 0)) throw new RangeError(`start at ${t}, offset ${offset}`);
    this.startedAt = t; this.context.started.push(this);
  }
  stop(t = 0) {
    if (this.startedAt === undefined) throw new Error('InvalidStateError: stopped before it was started');
    if (!(t >= 0)) throw new RangeError(`stop at ${t}`);
    this.stoppedAt = Math.min(this.stoppedAt === undefined ? Infinity : this.stoppedAt, t);
  }
}
class Oscillator extends Source {
  constructor(ctx) { super(ctx); this.frequency = new Param(440); this.detune = new Param(0); this.type = 'sine'; }
  setPeriodicWave(w) { if (!w || !w.imag) throw new TypeError('not a periodic wave'); this.wave = w; this.type = 'custom'; }
}
class BufferSource extends Source { constructor(ctx) { super(ctx); this.buffer = null; this.playbackRate = new Param(1); } }
class Gain extends AudioNode { constructor(ctx) { super(ctx); this.gain = new Param(1); } }
class Biquad extends AudioNode { constructor(ctx) { super(ctx); this.type = 'lowpass'; this.frequency = new Param(350); this.Q = new Param(1); this.gain = new Param(0); } }
class Panner extends AudioNode { constructor(ctx) { super(ctx); this.pan = new Param(0); } }
class Compressor extends AudioNode { constructor(ctx) { super(ctx); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) this[k] = new Param(0); } }
class Convolver extends AudioNode { constructor(ctx) { super(ctx); this.buffer = null; this.normalize = true; } }
class Buffer {
  constructor(channels, length, rate) {
    if (!(length > 0) || !(channels > 0)) throw new RangeError(`a buffer of ${channels} channels and ${length} frames`);
    this.numberOfChannels = channels; this.length = length; this.sampleRate = rate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }
  getChannelData(i) { return this.data[i]; }
}
class AudioContext {
  constructor(rate = 48000) { this.sampleRate = rate; this.currentTime = 0; this.state = 'running'; this.nodes = 0; this.started = []; this.destination = new AudioNode(this); }
  createGain() { return new Gain(this); }
  createOscillator() { return new Oscillator(this); }
  createBufferSource() { return new BufferSource(this); }
  createBiquadFilter() { return new Biquad(this); }
  createStereoPanner() { return new Panner(this); }
  createDynamicsCompressor() { return new Compressor(this); }
  createConvolver() { return new Convolver(this); }
  createBuffer(channels, length, rate) { return new Buffer(channels, length, rate); }
  createPeriodicWave(real, imag) {
    if (real.length !== imag.length || real.length < 2) throw new Error('IndexSizeError: the harmonics do not match');
    for (const x of imag) if (!Number.isFinite(x)) throw new TypeError(`harmonic ${x}`);
    return { real, imag };
  }
}

module.exports = { AudioContext };
