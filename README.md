<div align="center">
<img src="https://github.com/user-attachments/assets/0475ffc2-91e6-47f7-a8c3-6bb9b6b54369" /><br />
<em>Real-time Hands-Free AI Voice Chat with a Retro Vibe</em>
</div>

# Running

This requires the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html).

```sh
docker pull ghcr.io/painebenjamin/anachrovox:latest
docker run --rm -it --runtime nvidia --gpus all -p 7860:7860 ghcr.io/painebenjamin/anachrovox:latest
```

You can now access the UI at http://localhost:7860.

# Usage

To issue a voice command in a hands-free fashion, start your command with one of the supported wake phrases, then issue your command naturally (i.e. you do not need to pause.) There are many supported wake phrases but they all include 'Vox' - for example, 'Hey Vox', 'Hi Vox', or just 'Vox'.

There are numerous ways to shortcut the speech-to-speech workflow:

*   Turning the volume all the way down will disable the text-to-speech step, effectively creating a text-only mode.
*   Directly type your query into the text box and press enter to issue commands without needing to speak.
*   Press and hold the call button to issue a voice command without needing to use a wake phrase.

# About

Anachrovox is a real-time voice assistant that combines two of my other projects:

1.  [Taproot](https://github.com/painebenjamin/taproot), a scalable and lightning-fast task-centric backend inference engine, enabling easy installation and deployment of models for speech recognition, natural language understanding, and text-to-speech synthesis.
2.  [Hey Buddy](https://github.com/painebenjamin/hey-buddy), a real-time in-browser audio wake-word detector and training library to listen for wake phrases to trigger the assistant, enabling hands-free, always-on voice interaction without the need to use the backend until specifically requested.

This is an **alpha** release of both Anachrovox and the underlying libraries, so bugs in all aspects of operation are expected. As it uses a large language model at it's heart, you should take the same precautions as you would with any other language model, such as not using it for sensitive tasks and not trusting it's output as fact without verification.

# High Availability

In addition to Taproot's low-overhead design, it is designed to be clustered and highly available. This means that you can run multiple instances of Anachrovox and they will automatically load-balance and fail-over between each other, ensuring that the assistant is always available and responsive. You will need to perform some networking and configuration to enable this, see the GitHub repository for more information. If you are using Anachrovox on one of the official HuggingFace spaces, this is happening automatically between them.
## Features

The main feature of Anachrovox is real-time, hands-free speech-to-speech large language model interaction. This is achieved through the following components, all of which are open-source and available for use in your own projects:

1.  Wake-word detection using [Hey Buddy](https://github.com/painebenjamin/hey-buddy)
2.  Speech-to-text using [Distil-Whisper Large](https://huggingface.co/distil-whisper/distil-large-v3)
3.  Text generation using [Llama 3.2 3B Instruct](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct)
4.  Text-to-speech using [XTTS2](https://coqui.ai/blog/tts/open_xtts)
5.  Audio enhancement using [DeepFilterNet](https://github.com/Rikorose/DeepFilterNet)

All backend models are ran through Taproot, which is made to be as low-overhead as possible, allowing for real-time operation on consumer hardware. These are just a small selection of the supported model set, but were chosen for their balance of speed, size and capability. Visit [the Anachrovox GitHub](https://github.com/painebenjamin/anachrovox) to see how to build with different supported components and/or visit [the Taproot GitHub](https://github.com/painebenjamin/taproot) to request a new supported component or learn how to build your own (and hopefully contribute it back to the community!)

To improve the usefulness of the assistant, the following tools are available to use. These are invoked conversationally, either when you ask directly or sometimes when the assistant thinks it can help.

*   DuckDuckGo news headlines, blurb search, and deep-dive.
*   Wikipedia search
*   Fandom (formerly Wikia) search
*   Date and time by timezone or location
*   Current and forecasted weather by location

# Changing Models

⚠️ This will not work yet! ⚠️

*I still have to release a different package - I am working through one last bug with compatibility with HuggingFace and will release as soon as that is resolved. Until then, the build step will fail. I apologize for the inconvenience, in the meantime, you can still use the latest pre-build container from ghcr.io.*

Selecting new models from the catalog of supported models is simple; clone this repository, modify the `TEXT_MODEL`, `TRANSCRIBE_MODEL` or `SPEECH_MODEL` variables in the Dockerfile, then build the image with `docker build`.

To add a new supported model, you can either add the task to your environment and import it when running with `--add-import` like how this repository adds the anachrovox role to the dispatcher's environment. If your model may be useful for others, I encourage you to contribute it back to the Taproot repository.

# Citations

```
@misc{gandhi2023distilwhisper,
    title         = {Distil-Whisper: Robust Knowledge Distillation via Large-Scale Pseudo Labelling}, 
    author        = {Sanchit Gandhi and Patrick von Platen and Alexander M. Rush},
    year          = {2023},
    eprint        = {2311.00430},
    archivePrefix = {arXiv},
    primaryClass  = {cs.CL}
}
```
```
@misc{dubey2024llama3herdmodels,
    title         = {The Llama 3 Herd of Models},
    author        = {Llama Team, AI @ Meta},
    year          = {2024}
    eprint        = {2407.21783},
    archivePrefix = {arXiv},
    primaryClass  = {cs.AI},
    url           = {https://arxiv.org/abs/2407.21783}
}
```
```
@misc{coqui2023xtts,
    title         = {XTTS: Open Model Release Announcement}
    author        = {Coqui AI}
    year          = {2023}
    url           = {https://coqui.ai/blog/tts/open_xtts}
}
```
```
@inproceedings{schroeter2023deepfilternet3,
    title         = {{DeepFilterNet}: Perceptually Motivated Real-Time Speech Enhancement},
    author        = {Schröter, Hendrik and Rosenkranz, Tobias and Escalante-B., Alberto N. and Maier, Andreas},
    booktitle     = {INTERSPEECH},
    year          = {2023},
}
```
