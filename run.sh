#!/usr/bin/env bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PIDFILE="$SCRIPT_DIR/.run.pid"
LOG_DIR="$SCRIPT_DIR/logs"
MAX_RESTARTS=3

mkdir -p "$LOG_DIR"
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

######################
# Service Definitions
######################
declare -A SERVICE_CMDS=(
  [nginx]="nginx -p $SCRIPT_DIR -c $SCRIPT_DIR/nginx.conf"
  [taproot_dispatcher]="taproot dispatcher --config $SCRIPT_DIR/dispatcher.yaml --add-import anachrovox --debug"
  [taproot_overseer]="taproot overseer --config $SCRIPT_DIR/overseer.yaml --debug"
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

declare -A SERVICE_PIDFILES=(
  [nginx]="${SCRIPT_DIR}/.nginx.pid"
  [taproot_dispatcher]="${SCRIPT_DIR}/.dispatcher.pid"
  [taproot_overseer]="${SCRIPT_DIR}/.overseer.pid"
)

# The PIDs we'll track
declare -A SERVICE_PIDS

# How many times we've restarted
declare -A SERVICE_RESTART_COUNT

# Record the script's start time
START_TIME=$(date +%s.%N)

# Function to echo a message with a timestamp
timestamp_echo() {
    local current_time=$(date +%s.%N)
    local elapsed=$(awk "BEGIN {print $current_time - $START_TIME}")
    local hours=$(awk "BEGIN {print int($elapsed / 3600)}")
    local minutes=$(awk "BEGIN {print int(($elapsed % 3600) / 60)}")
    local seconds=$(awk "BEGIN {print int($elapsed % 60)}")
    local milliseconds=$(awk "BEGIN {print int(($elapsed - int($elapsed)) * 10000)}")

    # Format and echo the message
    printf "[+%02d:%02d:%02d.%04d] %s\n" "$hours" "$minutes" "$seconds" "$milliseconds" "$*"
}

declare -A SHUTTING_DOWN

######################
# PIDFile check
######################
# Check if the PID file exists
if [[ -f "$PIDFILE" ]]; then
    # Read the PID from the file
    read -r PID < "$PIDFILE"

    # Check if the process is still running
    if kill -0 "$PID" 2>/dev/null; then
        echo "Script is already running with PID $PID. Exiting."
        exit 1
    else
        echo "Stale PID file detected. Removing and continuing."
        rm -f "$PIDFILE"
        # Make sure all the services that were running in the previous instance are stopped
        # Read pidfiles
        for svc in "${!SERVICE_PIDFILES[@]}"; do
            pidfile="${SERVICE_PIDFILES[$svc]}"
            if [[ -f "$pidfile" ]]; then
                read -r pid < "$pidfile"
                if kill -0 "$pid" 2>/dev/null; then
                    echo "Stopping $svc (PID $pid) from zombie process."
                    kill "$pid"
                fi
            fi
        done
    fi
fi

# Write the current PID to the file
echo $$ > "$PIDFILE"

##########################
# Cleanup on SIGINT/TERM
##########################
cleanup() {
  # Prevent thrashing
  if [ -n "$SHUTTING_DOWN" ]; then
    return
  fi
  SHUTTING_DOWN=1
  timestamp_echo "Stopping all processes..."
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
  timestamp_echo "All processes stopped."
  rm -f "$PIDFILE"
  exit 0
}
terminate() {
    timestamp_echo "Caught SIGTERM, shutting down..."
    cleanup
}
interrupt() {
    timestamp_echo "Caught SIGINT, shutting down..."
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

  timestamp_echo "Starting $svc (restart count ${SERVICE_RESTART_COUNT[$svc]})"
  # Start in background
  # Note: If the process daemonizes immediately, $! won't remain alive
  # But let's try anyway
  $cmd >>"$out" 2>>"$err" &
  SERVICE_PIDS[$svc]=$!

  sleep 0.2

  # Check if it died instantly
  if ! kill -0 "${SERVICE_PIDS[$svc]}" 2>/dev/null; then
    timestamp_echo "$svc appears to have daemonized or exited immediately."
  else
    timestamp_echo "$svc started with PID ${SERVICE_PIDS[$svc]}"
    echo "${SERVICE_PIDS[$svc]}" > "${SERVICE_PIDFILES[$svc]}"
  fi
}

################################
# Restart logic
################################
attempt_restart() {
  local svc="$1"
  SERVICE_RESTART_COUNT[$svc]=$(( SERVICE_RESTART_COUNT[$svc] + 1 ))
  if (( SERVICE_RESTART_COUNT[$svc] > MAX_RESTARTS )); then
    timestamp_echo "$svc crashed too many times. Shutting everything down."
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
        timestamp_echo "$svc (PID $pid) not alive! Attempting restart..."
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
