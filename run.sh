#!/usr/bin/env bash

LOG_DIR="/home/anachrovox/logs"
mkdir -p "$LOG_DIR"

MAX_RESTARTS=3

######################
# Service Definitions
######################
# We'll store commands, log paths, etc.
declare -A SERVICE_CMDS=(
  [nginx]="nginx -p /home/anachrovox -c /home/anachrovox/nginx.conf"
  [taproot_dispatcher]="taproot dispatcher --config /home/anachrovox/dispatcher.yaml --add-import anachrovox --debug"
  [taproot_overseer]="taproot overseer --config /home/anachrovox/overseer.yaml --debug"
)

declare -A SERVICE_LOGS_STDOUT=(
  [nginx]="${LOG_DIR}/nginx.log"
  [taproot_dispatcher]="${LOG_DIR}/taproot_dispatcher.log"
  [taproot_overseer]="${LOG_DIR}/taproot_overseer.log"
)

declare -A SERVICE_LOGS_STDERR=(
  [nginx]="${LOG_DIR}/nginx_err.log"
  [taproot_dispatcher]="${LOG_DIR}/taproot_dispatcher_err.log"
  [taproot_overseer]="${LOG_DIR}/taproot_overseer_err.log"
)

# The PIDs we'll track
declare -A SERVICE_PIDS
# How many times we've restarted
declare -A SERVICE_RESTART_COUNT

##########################
# Cleanup on SIGINT/TERM
##########################
cleanup() {
  echo "Stopping all processes..."
  for svc in "${!SERVICE_PIDS[@]}"; do
    pid="${SERVICE_PIDS[$svc]}"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
    fi
  done
  # Give them a moment
  sleep 1
  # Force kill if still alive
  for svc in "${!SERVICE_PIDS[@]}"; do
    pid="${SERVICE_PIDS[$svc]}"
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid"
    fi
  done
  echo "All processes stopped."
  exit 0
}
terminate() {
    echo "Caught SIGTERM, shutting down..."
    cleanup
}
interrupt() {
    echo "Caught SIGINT, shutting down..."
    cleanup
}
trap interrupt SIGINT
trap terminate SIGTERM

#######################
# Start a single svc
#######################
start_service() {
  local svc="$1"
  local cmd="${SERVICE_CMDS[$svc]}"
  local out="${SERVICE_LOGS_STDOUT[$svc]}"
  local err="${SERVICE_LOGS_STDERR[$svc]}"

  echo "Starting $svc (restart count ${SERVICE_RESTART_COUNT[$svc]})"
  # Start in background
  # Note: If the process daemonizes immediately, $! won't remain alive
  # But let's try anyway
  $cmd >>"$out" 2>>"$err" &
  SERVICE_PIDS[$svc]=$!
  sleep 0.2

  # Check if it died instantly
  if ! kill -0 "${SERVICE_PIDS[$svc]}" 2>/dev/null; then
    echo "$svc appears to have daemonized or exited immediately. We'll keep tracking its old PID, which won't help..."
    # Optionally, you could try to find the "real" PID if it wrote a PID file
    # or you can keep going, and rely on external means to detect a crash
  fi
}

################################
# Restart logic
################################
attempt_restart() {
  local svc="$1"
  SERVICE_RESTART_COUNT[$svc]=$(( SERVICE_RESTART_COUNT[$svc] + 1 ))
  if (( SERVICE_RESTART_COUNT[$svc] > MAX_RESTARTS )); then
    echo "$svc crashed too many times. Shutting everything down."
    cleanup
  else
    start_service "$svc"
  fi
}

#############################
# Main loop (polling)
#############################
monitor_services() {
  while true; do
    sleep 2  # poll every 2 seconds

    for svc in "${!SERVICE_PIDS[@]}"; do
      pid="${SERVICE_PIDS[$svc]}"

      if ! kill -0 "$pid" 2>/dev/null; then
        # It's dead
        echo "$svc (PID $pid) not alive! Attempting restart..."
        attempt_restart "$svc"
      fi
    done
    # Loop continues
  done
}

main() {
  # Zero out restart counters and start each service
  for svc in "${!SERVICE_CMDS[@]}"; do
    SERVICE_RESTART_COUNT[$svc]=0
    start_service "$svc"
  done

  # Now just poll them
  monitor_services
}

main
