FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

# Model choices
ARG TEXT_MODEL=llama-v3-2-3b-instruct-q6-k
ARG TRANSCRIBE_MODEL=distilled-whisper-large-v3
ARG SPEECH_MODEL=kokoro

# Create user
RUN useradd -m -u 1000 anachrovox

# Set home and work directory
ENV HOME=/app \
    PATH=/app/.local/bin:$PATH
WORKDIR /app

# Copy configuration
COPY config/nginx.conf /app/nginx.conf
COPY config/supervisord.conf /app/supervisord.conf
COPY config/dispatcher.yaml /app/dispatcher.yaml
COPY config/overseer.yaml /app/overseer.yaml

# Copy WWW contents
ADD www /app/www

# Copy Anachrovox application code
ADD src/anachrovox /app/anachrovox

# Create log directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 7860

# Install Packages
RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-dev \
    nginx \
    espeak-ng \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Adjust permissions
RUN chown -R 1000 /var/log/nginx /var/lib/nginx /app

# Drop privileges
USER 1000

# Install taproot
RUN pip3 install --no-cache-dir taproot[tools,cli,av,uv,ws]

# Use taproot to install dependencies - we do this in steps to avoid any individual layer being too large
# First install packages
RUN taproot install audio-transcription:${TRANSCRIBE_MODEL} --no-files --debug
RUN taproot install speech-synthesis:${SPEECH_MODEL} --no-files --optional --debug # Adds deepfilternet
RUN taproot install text-generation:${TEXT_MODEL} --no-files --debug

# Now download files
RUN taproot install audio-transcription:${TRANSCRIBE_MODEL} --no-packages
RUN taproot install text-generation:${TEXT_MODEL} --no-packages
RUN taproot install speech-synthesis:${SPEECH_MODEL} --no-packages --optional

# Run the application
CMD ["supervisord", "-c", "/app/supervisord.conf"]
