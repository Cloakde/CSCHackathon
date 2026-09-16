// One audible path stays outside this processor. Its output is intentionally silent.
class LecturePcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(Math.ceil(sampleRate / 10));
    this.used = 0;
    this.pending = 0;
    this.failed = false;
    this.port.onmessage = () => {
      this.pending = Math.max(0, this.pending - 1);
    };
  }
  process(inputs) {
    if (this.failed) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] ?? 0;
      this.samples[this.used++] = sample / channels.length;
      if (this.used === this.samples.length) {
        if (this.pending >= 2) {
          this.failed = true;
          this.port.postMessage({ overflow: true });
          return false;
        }
        this.port.postMessage(this.samples, [this.samples.buffer]);
        this.samples = new Float32Array(Math.ceil(sampleRate / 10));
        this.used = 0;
        this.pending++;
      }
    }
    return true;
  }
}
registerProcessor("lecture-pcm", LecturePcmProcessor);
