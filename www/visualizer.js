import { AudioPipe } from "./audio.js";

/**
 * AudioPipeVisualizer
 *
 * Class to handle streaming audio data to the browser's audio context
 * Also draws the audio waveform on a canvas if provided
 */
export class AudioPipeVisualizer extends AudioPipe {
    /**
     * Constructor
     * @param {Object} options - Options object
     * @param {HTMLCanvasElement} options.canvas - Canvas element to draw the waveform
     * @param {Number} options.lineWidth - Line width for the waveform
     * @param {Number} options.fftSize - FFT size for the waveform
     * @param {String} options.fillStyle - Fill style for the waveform
     * @param {String} options.strokeStyle - Stroke style for the waveform
     */
    constructor(options = {}) {
        super(options);
        this.canvas = options.canvas || null;
        this.lineWidth = options.lineWidth || 1;
        this.fftSize = options.fftSize || 2048;
        this.fillStyle = options.fillStyle || "#FFFFFF";
        this.strokeStyle = options.strokeStyle || "#000000";
        this.waveformNoiseLevel = options.waveformNoiseLevel || 0; // Only for waveform, a visual distortion for style
        this.fftBuffer = new Uint8Array(this.fftSize);
        this.startDrawing();
    }

    /**
     * Get the waveform styles for the canvas.
     * We let the user pass in multiple styles (colors) or widths to draw the waveform.
     * This allows for stacking or glowing effects, if desired.
     * @returns {Array} - Array of styles for the waveform
     */
    waveformStyles() {
        let strokeStyle = this.strokeStyle;
        let lineWidth = this.lineWidth;
        if (!Array.isArray(strokeStyle)) {
            strokeStyle = [strokeStyle];
        }
        if (!Array.isArray(lineWidth)) {
            lineWidth = [lineWidth];
        }
        let numStrokes = Math.max(strokeStyle.length, lineWidth.length);
        let styles = [];
        for (let i = 0; i < numStrokes; i++) {
            styles.push({
                strokeStyle: strokeStyle[Math.min(i, strokeStyle.length - 1)],
                lineWidth: lineWidth[Math.min(i, lineWidth.length - 1)]
            });
        }
        return styles;
    }

    push(data, sampleRate = 44100) {
        let audioBuffer = super.push(data, sampleRate);
        audioBuffer.connect(this.analyser);
        return audioBuffer;
    }

    /**
     * Initialize the analyzer to draw the waveform on the canvas.
     */
    initialize() {
        super.initialize();
        // Create analyser
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.connect(this.audioContext.destination);
    }

    /**
     * Starts drawing the waveform on the canvas.
     * If the audio context is not initialized, will draw as if there was silence.
     */
    startDrawing() {
        const context = this.canvas.getContext("2d");
        const sliceWidth = this.canvas.width / this.fftSize;
        context.fillStyle = this.fillStyle;
        const draw = () => {
            // Update data
            this.analyser !== undefined && this.analyser.getByteTimeDomainData(this.fftBuffer);
            // Clear the canvas
            context.fillRect(0, 0, this.canvas.width, this.canvas.height);
            // Start drawing the waveform
            let x = 0;
            context.beginPath();
            for (let i = 0; i < this.fftSize; i++) {
                let v = this.initialized ? this.fftBuffer[i] / 128.0 : 1;
                // Scale v's distance from 1.0 by the volume
                let distance = Math.abs(v - 1.0);
                v = 1.0 + (distance * this.volume * Math.sign(v - 1.0));
                if (this.waveformNoiseLevel > 0) {
                    v += (Math.random() - 0.5) * this.waveformNoiseLevel * 2 * Math.sin(i / this.fftSize * Math.PI) * this.volume;
                }
                const y = v * this.canvas.height / 2;
                if (i === 0) {
                    context.moveTo(x, y);
                } else {
                    context.lineTo(x, y);
                }

                x += sliceWidth;
            }
            // Final line to the right
            context.lineTo(this.canvas.width, this.canvas.height / 2);
            // Stroke the path using all strokes
            for (let style of this.waveformStyles()) {
                context.strokeStyle = style.strokeStyle;
                context.lineWidth = style.lineWidth;
                context.stroke();
            }
            // Schedule next frame
            requestAnimationFrame(draw);
        };
        // Start drawing
        requestAnimationFrame(draw);
    }
};
