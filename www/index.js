/** @module index */
import { AudioPipeVisualizer } from "./visualizer.js";
import { GrowingSentenceChunker } from "./sentence.js";
import { sendAlert } from "./alert.js";
import { hexToRgb, replaceQuotes } from "./helpers.js";

// Global configuration
const documentStyle = window.getComputedStyle(document.body);
const primaryColor = documentStyle.getPropertyValue("--color-primary");
const [pR, pG, pB] = hexToRgb(primaryColor);
const [dpR, dpG, dpB] = [
    Math.max(0, pR - 96),
    Math.max(0, pG - 96),
    Math.max(0, pB - 96),
];
const pollingInterval = 150;
const transcriptionParameters = {};
const languageParameters = {
    role: "anachrovox",
    stream: true,
    use_tools: true,
    max_tokens: 1024,
    return_tool_metadata: true,
};
const speechParameters = {
    enhance: true,
    output_format: "float"
};
const waveformParameters = {
    waveformNoiseLevel: 0.025,
    fftSize: 512,
    fillStyle: "rgba(8,16,14,0.3)",
    strokeStyle: [
        `rgba(${dpR},${dpG},${dpB},0.1)`,
        `rgba(${pR},${pG},${pB},0.75)`,
        "rgba(255,255,255,0.6)"
    ],
    lineWidth: [6,3,1],
};
const speakerHoleRings = [ // radius, number of holes
    [18, 6],
    [36, 10],
    [52, 14],
    [70, 18],
    [88, 22],
];
const maxTypingSpeed = 200; // characters per second
const minTypingSpeed = 50;
const maxDelay = 0.5; // max length to delay from completion to wait for speech to start generating

let overseerAddress;

if (window.location.port === "3000") {
    // Development (e.g. npm start)
    overseerAddress = "ws://localhost:32189";
} else {
    // Docker or production
    if (window.location.protocol === "https:") {
        overseerAddress = `wss://${window.location.host}/overseer`;
    } else {
        overseerAddress = `ws://${window.location.host}/overseer`;
    }
}
const sharedModelRoot = "https://huggingface.co/benjamin-paine/hey-buddy/resolve/main/pretrained";
const wakeWordModelRoot = "https://huggingface.co/benjamin-paine/anachrovox/resolve/main";
const wakeWordPrefixes = [
    "hello", "hey", "hi", "so","well",
    "yo", "okay", "thanks", "thank-you",
];
const heyBuddyConfiguration = {
    record: true,
    modelPath: [
        `${wakeWordModelRoot}/vox.onnx`,
        `${wakeWordModelRoot}/anachrovox.onnx`
    ].concat(
        wakeWordPrefixes.map(
            (prefix) => `${wakeWordModelRoot}/${prefix}-vox.onnx`
        )
    ),
    vadModelPath: `${sharedModelRoot}/silero-vad.onnx`,
    embeddingModelPath: `${sharedModelRoot}/speech-embedding.onnx`,
    spectrogramModelPath: `${sharedModelRoot}/mel-spectrogram.onnx`,
    wakeWordThreshold: 0.8,
};

// Get elements from the page
const transcriptionSection = document.querySelector("#transcription #content #history");
const waveformCanvas = document.querySelector("#waveform canvas");
const promptInput = document.getElementById("prompt");
const temperature = document.getElementById("temperature");
const topP = document.getElementById("top-p");
const minP = document.getElementById("min-p");
const topK = document.getElementById("top-k");
const topKDisplay = document.getElementById("top-k-display");
const voiceId = document.getElementById("voice-id");
const voiceIdWheel = document.getElementById("voice-id-wheel");
const speed = document.getElementById("speed");
const volume = document.getElementById("volume");
const speaker = document.getElementById("speaker");
const listening = document.getElementById("listening");
const recording = document.getElementById("recording");
const powerSwitch = document.getElementById("power-switch-input");
const listenButton = document.getElementById("listen");
const powerIndicator = document.getElementById("power");

// Build speaker hole (just cosmetic)
for (let [radius, holes] of speakerHoleRings) {
    for (let i = 0; i < holes; i++) {
        // Calculate hole position based on radius and angle
        const hole = document.createElement("div");
        const angle = i * 2 * Math.PI / holes;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        hole.style.left = `${x}px`;
        hole.style.top = `${y}px`;
        hole.classList.add("hole");
        speaker.appendChild(hole);
    }
}

// Global objects
const client = new Taproot(overseerAddress);
const audio = new AudioPipeVisualizer({...waveformParameters, canvas: waveformCanvas});
const chunker = new GrowingSentenceChunker({emitTrimmed: false});
const conversationHistory = [];

// Scroll to the bottom of the transcription section
const scrollToBottom = () => {
    if (transcriptionSection.parentElement.scrollHeight - transcriptionSection.parentElement.scrollTop - transcriptionSection.parentElement.offsetHeight < 80) {
        transcriptionSection.parentElement.scrollTop = transcriptionSection.parentElement.scrollHeight;
    }
}

// Helper methods for updating the page
const pushText = (text, className) => {
    text = replaceQuotes(text);
    const element = document.createElement("p");
    element.classList.add(className);
    element.textContent = text;
    transcriptionSection.appendChild(element);
    scrollToBottom();
    return element;
};

// Bind voice ID wheel to change voice ID
// This is the list of voices from Kokoro
const voiceMap = {
    "Adam": "male.en.us.adam",
    "Bella": "female.en.us.bella",
    "Emma": "female.en.gb.emma",
    "George": "male.en.gb.george",
    "Isabel": "female.en.gb.isabella",
    "Lewis": "male.en.gb.lewis",
    "Michael": "male.en.us.michael",
    "Nicole": "female.en.us.nicole",
    "Sarah": "female.en.us.sarah",
    "Skye": "female.en.us.sky",
};
const voiceNames = Object.keys(voiceMap);
const voiceIds = Object.values(voiceMap);
let voiceIndex = -1;
const setVoiceIndex = (newIndex) => {
    if (newIndex !== voiceIndex) {
        voiceId.value = voiceNames[newIndex];
        voiceId.dispatchEvent(new Event("change"));
        voiceIndex = newIndex;
    }
};
setVoiceIndex(Math.floor(Math.random() * voiceIds.length));
voiceIdWheel.addEventListener("click", () => {
    let newVoiceIndex = voiceIndex + parseInt(voiceIdWheel.value);
    if (newVoiceIndex < 0) newVoiceIndex = voiceIds.length - 1;
    setVoiceIndex(newVoiceIndex % voiceIds.length);
});

// Bind volume to update the audio volume
volume.addEventListener("change", (event) => {
    audio.volume = volume.value;
});

// Bind top-k to update the display
topK.addEventListener("change", (event) => {
    topKDisplay.value = Math.floor(topK.value);
    topKDisplay.dispatchEvent(new Event("change"));
});

// Getter functions for parameters
const getLanguageParameters = (overrides = {}) => {
    return {
        ...languageParameters,
        history: conversationHistory,
        top_k: parseInt(topK.value),
        top_p: parseFloat(topP.value),
        min_p: parseFloat(minP.value),
        temperature: parseFloat(temperature.value),
        ...overrides,
    };
};
const getSpeechParameters = (overrides = {}) => {
    return {
        ...speechParameters,
        speed: parseFloat(speed.value),
        voice: voiceMap[voiceId.value],
        ...overrides,
    };
};

let typingElement,
    typingStart,
    typingCharactersPerSecond = minTypingSpeed,
    typingTarget = "",
    typingAudioTiming = {},
    unsetWhenComplete = false,
    requestNumber = 0,
    interrupt = false;

// The loop for typing out the text
const typingLoop = () => {
    if (typingElement !== null && typingElement !== undefined) {
        const now = performance.now();
        const typingIndex = Math.floor((now - typingStart) * typingCharactersPerSecond / 1000);
        const targetTextLength = typingTarget.length;

        let typingAudioIndex = 0;
        let i = 0;
        let hasAudio = Object.getOwnPropertyNames(typingAudioTiming).length > 0;

        for (let [audioTime, [audioTextLength, audioDuration]] of Object.entries(typingAudioTiming)) {
            audioTime = parseFloat(audioTime);
            if (now >= audioTime + audioDuration) {
                // Audio has finished playing
                typingAudioIndex += audioTextLength;
            } else if (now >= audioTime) {
                // Currently playing audio
                typingAudioIndex += Math.floor((now - audioTime) * audioTextLength / audioDuration);
            }
            i++;
        }

        if (!interrupt && (typingIndex < targetTextLength || ((audio.volume > 0 || hasAudio) && typingAudioIndex < targetTextLength))) {
            let innerHTML = "";
            if (typingAudioIndex > 0) {
                innerHTML += `<span class="spoken">${typingTarget.substring(0, typingAudioIndex + 1)}</span>`;
                innerHTML += `<span class="unspoken">${typingTarget.substring(typingAudioIndex + 1, typingIndex)}</span>`;
            } else {
                innerHTML += `<span class="unspoken">${typingTarget.substring(0, typingIndex)}</span>`;
            }
            if (typingIndex < targetTextLength) {
                innerHTML += `<span class="cursor">|</span>`;
            }
            if (typingElement.innerHTML != innerHTML) {
                typingElement.innerHTML = innerHTML;
                scrollToBottom();
            }
        } else if (interrupt || unsetWhenComplete) {
            let finalHTML;
            if (hasAudio) {
                finalHTML = `<span class="spoken">${typingTarget}</span>`;
            } else {
                finalHTML = `<span class="unspoken">${typingTarget}</span>`;
            }
            typingElement.innerHTML = finalHTML;
            unsetWhenComplete = false;
            interrupt = false;
            typingElement = null;
            typingTarget = "";
            typingAudioTiming = {};
        }
    }
    requestAnimationFrame(typingLoop);
};
requestAnimationFrame(typingLoop);

// Callback for when a sentence is completed
chunker.onChunk(async (chunk) => {
    let isFirst = false;
    let requestNumberAtStart = requestNumber;
    if (typingElement !== null && typingElement !== undefined) {
        typingTarget += replaceQuotes(chunk).replaceAll(/\n\W*/g, "\n");
    } else {
        isFirst = true;
        typingElement = pushText("", "completion");
        typingTarget = replaceQuotes(chunk).replaceAll(/\n\W*/g, "\n");
        typingStart = performance.now();
        typingAudioTiming = {};
    }

    if (audio.volume > 0 && !interrupt) {
        typingCharactersPerSecond = minTypingSpeed;
        let audioEndTypingIndex = typingTarget.length;
        let audioResult = await client.invoke({
            task: "speech-synthesis",
            parameters: getSpeechParameters({text: chunk}),
        });
        if (interrupt || requestNumberAtStart !== requestNumber) {
            return;
        }
        if (audio.playing) {
            audio.pushSilence(0.15);
        }

        let audioReady = performance.now();
        let audioNode = audio.push(audioResult.data);
        let audioDuration = audioNode.buffer.duration * 1000;

        if (isFirst) {
            typingAudioTiming[audioReady] = [chunk.length, audioDuration];
        } else {
            // Queue the audio speed for the next sentence
            let lastAudioStartTime = Math.max(...Object.keys(typingAudioTiming));
            let [lastAudioLength, lastAudioDuration] = typingAudioTiming[lastAudioStartTime];
            let thisAudioTiming = Math.max(lastAudioStartTime + lastAudioDuration + (isFirst ? 0 : 0.15), audioReady);
            typingAudioTiming[thisAudioTiming] = [chunk.length, audioDuration];
        }
    } else {
        typingCharactersPerSecond = maxTypingSpeed;
    }
        
});

// Callback when transcription and completion are done
const finalizeResult = (prompt, result) => {
    interrupt = false;
    unsetWhenComplete = true;
    chunker.push(result.result);
    chunker.flush();
    conversationHistory.push(prompt);
    conversationHistory.push(result.result);

    if (result.function) {
        let usedToolContainer = document.createElement("p");
        usedToolContainer.classList.add("tool");
        usedToolContainer.innerText = "Used tool: ";
        let usedToolFunction = document.createElement("span");
        usedToolFunction.innerText = result.function.name;
        usedToolFunction.title = result.function.arguments;
        usedToolContainer.appendChild(usedToolFunction);
        transcriptionSection.appendChild(usedToolContainer);
        if (result.citations) {
            for (let i = 0; i < result.citations.length; i++) {
                let citation = result.citations[i];
                let citationContainer = document.createElement("p");
                citationContainer.classList.add("citation");
                let citationLabel = citation.title
                     ? citation.title
                     : citation.source
                        ? citation.source
                        : "";
                if (citationLabel) {
                    citationContainer.innerText = `${citationLabel} `;
                } else {
                    citationContainer.innerText = "Source ";
                }
                let citationLink = document.createElement("a");
                citationLink.href = citation.url;
                citationLink.innerText = `[${i + 1}]`;
                citationLink.title = citation.url;
                citationLink.target = "_blank";
                citationContainer.appendChild(citationLink);
                transcriptionSection.appendChild(citationContainer);
            }
        }
    }
};

// Create a function to invoke the appropriate workflow based on the current state
const invokeFromMicrophone = async (samples) => {
    requestNumber++;
    interrupt = true;
    let prompt;
    try {
        const textResult = await client.invoke(
            {
                task: "audio-transcription",
                parameters: {audio: samples},
                continuation: {
                    task: "text-generation",
                    parameters: getLanguageParameters(),
                    result_parameters: "prompt",
                }
            },
            {
                fetchIntermediates: true,
                pollingInterval: pollingInterval,
                onInterimResult: (result) => {
                    prompt = result;
                    pushText(result, "transcription");
                },
                onIntermediateResult: (result) => {
                    interrupt = false;
                    chunker.push(result);
                }
            }
        );
        finalizeResult(prompt, textResult);
    } catch (error) {
        console.error(error);
        sendAlert(error);
    }
};
const invokeFromPrompt = async (text) => {
    requestNumber++;
    interrupt = true;
    pushText(text, "transcription");
    try {
        const inferenceResult = await client.invoke(
            {
                task: "text-generation",
                parameters: getLanguageParameters({prompt: text}),
            },
            {
                fetchIntermediates: true,
                pollingInterval: pollingInterval,
                onIntermediateResult: (result) => {
                    interrupt = false;
                    chunker.push(result);
                }
            }
        );
        finalizeResult(text, inferenceResult);
    } catch (error) {
        console.error(error);
        sendAlert(error);
    }
};

// Configure power button to disable everything
powerSwitch.addEventListener("change", (event) => {
    if (powerSwitch.checked) {
        powerIndicator.classList.add("active");
    } else {
        powerIndicator.classList.remove("active");
        listening.classList.remove("active");
        recording.classList.remove("active");
    }
});
powerSwitch.dispatchEvent(new Event("change"));

// Configure HeyBuddy for audio recording and invocation
if (!window.HeyBuddy) {
    console.error("HeyBuddy not found. Please include HeyBuddy.js in your project.");
} else {
    const heyBuddy = new window.HeyBuddy(heyBuddyConfiguration);
    heyBuddy.onProcessed(async (result) => {
        let highestWakeWord = null, highestProbability = 0;
        for (let wakewordName in result.wakeWords) {
            let probability = result.wakeWords[wakewordName].probability;
            if (probability > highestProbability) {
                highestWakeWord = wakewordName;
                highestProbability = probability;
            }
        }
    });
    heyBuddy.onRecording(async (samples) => {
        if (powerSwitch.checked) {
            await invokeFromMicrophone(samples);
        }
    });
    heyBuddy.onProcessed((result) => {
        if (powerSwitch.checked) {
            if (result.recording) {
                recording.classList.add("active");
            } else {
                recording.classList.remove("active");
            }
            if (result.listening) {
                listening.classList.add("active");
            } else {
                listening.classList.remove("active");
            }
        }
    });
    const startEvents = ["mousedown", "touchstart"];
    const stopEvents = ["mouseup", "touchend", "mouseleave"];
    const startListening = () => {
        const interval = setInterval(() => {
            heyBuddy.negatives = 0;
            heyBuddy.listening = true;
            heyBuddy.recording = true;
        }, 10);
        const onStop = () => {
            clearInterval(interval);
            for (let event of stopEvents) {
                window.removeEventListener(event, onStop);
            }
        }
        for (let event of stopEvents) {
            window.addEventListener(event, onStop);
        }
    };
    for (let event of startEvents) {
        listenButton.addEventListener(event, startListening);
    }
}

// Bind the prompt input to the workflow
promptInput.addEventListener("keypress", async (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        const text = promptInput.value;
        // Wait a tick so the invocation doesn't send the new prompt as history
        promptInput.value = "";
        await invokeFromPrompt(text);
    }
});
