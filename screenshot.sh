#!/usr/bin/env bash
# Render 1440x900 screenshots of the running app (port 4545) with headless Chrome.
cd "$(dirname "$0")"
shot() { google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1440,900 --virtual-time-budget=5000 --user-data-dir=/tmp/bookmark-atlas-chrome \
  --screenshot="screenshots/$1.png" "http://127.0.0.1:${PORT:-4545}/?$2" >/dev/null 2>&1; echo "screenshots/$1.png"; }
if [ -n "$1" ]; then shot "$1" "$2"; exit; fi
shot 01-galaxy "view=galaxy"
shot 02-galaxy-zoom "view=galaxy&zoom=agents"
shot 03-timeline "view=timeline"
shot 04-authors "view=authors"
shot 05-cards "view=cards"
shot 06-cards-search "view=cards&q=local"
shot 07-rabbit-holes "view=holes"
shot 08-this-month "view=month"
shot 09-galaxy-all "view=galaxy&scope=all"
shot 10-post-drawer "view=cards&open=2093023531642863686"
shot 11-timeline-all "view=timeline&scope=all"
shot 12-constellation "view=constellation"
shot 13-constellation-all "view=constellation&scope=all"
