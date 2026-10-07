#!/usr/bin/env bash
# Rebuild everything: parse -> cluster -> offline snapshot. Read-only over /workspace sources.
set -e; cd "$(dirname "$0")"
PY=.venv/bin/python; [ -x $PY ] || PY=python3
$PY build/parse.py && $PY build/cluster.py | grep -v "^   {" && $PY build/export_static.py
