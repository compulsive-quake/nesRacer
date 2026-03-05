class NesAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 16384;
    this.ringL = new Float32Array(this.bufferSize);
    this.ringR = new Float32Array(this.bufferSize);
    this.readPos = 0;
    this.writePos = 0;

    this.port.onmessage = (e) => {
      const { left, right } = e.data;
      for (let i = 0; i < left.length; i++) {
        const next = (this.writePos + 1) % this.bufferSize;
        if (next !== this.readPos) {
          this.ringL[this.writePos] = left[i];
          this.ringR[this.writePos] = right[i];
          this.writePos = next;
        }
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;
    const left = output[0];
    const right = output[1];
    const frames = left.length;

    let rp = this.readPos;
    const wp = this.writePos;
    let i = 0;
    while (i < frames && rp !== wp) {
      left[i] = this.ringL[rp];
      right[i] = this.ringR[rp];
      rp = (rp + 1) % this.bufferSize;
      i++;
    }
    this.readPos = rp;
    while (i < frames) {
      left[i] = 0;
      right[i] = 0;
      i++;
    }
    return true;
  }
}

registerProcessor('nes-audio-processor', NesAudioProcessor);
