#!/usr/bin/env python3
"""Serve Bookmark Atlas on 127.0.0.1:4545 (web/ + data/). Read-only static server."""
import http.server, os, functools, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get('PORT', 4545))

class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split('?', 1)[0].split('#', 1)[0]
        if p.startswith('/data/'):
            return os.path.join(ROOT, 'data', os.path.basename(p))
        if p == '/snapshot':
            return os.path.join(ROOT, 'dist', 'bookmark-atlas-snapshot.html')
        return super().translate_path(path)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass

if __name__ == '__main__':
    os.chdir(os.path.join(ROOT, 'web'))
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    s = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H)
    print(f'Bookmark Atlas on http://127.0.0.1:{PORT}', flush=True)
    s.serve_forever()
