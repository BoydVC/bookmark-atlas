#!/usr/bin/env python3
"""Smoke test for Bookmark Atlas.
1. Data integrity + anti-invention: every post's status ID and every exact engagement number
   appear verbatim in one of the source files it cites.
2. Server on :4545 serves the app, assets and data.
3. Offline snapshot is self-contained (no external scripts) and carries the same data.
4. Headless Chrome renders every view with real content and no JS error banner.
Exit code 0 = pass."""
import json, os, re, subprocess, sys, urllib.request, collections
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
W = '/workspace'
PORT = int(os.environ.get('PORT', 4545))
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

A = json.load(open(os.path.join(R, 'data', 'atlas.json')))
P = A['posts']
check(len(P) > 0, f'{len(P)} posts in dataset')
urls = [p['url'] for p in P]
check(len(urls) == len(set(urls)), 'URLs are unique (deduped)')
check(all(re.fullmatch(r'https://x\.com/[A-Za-z0-9_]+/status/\d+', u) for u in urls), 'all URLs are canonical x.com status links')
cids = {c['id'] for c in A['clusters']}
check(all(p['cluster'] in cids for p in P), 'every post has a valid cluster')
check(sum(c['size'] for c in A['clusters']) == len(P), 'cluster sizes add up to post count')
cache = {}
def src(name):
    if name not in cache:
        cache[name] = open(os.path.join(W, name), encoding='utf-8', errors='ignore').read()
    return cache[name]
bad_id = [p['url'] for p in P if not any(p['id'] in src(s) for s in p['sources'])]
check(not bad_id, f'every status ID appears verbatim in a cited source file ({len(bad_id)} missing)')
bad_eng = []
for p in P:
    e = p.get('engagement') or {}
    if not e or e.get('_approx'):
        continue
    for k, v in e.items():
        if k.startswith('_'): continue
        if not any(re.search(rf'\b{v}\b', src(s)) for s in p['sources']):
            bad_eng.append((p['url'], k, v))
check(not bad_eng, f'every exact engagement number appears in a cited source ({len(bad_eng)} missing) {bad_eng[:3]}')
bad_auth = [p['url'] for p in P if not any(p['handle'].lower() in src(s).lower() for s in p['sources'])]
check(not bad_auth, 'every author handle appears in a cited source')
for h in A['rabbit_holes']:
    if not all(any(q['id'] == i for q in P) for i in h['posts']): fails.append('rabbit hole references unknown post')
check(len(A['rabbit_holes']) > 0, f"{len(A['rabbit_holes'])} rabbit holes reference known posts")
check(A['month']['bookmarks_in_window'] == sum(1 for p in P if p['kind'] == 'bookmark' and p['posted_date'] and A['month']['window'][0] <= p['posted_date'] <= A['month']['window'][1]),
      'monthly summary count matches the dataset')

base = f'http://127.0.0.1:{PORT}'
for path in ['/', '/app.js', '/style.css', '/vendor/d3.v7.min.js', '/data/atlas.json']:
    try:
        r = urllib.request.urlopen(base + path, timeout=5); ok = r.status == 200; body = r.read()
    except Exception as ex:
        ok = False; body = b''
    check(ok, f'GET {path} -> 200')
    if path == '/data/atlas.json' and ok:
        check(len(json.loads(body)['posts']) == len(P), 'served data matches file')

snap = os.path.join(R, 'dist', 'bookmark-atlas-snapshot.html')
check(os.path.exists(snap), 'offline snapshot exists')
if os.path.exists(snap):
    h = open(snap).read()
    check('window.ATLAS=' in h and not re.search(r'<script[^>]+src=', h) and '<link rel="stylesheet"' not in h, 'snapshot is self-contained')

def dom(url):
    out = subprocess.run(['google-chrome', '--headless=new', '--no-sandbox', '--disable-gpu', '--window-size=1440,900',
                          '--virtual-time-budget=5000', '--user-data-dir=/tmp/bookmark-atlas-test', '--dump-dom', url],
                         capture_output=True, text=True, timeout=60)
    return out.stdout
for view, needle, minc in [('galaxy', '<circle', 50), ('constellation', '<line', 20), ('timeline', '<rect', 10), ('authors', 'class="lbrow"', 20),
                           ('cards', 'class="card"', 50), ('holes', 'class="hole', 3), ('month', 'class="trow"', 3)]:
    d = dom(f'{base}/?view={view}')
    n = len(re.findall(r'class="card" data-id="\d+"', d)) if needle == 'class="card"' else d.count(needle)
    check('data-ready="1"' in d and n >= minc, f'live view {view}: {n} x {needle}')
d = dom('file://' + snap + '?view=cards&scope=all')
check(len(re.findall(r'class="card" data-id="\d+"', d)) == len(P), f'snapshot renders all {len(P)} cards in "all" scope')
d = dom(f'{base}/?view=cards&q=pstack')
nq = len(re.findall(r'class="card" data-id="\d+"', d))
check(0 < nq < 10, f'search "pstack" narrows the cards to {nq}')
print('\n' + ('ALL PASS' if not fails else f'{len(fails)} FAILURE(S)'))
sys.exit(1 if fails else 0)
