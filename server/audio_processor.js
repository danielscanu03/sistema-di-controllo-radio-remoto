class MyProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'samplerate',
        defaultValue: 4096, // Default rate value
        minValue: 512,   // Minimum rate
        maxValue: 16384    // Maximum rate
      }
    ];
  }

  constructor() {
    super();
    this.bufferI255 = [];
    this.frameCounter = 0;
  }


  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const samplerate = parameters.samplerate[0];

    if (input && input.length > 0 && input[0] && input[0].length > 0) {
        const inputChannel = input[0];

        const normalizedI255 = inputChannel.map(sample =>
            Math.min(255, Math.max(0, Math.round((Math.max(-1, Math.min(1, sample)) + 1) * 127.5)))
        );

        this.bufferI255.push(...normalizedI255);
        this.frameCounter++;

        if (this.bufferI255.length >= samplerate) {
            this.port.postMessage({
                type: "int",
                data: this.bufferI255,
                timestamp: Date.now()
            });
            this.bufferI255 = []; // Retain excess data
            this.frameCounter = 0;
        }
    } else {
        console.warn("No valid audio input for this frame.");
    }

    return true;
}
}

registerProcessor('audio_processor', MyProcessor);