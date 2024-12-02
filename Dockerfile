FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

# Model choices
ARG TEXT_MODEL=llama-v3-2-3b-instruct-q6-k
ARG TRANSCRIBE_MODEL=distilled-whisper-large-v3
ARG SPEECH_MODEL=xtts-v2

# Create user
RUN useradd -m -u 1000 anachrovox

# Set home and work directory
ENV HOME=/home/anachrovox \
    PATH=/home/anachrovox/.local/bin:$PATH
WORKDIR /home/anachrovox

# Copy configuration
COPY --chown=anachrovox config/nginx.conf /home/anachrovox/nginx.conf
COPY --chown=anachrovox config/dispatcher.yaml /home/anachrovox/dispatcher.yaml
COPY --chown=anachrovox config/overseer.yaml /home/anachrovox/overseer.yaml

# Copy WWW contents
ADD --chown=anachrovox www /home/anachrovox/www

# Copy Vox application code
ADD --chown=anachrovox src/anachrovox /home/anachrovox/anachrovox

# Create log directory
RUN mkdir -p /home/anachrovox/logs

# Expose port
EXPOSE 7860

# Install Nginx and Pip
RUN apt-get update && \
    apt-get install -y nginx python3-pip python3-dev && \
    rm -rf /var/lib/apt/lists/*

# Adjust permissions
RUN chown -R anachrovox:anachrovox /var/log/nginx /var/lib/nginx /home/anachrovox/logs

# Drop privileges
USER 1000

# Install taproot
RUN pip3 install --no-cache-dir taproot[tools,console,av]

# Use taproot to install dependencies - we do this in steps to avoid any individual layer being too large
# First install packages
RUN taproot install audio-transcription:${TRANSCRIBE_MODEL} --no-files --debug
RUN taproot install speech-synthesis:${SPEECH_MODEL} --no-files --optional --debug # Adds deepfilternet
RUN taproot install text-generation:${TEXT_MODEL} --no-files --debug

# Now download files
RUN taproot install audio-transcription:${TRANSCRIBE_MODEL} --no-packages
RUN taproot install text-generation:${TEXT_MODEL} --no-packages
RUN taproot install speech-synthesis:${SPEECH_MODEL} --no-packages --optional

# Copy run script
COPY --chown=anachrovox --chmod=755 run.sh /home/anachrovox/run.sh

# Run the application
CMD ["/home/anachrovox/run.sh"]
