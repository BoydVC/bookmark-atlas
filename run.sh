#!/usr/bin/env bash
# Start (or restart) the Bookmark Atlas server on 127.0.0.1:4545 in the background.
cd "$(dirname "$0")"
pkill -f "bookmark-atlas/server.py" 2>/dev/null; sleep 0.5
setsid nohup python3 "$PWD/server.py" > /tmp/bookmark-atlas.log 2>&1 &
sleep 1; curl -s -o /dev/null -w "Bookmark Atlas: http://127.0.0.1:4545 -> %{http_code}\n" http://127.0.0.1:4545/
