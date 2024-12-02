/**
 * A simple audio pipe that allows you to push audio data to the audio output.
 * Will allow you to sequentially play audio data.
 */
export class AudioPipe {
    constructor() {
        this.initialized = false;
        this.nextAvailableTime = 0;
        this.gain = 1;
    }

    /**
     * Initializes the audio pipe by creating an AudioContext.
     */
    initialize() {
        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.value = this.gain;
        this.initialized = true;
    }

    /**
     * @returns {number} The volume of the audio pipe [0,1].
     */
    get volume() {
        return this.gain;
    }

    /**
     * Sets the volume of the audio pipe.
     *
     * @param {number} value - The volume of the audio pipe [0,1].
     */
    set volume(value) {
        if (this.initialized) {
            // Change volume [0,1] to gain [-1,1]
            this.gainNode.gain.value = 2 * value - 1;
        }
        this.gain = value;
    }

    /**
     * Pushes audio data to the audio output.
     *
     * @param {Float32Array} data - The audio data to play.
     * @param {number} [sampleRate=48000] - The sample rate of the audio data.
     */
    push(data, sampleRate = 48000) {
        if (!this.initialized) {
            this.initialize();
        }
        const audioBuffer = new AudioBuffer({
            length: data.length,
            numberOfChannels: 1,
            sampleRate: sampleRate
        });
        audioBuffer.copyToChannel(data, 0);
        const audioBufferNode = new AudioBufferSourceNode(
            this.audioContext,
            { buffer: audioBuffer }
        );
        audioBufferNode.connect(this.gainNode);
        audioBufferNode.start(this.nextAvailableTime);
        if (this.nextAvailableTime > this.audioContext.currentTime) {
            // There is already at least one scheduled node, so we need to update the next available time
            this.nextAvailableTime += audioBuffer.duration;
        } else {
            this.nextAvailableTime = this.audioContext.currentTime + audioBuffer.duration;
        }
        return audioBufferNode;
    }

    /**
     * Pushes silence to the audio output.
     *
     * @param {number} duration - The duration of the silence in seconds.
     * @param {number} [sampleRate=48000] - The sample rate of the silence.
     */
    pushSilence(duration, sampleRate = 48000) {
        if (!this.initialized) {
            return; // Don't initialize for silence
        }
        const data = new Float32Array(Math.floor(duration * sampleRate));
        this.push(data, sampleRate);
    }

    /**
     * @returns {boolean} Whether the audio pipe is currently playing audio.
     */
    get playing() {
        if (!this.initialized) {
            return false;
        }
        return this.audioContext.currentTime < this.nextAvailableTime;
    }
}
