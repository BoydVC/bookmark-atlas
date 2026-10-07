# Bookmark Atlas

An interactive dark-mode explorer of everything Boyd (@xristafer) bookmarked on X and everything his research bots
saved about posts he follows. It's built **only** from files already saved on this box. Nothing is fetched from X,
and no post, author or number is invented.

- **Live:** http://127.0.0.1:4545 (start/restart with `./run.sh`)
- **Offline single file:** `dist/bookmark-atlas-snapshot.html` (CSS, d3, data and app inlined; open it anywhere)
- **Clean dataset:** `data/posts.csv` (flat) and `data/atlas.json` (posts + themes + rabbit holes + monthly summary)
- **Screenshots (1440×900):** `screenshots/01-galaxy.png` … `13-constellation-all.png` (`./screenshot.sh` regenerates them)
- **Smoke test:** `python3 tests/smoke_test.py` (needs the server running; stdlib + headless Chrome)
- **Rebuild:** `./build.sh` (uses `.venv` with scikit-learn/numpy)

## Views
1. **Galaxy**: zoomable circle-packing of themes → posts. Bubble size grows with views (log scale) when they're known. Click a theme to zoom, click a post to open it. The side panel lists each theme's blurb, top TF-IDF words and top authors.
2. **Constellation** (bonus): a force-directed network. Every post is a star linked to its most similar posts (TF-IDF cosine ≥ 0.06) and pulled toward its theme. Scroll to zoom, drag to pan, hover to trace a post's links.
3. **Timeline**: posts per week stacked by theme, plus one swimlane per theme with every post on its publish day.
4. **Authors**: a leaderboard of who he bookmarks most, with a theme-mix bar and the views seen. Click an author to search their posts.
5. **Cards**: full-text search (text, @author, theme, journal notes), sort by date, views, likes or everyone's bookmarks, and an "Open on X ↗" link on every card. A collapsible box lists bookmarks the journal mentions without a saved link.
6. **Rabbit holes**: chains of 3–7 bookmarks where each hop goes to the most similar unvisited bookmark (TF-IDF cosine). The shared words and similarity are shown on every arrow.
7. **This month**: a summary of the last 30 days vs the 30 before, generated from counts in the data (top themes, growing and cooling themes, most-saved authors, new authors, biggest bookmarks).

The scope toggle (top right) switches between **Bookmarks only** (default) and **+ Elon watch & research** (posts the
research bots logged from Elon's profile/search and from interest-journal research notes). The theme chips in the legend solo a theme; shift-click toggles one.
Clicking any post opens a drawer with its full saved text, quote, engagement, provenance (which files it came from, when captured)
and related posts.

## Pipeline (`./build.sh`)
| Step | File | What it does |
|---|---|---|
| parse | `build/parse.py` | Reads the Playwright accessibility snapshots (`/workspace/bookmarks*.yml`, `bm3.yml`, `bm4.yml`, `elon-*.yml`), Jim's JSON scrapes (`jim/x-bookmarks-2026-08-27.json`, `jim/x-bookmarks-2026-09-10.json`, `jim/elon-2026-*.json`, `x-scrape-2026-09-21.json.log`), and the interest-journal markdown (`ij_*_bookmarks.md`, `ij_*_x.md`, `ij_*_research.md`, `ij_*_content.md`, `ij_2026-*.md`, `interest-journal-*/`, `jim/musk-cos-*.md`). It dedupes by status ID/URL and merges text, names, quotes and engagement across captures. |
| cluster | `build/cluster.py` | A keyword taxonomy (13 themes) seeds the themes. TF-IDF (1–2-gram) centroids place any leftover posts with enough text. Posts with almost no text go to "Unsorted & one-liners". A free LSA + k-means (k=10) runs as a cross-check, and its results are stored in `atlas.json`. The step also computes rabbit holes, related posts and the 30-day summary. |
| export | `build/export_static.py` | Writes the offline snapshot and `data/posts.csv`. |

### Data rules
- **Dates** are the post's *publish* time, decoded from the X status ID (exact). X never exposed *when* Boyd hit bookmark, so the timeline and monthly view count by publish date.
- **Engagement** is copied from the saved snapshot. The accessibility snapshots give exact counts. Jim's JSON scrapes give rounded figures ("1.3K"), which are shown with ≈ and only used when exactly four footer numbers were present (replies, reposts, likes, views). When a post was captured several times, exact counts win, then the latest (largest) capture.
- When only an interest-journal description exists (no post text was saved), the card shows it in italics as a "Journal note".
- The smoke test verifies that every status ID, author handle and exact engagement number appears verbatim in a cited source file.

## Gaps / caveats
- **The X connector is broken and X wasn't browsed**, so the dataset is limited to what earlier scrapes captured (Aug 18 – Oct 6 posts). Bookmarks saved after the Oct 6 evening scrape are missing.
- **Many bookmarks have no post text**: 52 posts only have a journal description (mostly the Sep 10 JSON, which saved a theme line per bookmark), and 8 have neither. 108 of 180 posts have no engagement numbers.
- **Mentioned but unlinked**: the journal names a few bookmarks without a URL (for example @theo on claude.ai speed, @alex_prompter, @petergyang's human+agent Slack post, @0xCarnagee ×2, @godofprompt, @boneGPT). These are listed in the Cards view, not counted as posts.
- **Chrome files were not used as bookmarks**: `chrome_history_*.db`, `chrome_sep28.txt`, `chrome_visits_sep30.tsv` and `ij_*_chrome.md` are browsing history (including work/KPD and family browsing), not bookmarks. Nothing in them is bookmark-like, so they were left out on purpose.
- **Sports** shows up in the research notes but in no saved X post, so there is no Sports theme in the map.
- The taxonomy is hand-written. The LSA k-means cross-check independently recovers the SpaceX, Claude Code and Grok Bot groups (≈45% overall agreement), but on short texts it's noisy, which is why the named taxonomy drives the UI.


---
## Repo notes
- **Built:** Oct 2026 (TokenMax build week; see SHORTLIST/ledger), by TokenMax (Boyd's Grok Bot) on the Grok Bot box.
- **Run:** `./run.sh` (then open the localhost URL it prints).
- Imported from `/workspace/tokenmax/bookmark-atlas` on Oct 23, 2026. node_modules, virtualenvs, logs and files over 20 MB were left out.
