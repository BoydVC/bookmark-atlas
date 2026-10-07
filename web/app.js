/* Bookmark Atlas — front end. Everything shown comes from data/atlas.json (built by build/*.py). */
(async function () {
  const A = window.ATLAS || await (await fetch('data/atlas.json')).json();
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n == null ? '–' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K' : String(n);
  const CL = Object.fromEntries(A.clusters.map(c => [c.id, c]));
  const byId = Object.fromEntries(A.posts.map(p => [p.id, p]));
  const col = id => (CL[id] || {}).color || '#888';
  const dfmt = d3.timeFormat('%b %-d, %Y'), dshort = d3.timeFormat('%b %-d');
  const pdate = p => p.posted_date ? new Date(p.posted_date + 'T12:00:00') : null;
  const KIND = { bookmark: 'Bookmarked', 'elon-watch': 'Elon watch', research: 'Researched' };
  const state = { scope: 'bookmark', off: new Set(), view: 'galaxy' };
  const params = new URLSearchParams(location.search);
  if (params.get('scope') === 'all') state.scope = 'all';

  const posts = () => A.posts.filter(p => (state.scope === 'all' || p.kind === 'bookmark') && !state.off.has(p.cluster));
  const scoped = () => A.posts.filter(p => state.scope === 'all' || p.kind === 'bookmark');
  const body = p => p.text || (p.notes && p.notes[0]) || '';
  const name = p => p.name || '@' + p.handle;

  // ---------- header ----------
  function header() {
    const ps = scoped();
    const authors = new Set(ps.map(p => p.handle.toLowerCase()));
    const dated = ps.filter(p => p.posted_date).map(p => p.posted_date).sort();
    const themes = new Set(ps.map(p => p.cluster));
    $('#stats').innerHTML = [
      [ps.length, state.scope === 'all' ? 'posts' : 'bookmarks'], [authors.size, 'authors'], [themes.size, 'themes'],
      [dated.length ? dshort(new Date(dated[0] + 'T12:00')) + ' – ' + dshort(new Date(dated[dated.length - 1] + 'T12:00')) : '–', 'posted span'],
    ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
    const cnt = d3.rollup(ps, v => v.length, p => p.cluster);
    $('#legend').innerHTML = A.clusters.filter(c => cnt.get(c.id)).map(c =>
      `<button class="chip ${state.off.has(c.id) ? 'off' : ''}" data-c="${c.id}" title="${esc(c.blurb)}"><i style="background:${c.color}"></i>${esc(c.name)} <small>${cnt.get(c.id)}</small></button>`).join('')
      + `<button class="chip" data-c="__all" title="Show every theme"><small>show all</small></button>`;
    document.querySelectorAll('#legend .chip').forEach(b => b.onclick = e => {
      const c = b.dataset.c;
      if (c === '__all') state.off.clear();
      else if (e.shiftKey || e.metaKey) { state.off.has(c) ? state.off.delete(c) : state.off.add(c); }
      else { // solo / unsolo
        const visible = A.clusters.filter(x => !state.off.has(x.id)).map(x => x.id);
        if (visible.length === 1 && visible[0] === c) state.off.clear();
        else { state.off = new Set(A.clusters.map(x => x.id).filter(x => x !== c)); }
      }
      render();
    });
    $('#foot').innerHTML = `Built ${esc(A.generated.replace('T', ' ').slice(0, 16))} ET from ${Object.keys(A.source_counts).length} saved files on the box. ` +
      `Dates are when each post was <b>published</b> (decoded from its X status ID); X does not expose when Boyd bookmarked it. ` +
      `Engagement is whatever the saved snapshot showed (≈ = rounded K/M figures). Nothing here was fetched live from X. ` +
      `Themes: keyword taxonomy + TF-IDF nearest-centroid; rabbit holes: TF-IDF cosine chains.`;
  }

  // ---------- tooltip & drawer ----------
  const tip = $('#tip');
  function showTip(e, html) { tip.innerHTML = html; tip.style.display = 'block'; const x = Math.min(e.clientX + 14, innerWidth - 380); tip.style.left = x + 'px'; tip.style.top = (e.clientY + 14) + 'px'; }
  function hideTip() { tip.style.display = 'none'; }
  const tipHtml = p => `<div class="h">${esc(name(p))} <span class="muted">@${esc(p.handle)}</span></div><div class="muted">${p.posted_date ? dfmt(pdate(p)) : 'date unknown'} · ${esc(CL[p.cluster].name)}</div><div style="margin-top:5px">${esc(body(p).slice(0, 220))}${body(p).length > 220 ? '…' : ''}</div>`;

  function engHtml(e) {
    if (!e || !Object.keys(e).filter(k => k[0] !== '_').length) return '<span class="muted">no engagement captured</span>';
    const ap = e._approx ? '≈' : '';
    return ['views', 'likes', 'reposts', 'replies', 'bookmarks'].filter(k => e[k] != null).map(k => `<span>${ap}<b>${fmt(e[k])}</b> ${k}</span>`).join('');
  }
  function avatar(p, size) { return `<div class="av" style="background:${col(p.cluster)};${size ? `width:${size}px;height:${size}px` : ''}">${esc((name(p).replace('@', '')[0] || '?').toUpperCase())}</div>`; }
  function cardHtml(p) {
    const isNote = !p.text && p.notes && p.notes.length;
    return `<div class="card" data-id="${p.id}" style="--c:${col(p.cluster)}">
      <div class="who">${avatar(p)}<div><div class="n">${esc(name(p))}</div><div class="h">@${esc(p.handle)}</div></div><div class="d">${p.posted_date ? dfmt(pdate(p)) : ''}</div></div>
      <div class="txt ${isNote ? 'note' : ''}">${esc(body(p)) || '<span class="muted">(no text captured in the saved snapshot)</span>'}</div>
      ${p.quote && (p.quote.text || p.quote.handle) ? `<div class="q">↪ ${p.quote.handle ? '@' + esc(p.quote.handle) + ': ' : ''}${esc(p.quote.text)}</div>` : ''}
      <div class="eng">${engHtml(p.engagement)}</div>
      <div class="meta"><span class="tag" style="border-color:${col(p.cluster)}66;color:${col(p.cluster)}">${esc(CL[p.cluster].name)}</span>
        <span class="kind ${p.kind}">${KIND[p.kind]}</span>${p.is_article ? '<span class="kind">X Article</span>' : ''}<a class="open" href="${p.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Open on X ↗</a></div></div>`;
  }
  function bindCards(root) { root.querySelectorAll('.card').forEach(c => c.onclick = () => openPost(c.dataset.id)); }

  function openPost(id) {
    const p = byId[id]; if (!p) return;
    const rel = (p.related || []).map(r => byId[r.id]).filter(Boolean);
    $('#dbody').innerHTML = `<div class="who">${avatar(p, 44)}<div><div class="n" style="font-size:17px">${esc(name(p))}</div><div class="h">@${esc(p.handle)} · <a href="https://x.com/${esc(p.handle)}" target="_blank" rel="noopener">profile ↗</a></div></div></div>
      <div class="full">${esc(body(p)) || '<span class="muted">(no text captured)</span>'}</div>
      ${!p.text && p.notes && p.notes.length ? '<div class="muted" style="font-size:12px">This text is the interest-journal note about the post; the post’s own words were not saved.</div>' : ''}
      ${p.quote && (p.quote.text || p.quote.handle) ? `<div class="q" style="-webkit-line-clamp:unset">↪ ${p.quote.handle ? '@' + esc(p.quote.handle) + ': ' : ''}${esc(p.quote.text)}</div>` : ''}
      <p><a href="${p.url}" target="_blank" rel="noopener" style="font-size:15px">Open the original post on X ↗</a></p>
      <h4>Engagement (as saved)</h4><div class="eng">${engHtml(p.engagement)}</div>
      <h4>Theme</h4><span class="tag" style="border-color:${col(p.cluster)};color:${col(p.cluster)}">${esc(CL[p.cluster].name)}</span>
        <span class="muted" style="font-size:12px"> via ${esc(p.cluster_method)}</span>
        ${(p.tags || []).map(t => `<span class="tag" style="border-color:${col(t)}55;color:${col(t)}">${esc(CL[t] ? CL[t].name : t)}</span>`).join(' ')}
      <h4>Provenance</h4><div class="muted" style="font-size:12.5px">${KIND[p.kind]} · published ${p.posted ? esc(p.posted.replace('T', ' ').slice(0, 16)) + ' ET' : 'unknown'}<br>
        Seen in: ${p.sources.map(esc).join(', ')}<br>Captured: ${p.captured.map(esc).join(', ')}</div>
      ${p.notes && p.notes.length && p.text ? `<h4>Interest-journal notes</h4>${p.notes.map(n => `<div class="muted" style="font-size:12.5px;margin-bottom:4px">“${esc(n)}”</div>`).join('')}` : ''}
      <h4>Related (TF-IDF similarity)</h4>${rel.length ? rel.map((r, i) => `<div class="rel" data-id="${r.id}"><b>${esc(name(r))}</b> <span class="muted">· ${p.related[i].sim.toFixed(2)} · ${esc(CL[r.cluster].name)}</span><br>${esc(body(r).slice(0, 140))}</div>`).join('') : '<span class="muted">none above threshold</span>'}`;
    $('#dbody').querySelectorAll('.rel').forEach(d => d.onclick = () => openPost(d.dataset.id));
    $('#drawer').classList.add('on');
  }
  $('#dx').onclick = () => $('#drawer').classList.remove('on');
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#drawer').classList.remove('on'); });

  // ---------- 1. Galaxy (zoomable circle packing) ----------
  function galaxy() {
    const el = $('#galaxy'); el.innerHTML = '';
    const W = el.clientWidth || 1000, H = Math.max(560, innerHeight - 215);
    const ps = posts();
    const groups = d3.group(ps, p => p.cluster);
    const root = d3.hierarchy({ children: A.clusters.filter(c => groups.get(c.id)).map(c => ({ c, children: groups.get(c.id).map(p => ({ p })) })) })
      .sum(d => d.p ? 1 + Math.log10(1 + ((d.p.engagement && d.p.engagement.views) || 0)) / 2.2 : 0)
      .sort((a, b) => ((a.data.c && a.data.c.id === 'oneliners') - (b.data.c && b.data.c.id === 'oneliners')) || b.value - a.value);
    d3.pack().size([W, H]).padding(d => d.depth === 0 ? 14 : 3)(root);
    const svg = d3.select(el).append('svg').attr('viewBox', [0, 0, W, H]);
    const defs = svg.append('defs');
    A.clusters.forEach(c => {
      const g = defs.append('radialGradient').attr('id', 'g-' + c.id);
      g.append('stop').attr('offset', '0%').attr('stop-color', c.color).attr('stop-opacity', .30);
      g.append('stop').attr('offset', '100%').attr('stop-color', c.color).attr('stop-opacity', .06);
    });
    const glow = defs.append('filter').attr('id', 'glow'); glow.append('feGaussianBlur').attr('stdDeviation', 2.2).attr('result', 'b');
    const m = glow.append('feMerge'); m.append('feMergeNode').attr('in', 'b'); m.append('feMergeNode').attr('in', 'SourceGraphic');
    const g = svg.append('g');
    let focus = root, view;
    const node = g.selectAll('circle').data(root.descendants().slice(1)).join('circle')
      .attr('fill', d => d.data.c ? `url(#g-${d.data.c.id})` : col(d.data.p.cluster))
      .attr('fill-opacity', d => d.data.p ? .85 : 1)
      .attr('stroke', d => d.data.c ? d.data.c.color : '#fff')
      .attr('stroke-opacity', d => d.data.c ? .55 : .25).attr('stroke-width', d => d.data.c ? 1.2 : .6)
      .attr('filter', d => d.data.p ? 'url(#glow)' : null)
      .style('cursor', 'pointer')
      .on('mousemove', (e, d) => showTip(e, d.data.p ? tipHtml(d.data.p) : `<div class="h">${esc(d.data.c.name)}</div><div class="muted">${d.children.length} posts · ${esc(d.data.c.blurb)}</div><div style="margin-top:4px">Top words: ${esc(d.data.c.top_terms.slice(0, 6).join(', '))}</div>`))
      .on('mouseleave', hideTip)
      .on('click', (e, d) => { e.stopPropagation(); hideTip(); if (d.data.p) { if (focus !== d.parent) zoom(d.parent); openPost(d.data.p.id); } else zoom(focus === d ? root : d); });
    const clabel = g.selectAll('text.clabel').data(root.children || []).join('text').attr('class', 'clabel')
      .text(d => d.data.c.name);
    const ctext = g.selectAll('text.ccount').data(root.children || []).join('text').attr('class', 'plabel')
      .text(d => `${d.children.length} post${d.children.length > 1 ? 's' : ''}`);
    const plabel = g.selectAll('text.pl').data(root.leaves()).join('text').attr('class', 'plabel pl').text(d => '@' + d.data.p.handle).style('opacity', 0);
    svg.on('click', () => zoom(root));
    zoomTo([root.x, root.y, root.r * 2]);
    function zoomTo(v) {
      const k = Math.min(W, H) / v[2]; view = v;
      node.attr('transform', d => `translate(${(d.x - v[0]) * k + W / 2},${(d.y - v[1]) * k + H / 2})`).attr('r', d => d.r * k);
      clabel.attr('transform', d => `translate(${(d.x - v[0]) * k + W / 2},${(d.y - v[1]) * k + H / 2 - (focus === root ? 0 : d.r * k - 22)})`)
        .style('font-size', d => Math.max(11, Math.min(focus === root ? 17 : 22, d.r * k / 4.5)) + 'px');
      ctext.attr('transform', d => `translate(${(d.x - v[0]) * k + W / 2},${(d.y - v[1]) * k + H / 2 + (focus === root ? 16 : -(d.r * k) + 40)})`);
      plabel.attr('transform', d => `translate(${(d.x - v[0]) * k + W / 2},${(d.y - v[1]) * k + H / 2 + 3})`)
        .style('opacity', d => focus !== root && d.parent === focus && d.r * k > 20 ? 1 : 0);
    }
    function zoom(d) {
      focus = d;
      const t = svg.transition().duration(650).tween('zoom', () => { const i = d3.interpolateZoom(view, [d.x, d.y, d.r * 2.1]); return t => zoomTo(i(t)); });
      clabel.transition(t).style('opacity', c => focus === root || c === focus ? 1 : .25);
      ctext.transition(t).style('opacity', c => focus === root || c === focus ? 1 : 0);
    }
    const side = $('#gside');
    side.innerHTML = `<div class="muted" style="font-size:12px">${(root.children || []).length} themes · ${ps.length} posts. Click to zoom.</div>` + (root.children || []).slice().sort((a, b) => b.children.length - a.children.length).map(c => {
      const cc = c.data.c, au = d3.rollups(c.children, v => v.length, d => d.data.p.handle).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return `<div class="tcard" data-c="${cc.id}" style="--c:${cc.color}"><div class="t"><span style="color:${cc.color}">${esc(cc.name)}</span><span>${c.children.length}</span></div>
        <div class="w">${esc(cc.blurb)}</div><div class="w">Top words: ${esc(cc.top_terms.slice(0, 5).join(', '))}</div><div class="w">Top authors: ${au.map(([h, n]) => '@' + esc(h) + ' ' + n).join(' · ')}</div></div>`;
    }).join('');
    side.querySelectorAll('.tcard').forEach(t => t.onclick = () => {
      const c = root.children.find(c => c.data.c.id === t.dataset.c);
      side.querySelectorAll('.tcard').forEach(x => x.classList.toggle('on', x === t && focus !== c));
      zoom(focus === c ? root : c);
    });
    const z = params.get('zoom');
    if (z) { const c = (root.children || []).find(c => c.data.c.id === z); if (c) { focus = c; zoomTo([c.x, c.y, c.r * 2.1]); clabel.style('opacity', x => x === c ? 1 : .25); ctext.style('opacity', x => x === c ? 1 : 0); } }
  }

  // ---------- 1b. Constellation (similarity network) ----------
  function constellation() {
    const el = $('#constellation'); el.innerHTML = '';
    const W = el.clientWidth || 1380, H = Math.max(560, innerHeight - 215);
    const ps = posts(), ids = new Set(ps.map(p => p.id));
    const nodes = ps.map(p => ({ p, id: p.id }));
    const links = [], seen = new Set();
    ps.forEach(p => (p.related || []).forEach(r => {
      if (r.sim < 0.06 || !ids.has(r.id)) return;
      const k = [p.id, r.id].sort().join('-'); if (seen.has(k)) return; seen.add(k);
      links.push({ source: p.id, target: r.id, sim: r.sim });
    }));
    const themes = A.clusters.filter(c => ps.some(p => p.cluster === c.id));
    const anchor = {}; themes.forEach((c, i) => { const a = i / themes.length * 2 * Math.PI - Math.PI / 2; anchor[c.id] = [W / 2 + Math.cos(a) * W * 0.32, H / 2 + Math.sin(a) * H * 0.34]; });
    const deg = d3.rollup(links.flatMap(l => [l.source, l.target]), v => v.length, d => d);
    const rad = n => 3 + Math.min(9, Math.log10(1 + ((n.p.engagement || {}).views || 0)) * 1.1) + Math.min(4, (deg.get(n.id) || 0) * .5);
    const svg = d3.select(el).append('svg').attr('viewBox', [0, 0, W, H]);
    const defs = svg.append('defs'); const gl = defs.append('filter').attr('id', 'cglow'); gl.append('feGaussianBlur').attr('stdDeviation', 2.5).attr('result', 'b');
    const mm = gl.append('feMerge'); mm.append('feMergeNode').attr('in', 'b'); mm.append('feMergeNode').attr('in', 'SourceGraphic');
    const g = svg.append('g');
    const zb = d3.zoom().scaleExtent([.3, 6]).on('zoom', e => g.attr('transform', e.transform)); svg.call(zb);
    const tl = g.append('g').selectAll('text').data(themes).join('text').attr('class', 'tlabel').attr('x', c => anchor[c.id][0]).attr('y', c => anchor[c.id][1] - 0).attr('fill', c => c.color).text(c => c.name).style('opacity', .55);
    const link = g.append('g').attr('stroke-linecap', 'round').selectAll('line').data(links).join('line')
      .attr('stroke', l => '#9fb4ff').attr('stroke-opacity', l => .18 + l.sim * 1.2).attr('stroke-width', l => .5 + l.sim * 4);
    const node = g.append('g').selectAll('circle').data(nodes).join('circle').attr('r', rad).attr('fill', n => col(n.p.cluster))
      .attr('stroke', '#fff').attr('stroke-opacity', .5).attr('stroke-width', .6).attr('filter', 'url(#cglow)').style('cursor', 'pointer')
      .on('mousemove', (e, n) => {
        showTip(e, tipHtml(n.p) + `<div class="muted" style="margin-top:4px">${deg.get(n.id) || 0} similarity link(s)</div>`);
        const nb = new Set([n.id]); links.forEach(l => { if (l.source.id === n.id) nb.add(l.target.id); if (l.target.id === n.id) nb.add(l.source.id); });
        node.attr('opacity', m => nb.has(m.id) ? 1 : .15); link.attr('stroke-opacity', l => l.source.id === n.id || l.target.id === n.id ? .9 : .03);
      })
      .on('mouseleave', () => { hideTip(); node.attr('opacity', 1); link.attr('stroke-opacity', l => .18 + l.sim * 1.2); })
      .on('click', (e, n) => openPost(n.id));
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(n => n.id).distance(l => 70 - l.sim * 60).strength(l => Math.min(1, l.sim * 1.6)))
      .force('charge', d3.forceManyBody().strength(-38))
      .force('x', d3.forceX(n => anchor[n.p.cluster][0]).strength(.07)).force('y', d3.forceY(n => anchor[n.p.cluster][1]).strength(.07))
      .force('collide', d3.forceCollide(n => rad(n) + 2)).stop();
    for (let i = 0; i < 320; i++) sim.tick();
    const draw = () => { link.attr('x1', l => l.source.x).attr('y1', l => l.source.y).attr('x2', l => l.target.x).attr('y2', l => l.target.y); node.attr('cx', n => n.x).attr('cy', n => n.y); };
    draw();
    // place theme labels above their star cloud
    tl.attr('x', c => d3.median(nodes.filter(n => n.p.cluster === c.id), n => n.x)).attr('y', c => d3.quantile(nodes.filter(n => n.p.cluster === c.id).map(n => n.y).sort(d3.ascending), .15) - 16);
    const [x0, x1] = d3.extent(nodes, n => n.x), [y0, y1] = d3.extent(nodes, n => n.y);
    const k = Math.min(1.6, .92 * Math.min(W / (x1 - x0 + 60), H / (y1 - y0 + 60)));
    svg.call(zb.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
    sim.alpha(.05).on('tick', draw).restart();
    node.call(d3.drag().on('start', (e, n) => { sim.alphaTarget(.2).restart(); n.fx = n.x; n.fy = n.y; }).on('drag', (e, n) => { n.fx = e.x; n.fy = e.y; }).on('end', (e, n) => { sim.alphaTarget(0); n.fx = n.fy = null; }));
  }

  // ---------- 2. Timeline ----------
  function timeline() {
    const el = $('#timeline'); el.innerHTML = '';
    const ps = posts().filter(p => p.posted_date);
    const W = el.clientWidth || 1380, M = { l: 210, r: 24, t: 20, b: 26 };
    const weeks = d3.timeWeek.range(d3.timeWeek.floor(d3.min(ps, pdate)), d3.timeWeek.offset(d3.timeWeek.floor(d3.max(ps, pdate)), 1));
    const ids = A.clusters.map(c => c.id).filter(id => ps.some(p => p.cluster === id));
    const rows = weeks.map(w => { const o = { w }; ids.forEach(id => o[id] = ps.filter(p => p.cluster === id && d3.timeWeek.floor(pdate(p)).getTime() === w.getTime()).length); return o; });
    const H1 = 230;
    const x = d3.scaleTime().domain([weeks[0], d3.timeWeek.offset(weeks[weeks.length - 1], 1)]).range([M.l, W - M.r]);
    const st = d3.stack().keys(ids)(rows);
    const y = d3.scaleLinear().domain([0, d3.max(st[st.length - 1] || [], d => d[1]) || 1]).nice().range([H1, M.t]);
    const svg = d3.select(el).append('div').attr('class', 'panel').call(d => d.append('h3').text('Interest over time — posts per week by theme (week of publication)'))
      .append('svg').attr('width', W - 40).attr('height', H1 + 30);
    const bw = Math.max(6, (x(d3.timeWeek.offset(weeks[0], 1)) - x(weeks[0])) * .72);
    svg.append('g').selectAll('g').data(st).join('g').attr('fill', d => col(d.key)).selectAll('rect').data(d => d.map(v => (v.key = d.key, v))).join('rect')
      .attr('x', d => x(d.data.w) + 2).attr('width', bw).attr('y', d => y(d[1])).attr('height', d => Math.max(0, y(d[0]) - y(d[1]))).attr('rx', 2)
      .on('mousemove', (e, d) => showTip(e, `<div class="h">Week of ${dshort(d.data.w)}</div>${ids.filter(i => d.data[i]).map(i => `<div><span style="color:${col(i)}">●</span> ${esc(CL[i].name)}: <b>${d.data[i]}</b></div>`).join('')}`)).on('mouseleave', hideTip);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H1})`).call(d3.axisBottom(x).ticks(d3.timeWeek.every(1)).tickFormat(dshort));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(5));
    svg.append('text').attr('x', M.l - 40).attr('y', M.t + 4).attr('fill', '#8b96b8').attr('font-size', 11).attr('text-anchor', 'end').text('posts / week');
    // swimlanes
    const LH = 38, H2 = ids.length * LH + 40;
    const s2 = d3.select(el).append('div').attr('class', 'panel').style('margin-top', '16px').call(d => d.append('h3').text('Every post on its day — one lane per theme (bubble = views when known)'))
      .append('svg').attr('width', W - 40).attr('height', H2);
    const r = d3.scaleSqrt().domain([0, d3.max(ps, p => (p.engagement || {}).views || 0) || 1]).range([3.5, 16]);
    ids.forEach((id, i) => {
      const yy = 20 + i * LH + LH / 2;
      const lane = s2.append('g').attr('class', 'lane');
      lane.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', yy).attr('y2', yy).attr('stroke', '#1d2647');
      lane.append('text').attr('x', M.l - 12).attr('y', yy + 4).attr('text-anchor', 'end').text(CL[id].name);
      const pts = ps.filter(p => p.cluster === id);
      const sim = pts.map(p => ({ p, x: x(pdate(p)), y: yy, r: r((p.engagement || {}).views || 0) }));
      d3.forceSimulation(sim).force('x', d3.forceX(d => x(pdate(d.p))).strength(1)).force('y', d3.forceY(yy).strength(.25)).force('c', d3.forceCollide(d => d.r + .8)).stop().tick(120);
      lane.selectAll('circle').data(sim).join('circle').attr('cx', d => d.x).attr('cy', d => Math.max(yy - LH / 2 + 2, Math.min(yy + LH / 2 - 2, d.y))).attr('r', d => d.r)
        .attr('fill', col(id)).attr('fill-opacity', .8).attr('stroke', '#fff').attr('stroke-opacity', .35).style('cursor', 'pointer')
        .on('mousemove', (e, d) => showTip(e, tipHtml(d.p))).on('mouseleave', hideTip).on('click', (e, d) => openPost(d.p.id));
    });
    s2.append('g').attr('class', 'axis').attr('transform', `translate(0,${H2 - 18})`).call(d3.axisBottom(x).ticks(d3.timeWeek.every(1)).tickFormat(dshort));
    const und = posts().length - ps.length;
    if (und) d3.select(el).append('div').attr('class', 'muted').style('margin-top', '8px').text(`${und} post(s) have no known date and are left off the timeline.`);
  }

  // ---------- 3. Authors ----------
  function authors() {
    const el = $('#authors');
    const ps = posts();
    const rows = d3.rollups(ps, v => v, p => p.handle.toLowerCase()).map(([h, v]) => ({
      handle: v[0].handle, name: (v.find(p => p.name) || v[0]).name || '@' + v[0].handle, n: v.length, v,
      views: d3.sum(v, p => (p.engagement || {}).views || 0), mix: d3.rollups(v, x => x.length, p => p.cluster).sort((a, b) => b[1] - a[1]),
      last: d3.max(v, p => p.posted_date || '')
    })).sort((a, b) => b.n - a.n || b.views - a.views);
    const max = d3.max(rows, r => r.n) || 1;
    const top3 = rows.slice(0, 3);
    const rowHtml = (r, i) => `<div class="lbrow" data-h="${esc(r.handle)}"><div class="rank">${i + 1}</div>${avatar({ name: r.name, handle: r.handle, cluster: r.mix[0][0] }, 32)}
      <div><div><b>${esc(r.name)}</b> <span class="muted">@${esc(r.handle)}</span></div><div class="muted" style="font-size:11.5px">${r.mix.map(([c, n]) => `<span style="color:${col(c)}">${esc(CL[c].name)}</span> ${n}`).join(' · ')}</div></div>
      <div><div style="text-align:right;font-weight:650">${r.n} <span class="muted" style="font-weight:400">post${r.n > 1 ? 's' : ''}</span></div>
      <div class="bar">${r.mix.map(([c, n]) => `<i style="width:${n / max * 100}%;background:${col(c)}"></i>`).join('')}</div>
      <div class="muted" style="font-size:11px;text-align:right">${r.views ? fmt(r.views) + ' views seen' : ''}</div></div></div>`;
    const half = Math.ceil(rows.length / 2);
    el.innerHTML = `<div class="podium">${top3.map((r, i) => `<div class="pod">${avatar({ name: r.name, handle: r.handle, cluster: r.mix[0][0] }, 52)}<div><div class="muted">#${i + 1} most ${state.scope === 'all' ? 'saved' : 'bookmarked'}</div><div style="font-size:17px;font-weight:650">${esc(r.name)}</div><div class="muted">@${esc(r.handle)} · latest ${r.last ? dshort(new Date(r.last + 'T12:00')) : '–'}</div></div><div style="margin-left:auto" class="big">${r.n}</div></div>`).join('')}</div>
      <div class="muted" style="margin-bottom:10px">${rows.length} authors · ${rows.filter(r => r.n > 1).length} appear more than once · click an author to search their posts</div>
      <div class="lb"><div style="display:flex;flex-direction:column;gap:8px">${rows.slice(0, half).map(rowHtml).join('')}</div><div style="display:flex;flex-direction:column;gap:8px">${rows.slice(half).map((r, i) => rowHtml(r, i + half)).join('')}</div></div>`;
    el.querySelectorAll('.lbrow').forEach(r => r.onclick = () => { $('#q').value = '@' + r.dataset.h; go('cards'); });
  }

  // ---------- 4. Cards ----------
  function cards() {
    const q = $('#q').value.trim().toLowerCase();
    let ps = posts();
    if (q) {
      const terms = q.split(/\s+/);
      ps = ps.filter(p => { const hay = (body(p) + ' ' + (p.quote ? (p.quote.text || '') + ' @' + (p.quote.handle || '') : '') + ' @' + p.handle + ' ' + (p.name || '') + ' ' + CL[p.cluster].name + ' ' + (p.notes || []).join(' ')).toLowerCase(); return terms.every(t => hay.includes(t)); });
    }
    const s = $('#sort').value, ev = (p, k) => (p.engagement || {})[k] || 0;
    ps.sort(s === 'old' ? (a, b) => (a.posted || '').localeCompare(b.posted || '') : s === 'views' ? (a, b) => ev(b, 'views') - ev(a, 'views') : s === 'bm' ? (a, b) => ev(b, 'bookmarks') - ev(a, 'bookmarks') : s === 'likes' ? (a, b) => ev(b, 'likes') - ev(a, 'likes') : (a, b) => (b.posted || '').localeCompare(a.posted || ''));
    $('#count').textContent = `${ps.length} result${ps.length === 1 ? '' : 's'}`;
    $('#cards').innerHTML = ps.map(cardHtml).join('') || '<div class="muted">Nothing matches.</div>';
    bindCards($('#cards'));
    $('#unl').innerHTML = `<p class="muted">These lines come from the bookmark sections of the interest-journal notes. The scrape didn't capture a post URL for them, so they aren't in the dataset above (no dates, text or engagement are guessed).</p>` +
      (A.unlinked || []).map(u => `<div style="margin:8px 0;font-size:13px">${u.handles.map(h => `<a href="https://x.com/${esc(h)}" target="_blank" rel="noopener">@${esc(h)}</a>`).join(' ')} <span class="muted">· ${esc(u.file)}:${u.line}</span><div class="muted">“${esc(u.text)}”</div></div>`).join('');
  }
  let qt; $('#q').oninput = () => { clearTimeout(qt); qt = setTimeout(cards, 120); };
  $('#sort').onchange = cards;

  // ---------- 5. Rabbit holes ----------
  function holes() {
    const el = $('#holes');
    const hs = A.rabbit_holes.filter(h => h.posts.every(id => byId[id] && !state.off.has(byId[id].cluster)));
    el.innerHTML = `<p class="muted" style="margin-top:0">Chains of bookmarks that lead into each other. Each hop goes to the most similar unvisited bookmark (TF-IDF cosine), with the shared words that link them. ${hs.length} chains, ${d3.sum(hs, h => h.posts.length)} bookmarks.</p>` +
      hs.map((h, i) => {
        const first = byId[h.posts[0]], last = byId[h.posts[h.posts.length - 1]];
        return `<div class="hole panel"><h3>Rabbit hole ${i + 1}: <span style="color:${col(first.cluster)}">${esc(h.keywords.slice(0, 3).join(' · ') || CL[first.cluster].name)}</span></h3>
        <div class="muted" style="font-size:12px">${h.posts.length} bookmarks · from ${esc(name(first))} to ${esc(name(last))} · avg similarity ${h.avg_sim.toFixed(2)} · ${h.theme_mix.map(([c, n]) => `<span style="color:${col(c)}">${esc(CL[c].name)}</span> ${n}`).join(', ')}</div>
        <div class="chain">${h.posts.map((id, k) => (k ? `<div class="hop"><div class="arrow">→</div><div>${esc(h.hops[k - 1].shared.join(', '))}</div><div>sim ${h.hops[k - 1].sim.toFixed(2)}</div></div>` : '') + cardHtml(byId[id])).join('')}</div></div>`;
      }).join('');
    bindCards(el);
  }

  // ---------- 6. This month ----------
  function month() {
    const M = A.month, el = $('#month');
    const w0 = new Date(M.window[0] + 'T12:00'), w1 = new Date(M.window[1] + 'T12:00');
    const top = M.themes[0], rising = M.themes.filter(t => t.n > t.prev).sort((a, b) => (b.n - b.prev) - (a.n - a.prev));
    const falling = M.themes.filter(t => t.n < t.prev).concat(A.clusters.filter(c => !M.themes.find(t => t.id === c.id)).map(c => ({ id: c.id, name: c.name, n: 0, prev: 0 })).filter(t => t.prev > 0));
    const prevAll = new Map(); A.posts.filter(p => p.kind === 'bookmark' && p.posted_date && p.posted_date >= M.prev_window[0] && p.posted_date <= M.prev_window[1]).forEach(p => prevAll.set(p.cluster, (prevAll.get(p.cluster) || 0) + 1));
    const cooled = [...prevAll.entries()].filter(([c, n]) => !(M.themes.find(t => t.id === c)) || M.themes.find(t => t.id === c).n < n).map(([c, n]) => ({ c, n, now: (M.themes.find(t => t.id === c) || { n: 0 }).n })).sort((a, b) => (b.n - b.now) - (a.n - a.now));
    const mv = M.most_viewed.map(x => byId[x.id]).filter(Boolean), mb = M.most_bookmarked.map(x => byId[x.id]).filter(Boolean);
    const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const newA = M.new_authors.length;
    const lead = `Between <b>${dfmt(w0)}</b> and <b>${dfmt(w1)}</b> you bookmarked <b>${pl(M.bookmarks_in_window, 'post')}</b> that are in the saved scrapes (published in that window), compared with <b>${M.bookmarks_prev_window}</b> in the 30 days before. ` +
      (top ? `The biggest theme was <b style="color:${col(top.id)}">${esc(top.name)}</b> with ${pl(top.n, 'bookmark')} (${top.prev} the month before). ` : '') +
      (rising.length ? `Growing: ${rising.slice(0, 3).map(t => `<b style="color:${col(t.id)}">${esc(t.name)}</b> (${t.prev} → ${t.n})`).join(', ')}. ` : '') +
      (cooled.length ? `Cooling: ${cooled.slice(0, 2).map(t => `<b style="color:${col(t.c)}">${esc(CL[t.c].name)}</b> (${t.n} → ${t.now})`).join(', ')}. ` : '') +
      (M.authors.length ? `Most-saved voices: ${M.authors.slice(0, 3).map(([h, n]) => `<b>@${esc(h)}</b> (${n})`).join(', ')}. ` : '') +
      `${pl(newA, 'author')} showed up for the first time.`;
    const maxN = d3.max(A.clusters, c => Math.max((M.themes.find(t => t.id === c.id) || { n: 0 }).n, prevAll.get(c.id) || 0)) || 1;
    const trows = A.clusters.map(c => ({ c, n: (M.themes.find(t => t.id === c.id) || { n: 0 }).n, p: prevAll.get(c.id) || 0 })).filter(r => r.n || r.p).sort((a, b) => b.n - a.n || b.p - a.p);
    el.innerHTML = `<div class="mgrid"><div class="panel"><h3>What you're into this month</h3><div class="lead">${lead}</div>
      <div class="kpis"><div class="kpi"><b>${M.bookmarks_in_window}</b><span class="muted">bookmarks, last 30 days</span></div><div class="kpi"><b>${M.bookmarks_prev_window}</b><span class="muted">prior 30 days</span></div><div class="kpi"><b>${M.themes.length}</b><span class="muted">themes touched</span></div><div class="kpi"><b>${newA}</b><span class="muted">new authors</span></div></div>
      <h3 style="margin-top:18px">Theme mix: last 30 days vs the 30 before</h3>${trows.map(r => `<div class="trow"><div style="color:${r.c.color}">${esc(r.c.name)}</div><div class="bars"><i style="width:${r.n / maxN * 100}%;background:${r.c.color}"></i><i style="width:${r.p / maxN * 100}%;background:${r.c.color}55"></i></div><div class="muted">${r.n} <small>vs ${r.p}</small></div></div>`).join('')}
      <div class="muted" style="font-size:11.5px;margin-top:8px">Solid bar = last 30 days, faded = previous 30. Counted by publish date, because the saved scrapes don’t record when you hit bookmark. The newest scrape is Oct 6, so recent days may be under-counted.</div></div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="panel"><h3>Biggest bookmarks this month (by views)</h3><div style="display:flex;flex-direction:column;gap:10px">${mv.map(cardHtml).join('')}</div></div>
        <div class="panel"><h3>Most-bookmarked by everyone</h3><div style="display:flex;flex-direction:column;gap:10px">${mb.filter(p => !mv.includes(p)).map(cardHtml).join('') || '<span class="muted">Same as above.</span>'}</div></div>
        <div class="panel"><h3>Latest saves</h3><div style="display:flex;flex-direction:column;gap:10px">${M.latest.slice(0, 3).map(id => byId[id]).filter(Boolean).map(cardHtml).join('')}</div></div>
      </div></div>`;
    bindCards(el);
  }

  // ---------- routing ----------
  const R = { galaxy, constellation, timeline, authors, cards, holes, month };
  function render() { header(); R[state.view](); }
  function go(v) {
    state.view = v;
    document.querySelectorAll('#tabs>button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
    render();
  }
  document.querySelectorAll('#tabs>button').forEach(b => b.onclick = () => go(b.dataset.view));
  document.querySelectorAll('#scope button').forEach(b => b.onclick = () => {
    state.scope = b.dataset.scope; document.querySelectorAll('#scope button').forEach(x => x.classList.toggle('on', x === b)); render();
  });
  document.querySelectorAll('#scope button').forEach(x => x.classList.toggle('on', x.dataset.scope === state.scope));
  if (params.get('q')) $('#q').value = params.get('q');
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 200); });
  go(params.get('view') && R[params.get('view')] ? params.get('view') : 'galaxy');
  if (params.get('open')) openPost(params.get('open'));
  window.__atlasReady = true;
  document.body.dataset.ready = '1';
})();
