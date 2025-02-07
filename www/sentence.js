/**
 * A class that helps with chunking streaming responing
 * from an LLM into whole sentences (or as close as we can get).
 */
export class SentenceChunker {
    /**
     * @param {Object} options
     * @param {number} options.chunkLength - The maximum length of a chunk (default: 96)
     * @param {boolean} options.emitParagraphs - Whether to emit paragraphs as chunks (default: true)
     */
    constructor(options = {}) {
        this.buffer = "";
        this.chunkLength = options.chunkLength || 128;
        this.emitParagraphs = options.emitParagraphs !== false;
        this.callbacks = [];
    }

    /**
     * Emit a chunk of text
     * @param {string} output - The chunk of text to emit
     */
    emit(output) {
        output = output.trim();
        if (output.replace(/\W/g, "").length === 0) {
            return;
        }
        this.callbacks.forEach(cb => cb(output));
    }

    /**
     * Register a callback to be called when a chunk is emitted
     * @param {Function} callback - The callback to call
     */
    onChunk(callback) {
        this.callbacks.push(callback);
    }

    /**
     * Push new data into the chunker
     * @param {string} data - The new data to push
     */
    push(data) {
        let paragraphs = data.split(/(\n+)/);
        let numParagraphs = paragraphs.length;
        for (let i = 0; i < numParagraphs; i++) {
            let paragraph = paragraphs[i];
            if (!paragraph) {
                continue;
            }
            let sentences = paragraph.split(/(?<=[;:,.!?]\s+)|(?<=[；：，。！？])/);
            let bufferLength = this.buffer.length;
            for (let sentence of sentences) {
                let sentenceLength = sentence.length;
                if (sentenceLength === 0) {
                    continue;
                }
                if (bufferLength + sentenceLength <= this.chunkLength) {
                    this.buffer += sentence;
                    bufferLength += sentenceLength;
                } else {
                    if (bufferLength > 0) {
                        this.emit(this.buffer);
                    }
                    this.buffer = sentence;
                    bufferLength = sentenceLength;
                }
            }

            if (this.emitParagraphs && numParagraphs > 1 && i < numParagraphs - 1) {
                this.emit(this.buffer);
                this.buffer = "";
            }
        }
    }

    /**
     * Flush the buffer, emitting any remaining text
     */
    flush() {
        if (this.buffer.length > 0) {
            this.emit(this.buffer);
            this.buffer = "";
        }
    }
}

/**
 * A SentenceChunker that can handle streaming responses that grow over time
 * (e.g. when the LLM is still generating a response and concatenating it to the previous response)
 */
export class GrowingSentenceChunker extends SentenceChunker {
    constructor(options = {}) {
        super(options);
        this.partialSentence = "";
    }

    /**
     * Push new data into the chunker
     * @param {string} data - The new data to push
     */
    push(data) {
        const newData = data.substring(this.partialSentence.length);
        this.partialSentence += newData;
        super.push(newData);
    }

    /**
     * Flush the buffer, emitting any remaining text
     */
    flush() {
        super.flush();
        this.partialSentence = "";
    }
}
