#!/bin/bash

# Configuration
FOLDER_PATH="/path/to/your/folder"
PORT=8000
LOG_FILE="/tmp/python_server.log"

# Function to cleanup on exit
cleanup() {
    if [ -f /tmp/python_server.pid ]; then
        PID=$(cat /tmp/python_server.pid)
        kill $PID 2>/dev/null
        rm /tmp/python_server.pid
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Wait for system to fully boot
sleep 5

# Navigate to the folder
cd "$FOLDER_PATH" || exit 1

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "Port $PORT is already in use. Killing existing process..."
    kill $(lsof -t -i:$PORT) 2>/dev/null
    sleep 2
fi

# Start Python HTTP server in the background
python3 -m http.server $PORT > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Save PID
echo $SERVER_PID > /tmp/python_server.pid

# Wait for server to start
sleep 3

# Check if server is actually running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "Server failed to start. Check $LOG_FILE"
    exit 1
fi

# Open Chrome in kiosk mode (only if not already running)
if ! pgrep -x "Google Chrome" > /dev/null; then
    open -a "Google Chrome" --args --kiosk "http://localhost:$PORT"
else
    # Chrome already running, just open new tab
    open "http://localhost:$PORT"
fi

# Keep script running
wait $SERVER_PID