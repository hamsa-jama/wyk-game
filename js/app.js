/* WYK — the game: screens, editor, puzzles, predictions, review, saving. */
(function () {
  'use strict';
  const W = window.WYK, E = W.Engine, C = W.Content, S = W.SRS;
  const $ = (s, root) => (root || document).querySelector(s);
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const DAY = 86400000;

  function el(tag, attrs) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (v === true) e.setAttribute(k, '');
        else e.setAttribute(k, v);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const kids = [].concat(arguments[i]);
      for (const kid of kids) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : String(kid));
    }
    return e;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const starStr = (n) => '★'.repeat(n) + '<span class="off">' + '★'.repeat(3 - n) + '</span>';
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  function relTime(t) {
    const d = t - Date.now();
    const a = Math.abs(d);
    let s;
    if (a < 3600000) s = Math.max(1, Math.round(a / 60000)) + ' min';
    else if (a < DAY) s = Math.round(a / 3600000) + ' hour' + (Math.round(a / 3600000) === 1 ? '' : 's');
    else s = Math.round(a / DAY) + ' day' + (Math.round(a / DAY) === 1 ? '' : 's');
    return d >= 0 ? 'in ' + s : s + ' ago';
  }

  /* ================================================================== */
  /* Save                                                                */
  /* ================================================================== */
  const KEY = 'wyk.save.v1';
  const SANDBOX_CODE = '# The open river. Try anything!\n# target holds one of tonight\'s glows.\nfor i in range(size()):\n    if peek(i) == target:\n        light_at(i)\n';
  function blankSave() {
    return {
      v: 1, created: Date.now(), last: Date.now(), name: '', levels: {}, concepts: {}, reviews: 0,
      settings: { speed: 3, sound: true, unlockAll: false },
      sandbox: { code: SANDBOX_CODE, size: 12, pattern: 'random', fog: false, blink: true }
    };
  }
  function normalizeSave(s) {
    const b = blankSave();
    return Object.assign(b, s, {
      settings: Object.assign(b.settings, s.settings || {}),
      sandbox: Object.assign(b.sandbox, s.sandbox || {}),
      levels: s.levels || {}, concepts: s.concepts || {}
    });
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalizeSave(JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
    return blankSave();
  }
  let save = loadSave();
  function persist() {
    save.last = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }
  function rec(id) { return save.levels[id] || (save.levels[id] = { done: false, stars: 0, attempts: 0, code: null }); }
  const isDone = (lv) => !!(save.levels[lv.id] && save.levels[lv.id].done);
  function chapterUnlocked(ci) {
    if (save.settings.unlockAll || ci === 0) return true;
    return C.CHAPTERS[ci - 1].levels.every(l => l.optional || isDone(l));
  }
  function levelUnlocked(lv) {
    if (save.settings.unlockAll) return true;
    if (!chapterUnlocked(lv.ci)) return false;
    if (lv.li === 0) return true;
    const prev = lv.chapter.levels[lv.li - 1];
    return isDone(prev) || !!prev.optional;
  }
  const nextLevel = () => C.LEVELS.find(l => !isDone(l) && levelUnlocked(l) && !l.optional) || C.LEVELS.find(l => !isDone(l) && levelUnlocked(l)) || null;
  const totalStars = () => C.LEVELS.reduce((a, l) => a + ((save.levels[l.id] && save.levels[l.id].stars) || 0), 0);

  /* memory (FSRS per concept) */
  function recordConcept(cid, g) {
    const now = Date.now();
    const st = save.concepts[cid];
    save.concepts[cid] = st ? S.FSRS.review(st, g, now) : S.FSRS.init(g, now);
  }
  const strength = (cid) => (save.concepts[cid] ? S.FSRS.retrievability(save.concepts[cid], Date.now()) : 0);
  const dueConcepts = () => Object.keys(save.concepts).filter(c => save.concepts[c].due <= Date.now()).sort((a, b) => strength(a) - strength(b));

  /* ================================================================== */
  /* Sound — lanterns ring on a pentatonic scale, so sorted rivers sing  */
  /* ================================================================== */
  const Sound = (function () {
    let ctx = null;
    const PENTA = [0, 2, 4, 7, 9];
    function ac() {
      if (!save.settings.sound) return null;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { return null; }
      return ctx;
    }
    function tone(freq, dur, type, vol, delay) {
      const c = ac();
      if (!c) return;
      const t = c.currentTime + (delay || 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function noteFor(v) {
      const n = typeof v === 'number' ? Math.abs(Math.round(v)) : 4;
      const step = Math.min(n, 24);
      const semis = 12 * Math.floor(step / 5) + PENTA[step % 5];
      return 261.63 * Math.pow(2, semis / 12);
    }
    return {
      light(v) { tone(noteFor(v), 0.5, 'triangle', 0.07); },
      peek(v) { tone(noteFor(v) * 2, 0.12, 'sine', 0.025); },
      swap() { tone(330, 0.09, 'sine', 0.03); tone(440, 0.09, 'sine', 0.03, 0.06); },
      ok() { [0, 4, 7, 12].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 0.5, 'triangle', 0.06, i * 0.09)); },
      bad() { tone(196, 0.25, 'sine', 0.05); tone(185, 0.3, 'sine', 0.04, 0.12); },
      tick() { tone(660, 0.05, 'sine', 0.02); },
      unlock() { ac(); }
    };
  })();

  /* ================================================================== */
  /* Code editor with highlighting and line marks                        */
  /* ================================================================== */
  const SPELL_SET = new Set(W.SPELL_ORDER);
  const BUILTIN_SET = new Set(['print', 'range', 'len', 'abs', 'min', 'max', 'sum', 'str', 'int', 'bool', 'list', 'sorted', 'reversed', 'round', 'append', 'pop', 'insert', 'index', 'count']);
  function highlight(text) {
    const re = /(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(___)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([^\w\s"'#]+|\s+)/g;
    let out = '';
    let m;
    while ((m = re.exec(text))) {
      if (m[1]) out += `<span class="c-com">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="c-str">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="c-blank">${esc(m[3])}</span>`;
      else if (m[4]) out += `<span class="c-num">${m[4]}</span>`;
      else if (m[5]) {
        const w = m[5];
        if (W.KEYWORDS.has(w)) out += `<span class="c-kw">${w}</span>`;
        else if (SPELL_SET.has(w)) out += `<span class="c-spell">${w}</span>`;
        else if (BUILTIN_SET.has(w)) out += `<span class="c-bi">${w}</span>`;
        else out += esc(w);
      } else out += esc(m[0]);
      if (m[0] === '') re.lastIndex++;
    }
    return out;
  }
  const highlightBlock = (code) => W.normalize(code).split('\n').map(highlight).join('\n');

  class Editor {
    constructor(host, opts) {
      this.opts = opts || {};
      this.root = el('div', { class: 'editor' });
      this.gutter = el('div', { class: 'ed-gutter', 'aria-hidden': 'true' });
      this.hl = el('pre', { class: 'ed-hl', 'aria-hidden': 'true' });
      this.ta = el('textarea', { class: 'ed-ta', id: 'code-input', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', 'aria-label': 'Your keeper\'s script' });
      const body = el('div', { class: 'ed-body' }, this.hl, this.ta);
      this.root.append(this.gutter, body);
      host.append(this.root);
      this.marks = {};
      this.ta.addEventListener('input', () => { this.marks = {}; this.refresh(); if (this.opts.onChange) this.opts.onChange(this.value); });
      this.ta.addEventListener('scroll', () => this.syncScroll());
      this.ta.addEventListener('keydown', (e) => this.onKey(e));
    }
    get value() { return this.ta.value; }
    set value(v) { this.ta.value = W.normalize(v); this.marks = {}; this.refresh(); }
    setReadOnly(ro) { this.ta.readOnly = !!ro; this.root.classList.toggle('readonly', !!ro); }
    syncScroll() {
      this.hl.scrollTop = this.ta.scrollTop;
      this.hl.scrollLeft = this.ta.scrollLeft;
      this.gutter.scrollTop = this.ta.scrollTop;
    }
    refresh() {
      const lines = this.ta.value.split('\n');
      this.hl.innerHTML = lines.map((l, i) => `<div class="ln${this.marks[i + 1] ? ' ' + this.marks[i + 1] : ''}">${highlight(l) || ' '}</div>`).join('') + '<div class="ln"> </div>';
      this.gutter.innerHTML = lines.map((l, i) => `<div class="${this.marks[i + 1] || ''}">${i + 1}</div>`).join('') + '<div></div>';
      const lh = parseFloat(getComputedStyle(this.root).fontSize) * 1.6 || 24;
      const h = Math.max(7, Math.min(24, lines.length + 2)) * lh + 24;
      this.root.style.height = h + 'px';
      this.syncScroll();
    }
    mark(line, cls) {
      for (const k of Object.keys(this.marks)) if (this.marks[k] === cls) delete this.marks[k];
      if (line) this.marks[line] = cls;
      const rows = this.hl.children;
      const gut = this.gutter.children;
      for (let i = 0; i < rows.length; i++) {
        const c = this.marks[i + 1];
        rows[i].className = 'ln' + (c ? ' ' + c : '');
        if (gut[i]) gut[i].className = c || '';
      }
      if (line && cls === 'cur') this.scrollToLine(line);
    }
    clearMarks() { this.marks = {}; this.mark(null); }
    scrollToLine(line) {
      const lh = parseFloat(getComputedStyle(this.root).fontSize) * 1.6 || 24;
      const top = (line - 1) * lh;
      if (top < this.ta.scrollTop || top > this.ta.scrollTop + this.ta.clientHeight - lh * 2) {
        this.ta.scrollTop = Math.max(0, top - lh * 2);
        this.syncScroll();
      }
    }
    insert(snippet) {
      if (this.ta.readOnly) return;
      const ta = this.ta;
      const v = ta.value;
      const s = ta.selectionStart, e = ta.selectionEnd;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const before = v.slice(ls, s);
      const indent = (before.match(/^ */) || [''])[0];
      let text = snippet.replace(/\n/g, '\n' + indent);
      if (before.trim().length) text = '\n' + indent + text;
      ta.focus();
      ta.setRangeText(text, s, e, 'end');
      this.marks = {};
      this.refresh();
      if (this.opts.onChange) this.opts.onChange(this.value);
    }
    onKey(e) {
      const ta = this.ta;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (this.opts.onRun) this.opts.onRun(); return; }
      if (ta.readOnly) return;
      const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (s !== en && v.slice(s, en).includes('\n')) {
          const le = v.indexOf('\n', en - 1) === -1 ? v.length : v.indexOf('\n', en - 1);
          const block = v.slice(ls, le);
          const nb = e.shiftKey ? block.replace(/^ {1,4}/gm, '') : block.replace(/^/gm, '    ');
          ta.setRangeText(nb, ls, le, 'select');
        } else if (e.shiftKey) {
          const line = v.slice(ls);
          const n = (line.match(/^ {1,4}/) || [''])[0].length;
          if (n) { ta.setRangeText('', ls, ls + n, 'preserve'); ta.selectionStart = ta.selectionEnd = Math.max(ls, s - n); }
        } else {
          ta.setRangeText('    ', s, en, 'end');
        }
        this.marks = {}; this.refresh(); if (this.opts.onChange) this.opts.onChange(this.value);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const line = v.slice(ls, s);
        let indent = (line.match(/^ */) || [''])[0];
        if (/:\s*(#.*)?$/.test(line)) indent += '    ';
        ta.setRangeText('\n' + indent, s, en, 'end');
        this.marks = {}; this.refresh(); if (this.opts.onChange) this.opts.onChange(this.value);
      } else if (e.key === 'Backspace' && s === en && s > ls) {
        const before = v.slice(ls, s);
        if (/^ +$/.test(before) && before.length % 4 === 0) {
          e.preventDefault();
          ta.setRangeText('', s - 4, s, 'end');
          this.marks = {}; this.refresh(); if (this.opts.onChange) this.opts.onChange(this.value);
        }
      }
    }
  }

  /* ================================================================== */
  /* Parsons puzzle (mixed-up lines)                                     */
  /* ================================================================== */
  class Parsons {
    constructor(host, solution, seed, onChange) {
      this.onChange = onChange;
      const lines = W.normalize(solution).split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
      this.blocks = lines.map((l, i) => ({ id: i, text: l.trim(), want: (l.match(/^ */)[0].length) / 4 }));
      const r = W.rng32(seed || 7);
      let order = S.shuffle(r, this.blocks.map(b => b.id));
      for (let t = 0; t < 5 && order.every((v, i) => this.blocks[v].text === this.blocks[i].text); t++) order = S.shuffle(r, order);
      this.pool = order;
      this.prog = [];
      this.root = el('div', { class: 'parsons' });
      host.append(this.root);
      this.render();
    }
    code() { return this.prog.map(p => '    '.repeat(p.indent) + this.blocks[p.id].text).join('\n'); }
    complete() { return this.pool.length === 0; }
    add(id) {
      const prev = this.prog[this.prog.length - 1];
      let indent = 0;
      if (prev) indent = /:$/.test(this.blocks[prev.id].text) ? prev.indent + 1 : prev.indent;
      this.pool = this.pool.filter(x => x !== id);
      this.prog.push({ id, indent });
      this.changed();
    }
    changed() { this.render(); if (this.onChange) this.onChange(); }
    render() {
      this.root.innerHTML = '';
      const prog = el('div', { class: 'p-area', 'aria-label': 'Your program' }, el('h4', { text: 'Your spell' }));
      if (!this.prog.length) prog.append(el('p', { class: 'p-empty', text: 'Tap a piece below to add it here. Use ← → to indent.' }));
      this.prog.forEach((p, k) => {
        const b = this.blocks[p.id];
        const move = (d) => { const j = k + d; if (j < 0 || j >= this.prog.length) return; const t = this.prog[k]; this.prog[k] = this.prog[j]; this.prog[j] = t; this.changed(); };
        const code = el('div', { class: 'p-code', style: `--indent-w:${p.indent * 2.4}em` }, el('span', { style: `padding-left:${p.indent * 2.4}em`, text: b.text }));
        prog.append(el('div', { class: 'p-row' },
          el('button', { class: 'icon-btn', 'aria-label': 'Indent less', onclick: () => { p.indent = Math.max(0, p.indent - 1); this.changed(); } }, '←'),
          el('button', { class: 'icon-btn', 'aria-label': 'Indent more', onclick: () => { p.indent = Math.min(6, p.indent + 1); this.changed(); } }, '→'),
          code,
          el('button', { class: 'icon-btn', 'aria-label': 'Move up', onclick: () => move(-1) }, '↑'),
          el('button', { class: 'icon-btn', 'aria-label': 'Move down', onclick: () => move(1) }, '↓'),
          el('button', { class: 'icon-btn', 'aria-label': 'Put back', onclick: () => { this.prog.splice(k, 1); this.pool.push(p.id); this.changed(); } }, '✕')
        ));
      });
      const pool = el('div', { class: 'p-area' }, el('h4', { text: 'Pieces' }));
      const row = el('div', { class: 'p-pool' });
      this.pool.forEach(id => row.append(el('button', { class: 'p-block', onclick: () => this.add(id) }, this.blocks[id].text)));
      if (!this.pool.length) row.append(el('p', { class: 'p-empty', text: 'All pieces placed. Press Check.' }));
      pool.append(row);
      this.root.append(prog, pool);
    }
  }

  /* ================================================================== */
  /* Animated runner                                                     */
  /* ================================================================== */
  const SPEEDS = { line: [700, 320, 140, 40, 0], act: [850, 480, 260, 110, 0], anim: [700, 420, 240, 120, 60] };
  function speedCfg() {
    const s = Math.min(5, Math.max(1, save.settings.speed | 0)) - 1;
    return { line: SPEEDS.line[s], act: SPEEDS.act[s], anim: SPEEDS.anim[s], instant: s === 4 };
  }
  class Run {
    constructor(gen, o) {
      this.gen = gen; this.o = o;
      this.paused = !!o.step; this.stepOnce = !!o.step;
      this.stopped = false; this._wake = null; this._sleep = null;
    }
    wake() { const w = this._wake; this._wake = null; if (w) w(); }
    stop() {
      this.stopped = true; this.wake();
      if (this._sleep) { clearTimeout(this._sleep.t); const r = this._sleep.res; this._sleep = null; r(); }
    }
    resume() { this.paused = false; this.wake(); }
    step() { this.paused = true; this.stepOnce = true; this.wake(); }
    sleep(ms) { return new Promise(res => { this._sleep = { res, t: setTimeout(() => { this._sleep = null; res(); }, ms) }; }); }
    async go() {
      let n = 0;
      for (;;) {
        if (this.stopped) return { aborted: true };
        if (this.paused && !this.stepOnce) { await new Promise(r => { this._wake = r; }); continue; }
        let r;
        try { r = this.gen.next(); } catch (e) { return { error: e }; }
        if (r.done) return { error: null };
        const ev = r.value;
        const sp = this.o.speed ? this.o.speed() : speedCfg();
        if (ev.t === 'line') {
          this.o.onLine(ev, sp, this.paused);
          if (this.paused) { this.stepOnce = false; continue; }
          if (sp.line > 0) await this.sleep(sp.line);
          else if (++n % 250 === 0) await nextFrame();
        } else {
          this.o.onAct(ev, sp);
          const d = this.paused ? Math.max(sp.act, 200) : sp.act;
          if (d > 0) await this.sleep(d);
          else if (++n % 40 === 0) await nextFrame();
        }
      }
    }
  }

  /* ================================================================== */
  /* Screens                                                             */
  /* ================================================================== */
  const SCREENS = ['title', 'map', 'level', 'review', 'codex'];
  let current = null;
  function show(name) {
    SCREENS.forEach(s => { $('#scr-' + s).hidden = s !== name; });
    document.querySelectorAll('.nav button[data-go]').forEach(b => {
      const on = b.dataset.go === name || (name === 'level' && L && L.lv.type === 'sandbox' && b.dataset.go === 'sandbox');
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    current = name;
    Demo.setActive(name === 'title');
    if (riverView) riverView.paused = name !== 'level';
    window.scrollTo(0, 0);
  }
  function go(where) {
    if (current === 'level') leaveLevel();
    if (where === 'title') { show('title'); Demo.start(); }
    else if (where === 'map') { renderMap(); show('map'); }
    else if (where === 'review') { renderReviewHome(); show('review'); }
    else if (where === 'codex') { renderCodex(); show('codex'); }
    else if (where === 'sandbox') openLevel('sandbox');
    updateBadge();
  }
  function updateBadge() {
    const n = dueConcepts().length;
    const b = $('#due-badge');
    b.hidden = n === 0;
    b.textContent = n;
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function modal(build) {
    const m = $('#modal'), card = $('#modal-card');
    card.innerHTML = '';
    build(card, closeModal);
    m.hidden = false;
    const f = card.querySelector('button.primary, button, input');
    if (f) setTimeout(() => f.focus(), 30);
  }
  function closeModal() { $('#modal').hidden = true; }

  /* ================================================================== */
  /* Title screen demo                                                   */
  /* ================================================================== */
  const Demo = (function () {
    let view = null, active = false, run = null, loopT = null;
    const code = 'for i in range(size()):\n    forward()\n    if glow() > 4:\n        light()';
    function start() {
      if (!view) {
        view = new W.RiverView($('#demo-canvas'));
        $('#demo-code').innerHTML = highlightBlock(code);
      }
      active = true;
      view.paused = false;
      cycle();
    }
    async function cycle() {
      if (!active || run) return;
      const r = W.rng32((Date.now() / 1000) | 0);
      const world = new W.River({ glows: C.R.glows(r, 9, 1, 9) });
      view.setWorld(world, { showGlow: true });
      view.animMs = 420;
      const interp = new W.Interp({ api: W.makeApi(world, ['forward', 'light', 'glow', 'size']) });
      run = new Run(interp.run(W.parse(code)), { onLine: () => {}, onAct: (ev) => view.onAct(ev), speed: () => ({ line: 260, act: 420, anim: 380, instant: false }) });
      await run.go();
      run = null;
      if (active) loopT = setTimeout(cycle, 2200);
    }
    function setActive(on) {
      active = on;
      if (view) view.paused = !on;
      if (!on) { clearTimeout(loopT); if (run) { run.stop(); run = null; } }
    }
    return { start, setActive };
  })();

  /* ================================================================== */
  /* Map                                                                 */
  /* ================================================================== */
  const TYPE_SHORT = { predict: 'predict', write: 'write', fill: 'fill', parsons: 'puzzle', debug: 'fix' };
  function renderMap() {
    $('#map-kicker').textContent = save.name ? `Keeper ${save.name}'s route` : 'Keeper\'s route';
    const done = C.LEVELS.filter(isDone).length;
    const due = dueConcepts();
    $('#map-stats').innerHTML = '';
    $('#map-stats').append(
      el('div', { class: 'stat' }, el('b', { text: totalStars() + ' / ' + C.LEVELS.length * 3 }), el('span', { text: 'stars' })),
      el('div', { class: 'stat' }, el('b', { text: done + ' / ' + C.LEVELS.length }), el('span', { text: 'lanterns lit' })),
      el('div', { class: 'stat' }, el('b', { text: Object.keys(save.concepts).length }), el('span', { text: 'embers' }))
    );
    const banner = $('#ember-banner');
    banner.innerHTML = '';
    if (due.length) {
      banner.append(el('div', { class: 'banner' },
        el('p', { html: `<strong>${due.length} ember${due.length > 1 ? 's are' : ' is'} fading:</strong> ${due.map(c => C.CONCEPTS[c].name).join(', ')}. A two-minute recall now keeps ${due.length > 1 ? 'them' : 'it'} bright for much longer than re-reading would.` }),
        el('button', { class: 'btn primary small', onclick: () => go('review') }, 'Warm them')
      ));
    }
    const route = $('#route');
    route.innerHTML = '';
    const nx = nextLevel();
    C.CHAPTERS.forEach((ch, ci) => {
      const unlocked = chapterUnlocked(ci);
      const doneCount = ch.levels.filter(isDone).length;
      const allDone = ch.levels.every(l => l.optional || isDone(l));
      const st = strength(ch.concept);
      const nodes = el('div', { class: 'nodes' });
      ch.levels.forEach((lv) => {
        const r = save.levels[lv.id];
        const can = levelUnlocked(lv);
        const cls = ['node', isDone(lv) ? 'done' : '', nx && nx.id === lv.id ? 'next' : '', lv.challenge ? 'challenge' : '', lv.optional ? 'optional' : ''].join(' ');
        nodes.append(el('button', {
          class: cls, disabled: !can, onclick: () => openLevel(lv.id),
          'aria-label': `${lv.title} (${TYPE_SHORT[lv.type]})${r && r.stars ? ', ' + r.stars + ' stars' : ''}${can ? '' : ', locked'}`,
          title: lv.title
        },
        el('span', { class: 'node-dot', text: lv.optional ? '✦' : String(lv.li + 1) }),
        el('span', { class: 'node-type', text: lv.optional ? 'trial' : lv.challenge ? 'challenge' : TYPE_SHORT[lv.type] }),
        el('span', { class: 'node-stars', text: r && r.stars ? '★'.repeat(r.stars) : '' })));
      });
      const meter = save.concepts[ch.concept]
        ? el('span', { class: 'ember-meter', title: 'How strongly you remember this idea right now' }, el('i', {}, el('b', { style: `width:${Math.round(st * 100)}%` })), Math.round(st * 100) + '% ember')
        : el('span', { class: 'chap-concept', text: C.CONCEPTS[ch.concept].name });
      route.append(el('li', { class: `chap ${!unlocked ? 'locked' : ''} ${allDone ? 'lit' : doneCount ? 'started' : ''}` },
        el('div', { class: 'chap-num', text: ROMAN[ch.num] }),
        el('div', { class: 'chap-body' },
          el('div', { class: 'chap-top' }, el('h2', { text: ch.title }), meter),
          el('p', { class: 'chap-story', text: unlocked ? ch.story : 'Light every lantern on the stretch before this one to reach it.' }),
          nodes)));
    });
  }

  /* ================================================================== */
  /* Level                                                               */
  /* ================================================================== */
  let L = null;
  let riverView = null;
  let saveTimer = null;

  function sandboxLevel() {
    return {
      id: 'sandbox', type: 'sandbox', title: 'Open River', concept: null,
      api: W.SPELL_ORDER.slice(), chapter: { num: 11, title: 'Open river', world: {} }, li: 0, ci: 99,
      view: { showGlow: true, blink: !!save.sandbox.blink }, maxSteps: 200000,
      brief: '<p>No goal, no stars — just you and the river. Every spell you have met is available here. Build an algorithm, test an idea, make the lanterns sing. Your code is kept between visits.</p>'
    };
  }
  function sandboxCfg() {
    const s = save.sandbox;
    const r = W.rng32((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const n = Math.max(1, Math.min(32, s.size | 0 || 12));
    let g;
    switch (s.pattern) {
      case 'sorted': g = C.R.sortedDistinct(r, n, 1, 99); break;
      case 'crest': { const v = C.R.sortedDistinct(r, n, 1, 99); const top = v.pop(); const left = v.filter((x, i) => i % 2 === 0); const right = v.filter((x, i) => i % 2 === 1).reverse(); g = left.concat([top], right); break; }
      case 'three': g = C.R.glows(r, n, 1, 3); break;
      case 'zeros': g = C.R.glows(r, n, 0, 9).map(x => (x < 3 ? 0 : x)); break;
      default: g = C.R.glows(r, n, 1, 20);
    }
    return { glows: g, fog: !!s.fog, vars: { target: C.R.pick(r, g) } };
  }

  function openLevel(id) {
    if (current === 'level') leaveLevel();
    const lv = id === 'sandbox' ? sandboxLevel() : C.BY_ID[id];
    if (!lv) return;
    L = {
      lv, run: null, runs: 0, failRuns: 0, hints: 0, started: Date.now(), scaffolded: false,
      phase: lv.type === 'predict' ? 'predict' : 'edit', predictSel: new Set(), choice: null, conf: null,
      editor: null, parsons: null, cfg: null, world: null, lastScope: null, prevWatch: {}
    };
    show('level');
    if (!riverView) {
      riverView = new W.RiverView($('#river-canvas'));
      riverView.onTap = onRiverTap;
    }
    riverView.skyStars = 40 + totalStars() * 2;
    $('#lvl-back').textContent = '← River';
    $('#lvl-kicker').textContent = lv.type === 'sandbox' ? 'Free play' : `Stretch ${ROMAN[lv.chapter.num]} · ${lv.chapter.title} · ${lv.li + 1} of ${lv.chapter.levels.length}`;
    $('#lvl-name').textContent = lv.title;
    renderLevelStars();
    $('#speed').value = save.settings.speed;
    L.cfg = lv.type === 'sandbox' ? sandboxCfg() : E.configFor(lv, 0, 1);
    renderBrief();
    renderTask();
    resetWorld();
    clearFeedback();
    updateControls();
    clearTimeout(openLevel.hintT);
    openLevel.hintT = setTimeout(updateControls, 45000);
  }
  function leaveLevel() {
    if (L && L.run) { L.run.stop(); L.run = null; }
    flushSave();
    if (riverView) riverView.tapMode = null;
  }
  function renderLevelStars() {
    const box = $('#lvl-stars');
    if (L.lv.type === 'sandbox') { box.innerHTML = ''; return; }
    const r = save.levels[L.lv.id];
    box.innerHTML = starStr(r ? r.stars : 0);
  }

  function renderBrief() {
    const lv = L.lv;
    const b = $('#brief');
    b.innerHTML = '';
    const head = el('div', { class: 'brief-head' });
    if (lv.type !== 'sandbox') {
      head.append(el('span', { class: 'tag', text: E.TYPE_LABEL[L.scaffolded ? 'parsons' : lv.type] }));
      if (lv.challenge) head.append(el('span', { class: 'tag hot', text: 'Challenge' }));
      if (lv.optional) head.append(el('span', { class: 'tag hot', text: 'Grandmaster trial' }));
      if (lv.gen && lv.tests) head.append(el('span', { class: 'tag alt', text: `Tested on ${lv.tests + 1} rivers` }));
      const lim = lv.limits || {};
      Object.keys(lim).forEach(k => head.append(el('span', { class: 'tag alt', text: `Max ${E.val(lim[k], L.cfg)} ${E.OP_NAMES[k]}` })));
    } else head.append(el('span', { class: 'tag', text: 'Open river' }));
    b.append(head);
    if (lv.li === 0 && lv.chapter.story && lv.type !== 'sandbox') b.append(el('p', { class: 'story', text: lv.chapter.story }));
    b.append(el('div', { html: lv.brief }));
    if (L.scaffolded) b.append(el('p', { html: '<strong>Puzzle mode:</strong> the right lines are all here, mixed up. Stars are capped at two — come back later and write it from scratch for the third.' }));
    if (lv.intro && lv.concept && C.CONCEPTS[lv.concept]) {
      const cc = C.CONCEPTS[lv.concept];
      b.append(el('div', { class: 'concept-card' },
        el('p', { html: `<strong>New idea · ${esc(cc.name)}.</strong> ${esc(cc.summary)}` }),
        el('pre', { html: highlightBlock(cc.example) })));
    }
    if (lv.type === 'sandbox') b.append(sandboxControls());
    else {
      const rules = el('div', { class: 'rules', 'aria-label': 'How to earn stars' });
      const got = (save.levels[lv.id] && save.levels[lv.id].stars) || 0;
      E.starRules(lv).forEach((t, i) => rules.append(el('span', { class: i < got ? 'got' : '', text: t })));
      b.append(rules);
    }
  }

  function sandboxControls() {
    const s = save.sandbox;
    const sizeIn = el('input', { type: 'number', id: 'sb-size', min: '1', max: '32', value: String(s.size) });
    const pat = el('select', { id: 'sb-pattern' },
      [['random', 'Random glows'], ['sorted', 'Sorted'], ['crest', 'Rise then fall'], ['three', 'Only 1, 2, 3'], ['zeros', 'Some dark (0)']].map(([v, t]) => el('option', { value: v, selected: s.pattern === v }, t)));
    const fog = el('input', { type: 'checkbox', id: 'sb-fog', checked: s.fog });
    const blink = el('input', { type: 'checkbox', id: 'sb-blink', checked: s.blink });
    const apply = () => {
      s.size = Math.max(1, Math.min(32, parseInt(sizeIn.value, 10) || 12));
      s.pattern = pat.value; s.fog = fog.checked; s.blink = blink.checked;
      persist();
      L.lv.view.blink = s.blink;
      L.cfg = sandboxCfg();
      resetWorld();
    };
    [sizeIn, pat, fog, blink].forEach(x => x.addEventListener('change', apply));
    return el('div', { class: 'sb-controls' },
      el('label', {}, 'Lanterns', sizeIn), el('label', {}, 'River', pat),
      el('label', {}, fog, 'Fog'), el('label', {}, blink, 'Ember blinks'),
      el('button', { class: 'btn small', onclick: apply, style: 'background:var(--ink);color:var(--paper)' }, 'New river'));
  }

  const SYNTAX = [
    { ch: 2, label: 'for loop', snip: 'for i in range(3):\n    ' },
    { ch: 2, label: 'print(x)', snip: 'print()' },
    { ch: 3, label: 'if', snip: 'if glow() > 5:\n    ', blink: 'if peek(i) > 5:\n    ' },
    { ch: 3, label: 'else', snip: 'else:\n    ' },
    { ch: 4, label: 'while', snip: 'while not at_end():\n    ', blink: 'while lo <= hi:\n    ' },
    { ch: 4, label: 'break', snip: 'break' },
    { ch: 5, label: 'count = 0', snip: 'count = 0' },
    { ch: 5, label: 'count += 1', snip: 'count += 1' },
    { ch: 6, label: 'def', snip: 'def spell(x):\n    ' },
    { ch: 6, label: 'return', snip: 'return ' },
    { ch: 7, label: 'vals = []', snip: 'vals = []' },
    { ch: 7, label: '.append()', snip: 'vals.append()' },
    { ch: 8, label: 'mid', snip: 'mid = (lo + hi) // 2' }
  ];
  function renderPalette(host) {
    const lv = L.lv;
    const pal = el('div', { class: 'palette', 'aria-label': 'Spells — tap to insert' });
    lv.api.forEach((name) => {
      const sp = W.SPELLS[name];
      const sig = `${name}(${sp.params.join(', ')})`;
      pal.append(el('button', { class: 'spell', title: sp.doc, onclick: () => L.editor && L.editor.insert(sig) }, sig));
    });
    SYNTAX.filter(s => lv.chapter.num >= s.ch).forEach((s) => {
      pal.append(el('button', { class: 'spell syn', onclick: () => L.editor && L.editor.insert(lv.view.blink && s.blink ? s.blink : s.snip) }, s.label));
    });
    if (lv.type !== 'predict' && lv.type !== 'sandbox' && lv.type !== 'parsons') {
      let armed = false;
      const btn = el('button', { class: 'btn ghost small', style: 'margin-left:auto', onclick: () => {
        if (!armed) { armed = true; btn.textContent = 'Tap again to restore'; setTimeout(() => { armed = false; btn.textContent = 'Restore starter code'; }, 2500); return; }
        L.editor.value = lv.code || ''; onCodeChange(L.editor.value); btn.textContent = 'Restore starter code'; armed = false;
      } }, 'Restore starter code');
      pal.append(btn);
    }
    host.append(pal);
  }

  function onCodeChange(v) {
    if (!L) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 400);
    L.dirty = v;
  }
  function flushSave() {
    clearTimeout(saveTimer);
    if (!L || L.dirty == null) return;
    if (L.lv.type === 'sandbox') save.sandbox.code = L.dirty;
    else rec(L.lv.id).code = L.dirty;
    L.dirty = null;
    persist();
  }

  function renderTask() {
    const lv = L.lv;
    const host = $('#task');
    host.innerHTML = '';
    L.editor = null; L.parsons = null;
    const box = el('div', { style: 'display:grid;gap:10px' });
    host.append(box);
    if (lv.type === 'parsons' || L.scaffolded) {
      L.parsons = new Parsons(box, lv.solution, lv.seed, updateControls);
    } else {
      if (lv.type !== 'predict') renderPalette(box);
      L.editor = new Editor(box, { onChange: onCodeChange, onRun: () => startRun(false) });
      if (lv.type === 'predict') { L.editor.value = lv.code; L.editor.setReadOnly(true); }
      else if (lv.type === 'sandbox') L.editor.value = save.sandbox.code;
      else {
        const r = save.levels[lv.id];
        L.editor.value = (r && r.code != null) ? r.code : (lv.code || '');
      }
      if (lv.type === 'predict') box.append(predictPanel());
    }
  }

  function currentCode() {
    if (L.parsons) return L.parsons.code();
    return L.editor ? L.editor.value : '';
  }

  /* ---------- world + HUD ---------- */
  function targetsFor(cfg) {
    const g = L.lv.goal;
    return g && g.type === 'lit' ? g.target(cfg) : [];
  }
  function resetWorld() {
    L.world = new W.River(L.cfg);
    riverView.animMs = speedCfg().anim;
    riverView.setWorld(L.world, { targets: targetsFor(L.cfg), showGlow: L.lv.view.showGlow !== false, blink: !!L.lv.view.blink });
    if (L.phase === 'predict' && L.lv.predict && L.lv.predict.mode === 'lit') {
      riverView.tapMode = 'lit';
      riverView.predict = L.predictSel;
    } else riverView.tapMode = null;
    $('#stage').classList.toggle('tappable', !!riverView.tapMode);
    $('#console').innerHTML = '';
    renderWatch(null);
    renderHud();
    if (L.editor) L.editor.clearMarks();
  }
  function opsShown() {
    const a = L.lv.api;
    const k = [];
    if (a.includes('forward') || a.includes('back')) k.push('moves');
    if (a.includes('glow') || a.includes('peek')) k.push('peeks');
    if (a.includes('swap')) k.push('swaps');
    if (a.includes('less')) k.push('compares');
    return k;
  }
  function renderHud(testState) {
    const hud = $('#hud');
    hud.innerHTML = '';
    const w = L.world;
    const lim = L.lv.limits || {};
    opsShown().forEach((k) => {
      const limit = lim[k] != null ? E.val(lim[k], L.cfg) : null;
      const v = w.ops[k];
      hud.append(el('span', { class: 'chip' + (limit != null && v > limit ? ' over' : '') }, E.OP_NAMES[k], el('b', { text: limit != null ? `${v} / ${limit}` : String(v) })));
    });
    if (L.lv.gen && L.lv.tests) {
      const dots = el('span', { class: 'dots', 'aria-label': 'Rivers tested' });
      for (let k = 0; k <= L.lv.tests; k++) {
        const s = testState ? testState[k] : null;
        dots.append(el('i', { class: (k === 0 ? 'vis ' : '') + (s || '') }));
      }
      hud.append(el('span', { class: 'chip' }, 'rivers', dots));
    }
    if (L.lv.type === 'sandbox') hud.append(el('span', { class: 'chip' }, 'lanterns', el('b', { text: String(w.n) })));
  }

  /* ---------- Ember's memory (variables) ---------- */
  const PTR = /^(i|j|k|lo|hi|mid|w|r|left|right|pos|best|best_pos|a|b|p|q|low|high|start|end|idx|cur)$/;
  function renderWatch(scope, interp) {
    const box = $('#watch');
    box.innerHTML = '';
    const pointers = [];
    if (!scope) {
      box.append(el('div', { class: 'w-empty', text: 'Variables appear here while your spell runs.' }));
      if (riverView) riverView.pointers = [];
      return;
    }
    const prev = L.prevWatch || {};
    const now = {};
    const addRows = (map, prefix) => {
      let any = false;
      map.forEach((v, k) => {
        if (v && (v.type === 'func' || v.type === 'builtin')) return;
        any = true;
        const s = W.repr(v, true);
        const key = prefix + k;
        now[key] = s;
        box.append(el('div', { class: 'w-row' + (prev[key] !== undefined && prev[key] !== s ? ' changed' : '') }, el('span', { class: 'w-name', text: k }), el('span', { class: 'w-val', text: s.length > 60 ? s.slice(0, 59) + '…' : s })));
        if (typeof v === 'number' && Number.isInteger(v) && PTR.test(k) && v >= 0 && v < L.world.n && pointers.length < 4 && !pointers.some(p => p.name === k)) pointers.push({ name: k, i: v });
      });
      return any;
    };
    if (scope.locals && interp) {
      const stack = interp.callStack;
      const top = stack[stack.length - 1];
      box.append(el('div', { class: 'w-head', text: `inside ${scope.fname}()` + (stack.length > 1 ? `  · ${stack.length} calls deep` : '') }));
      if (!addRows(scope.vars, 'L:')) box.append(el('div', { class: 'w-empty', text: '(nothing yet)' }));
      box.append(el('div', { class: 'w-head', text: 'outside' }));
      void top;
    }
    if (!addRows(interp ? interp.globalScope.vars : new Map(), 'G:') && !scope.locals) box.append(el('div', { class: 'w-empty', text: 'No variables yet.' }));
    L.prevWatch = now;
    if (riverView) riverView.pointers = (L.lv.view.blink || L.lv.type === 'sandbox') ? pointers : [];
  }

  /* ---------- feedback ---------- */
  function clearFeedback() { $('#feedback').innerHTML = ''; }
  function fb(kind, title, body, actions) {
    const m = el('div', { class: 'msg ' + kind });
    if (title) m.append(el('div', { class: 'msg-title', text: title }));
    if (body) m.append(typeof body === 'string' ? el('div', { html: body }) : body);
    if (actions && actions.length) m.append(el('div', { class: 'row' }, actions));
    $('#feedback').append(m);
    return m;
  }
  const ENCOURAGE = ['Bugs are clues. Read the message, then step through to watch where it goes wrong.', 'Every keeper\'s spell fails before it works. What does the river tell you?', 'Try Step to run one line at a time and watch Ember\'s memory.', 'Close! Compare what happened with what you expected.'];

  /* ---------- controls ---------- */
  function updateControls() {
    if (!L || current !== 'level') return;
    const lv = L.lv;
    const running = !!L.run;
    const predictPhase = L.phase === 'predict';
    $('#btn-run').hidden = predictPhase;
    $('#btn-step').hidden = predictPhase;
    $('#btn-run').textContent = running ? (L.run.paused ? 'Continue ▶' : 'Running…') : (L.parsons ? 'Check ▶' : 'Run ▶');
    $('#btn-run').disabled = running && !L.run.paused;
    $('#btn-step').disabled = false;
    $('#btn-stop').disabled = !running;
    $('#btn-reset').disabled = running;
    const hasHints = lv.hints && lv.hints.length && lv.type !== 'predict' && lv.type !== 'sandbox';
    $('#btn-hint').hidden = !hasHints;
    if (hasHints) {
      const left = lv.hints.length - L.hints;
      $('#btn-hint').textContent = left > 0 ? `Hint (${left})` : 'No hints left';
      $('#btn-hint').disabled = left <= 0;
    }
  }

  /* ---------- running ---------- */
  async function startRun(step) {
    if (!L) return;
    if (L.run) {
      if (step) L.run.step(); else L.run.resume();
      updateControls();
      return;
    }
    Sound.unlock();
    const lv = L.lv;
    const code = currentCode();
    clearFeedback();
    if (L.parsons && !L.parsons.complete() && !L.parsons.prog.length) { fb('err', 'Add some pieces first', 'Tap the pieces to build your spell.'); return; }
    let ast;
    try { ast = W.parse(code); } catch (e) {
      if (L.editor && e.line) L.editor.mark(e.line, 'err');
      fb('err', 'The spell doesn\'t make sense yet', esc(E.friendly(e)));
      Sound.bad();
      countRun(false);
      return;
    }
    const req = lv.type === 'sandbox' || lv.type === 'predict' ? null : E.requirementsError(lv, ast, code);
    if (req) { fb('err', 'Almost', esc(req)); return; }
    flushSave();
    resetWorld();
    riverView.marks = {};
    const world = L.world;
    let output = '';
    const interp = E.buildInterp(lv, world, (s) => { output += s; appendConsole(s); });
    L.interp = interp;
    const run = new Run(interp.run(ast), {
      step,
      onLine: (ev, sp, paused) => {
        if (!sp.instant || paused) {
          L.editor && L.editor.mark(ev.line, 'cur');
          renderWatch(ev.scope, interp);
        }
        L.lastScope = ev.scope;
      },
      onAct: (ev, sp) => {
        riverView.animMs = sp.anim;
        riverView.onAct(ev);
        if (!sp.instant) {
          if (ev.a === 'light') Sound.light(world.lanterns[ev.i] ? world.lanterns[ev.i].v : 3);
          else if (ev.a === 'peek') Sound.peek(world.lanterns[ev.i] ? world.lanterns[ev.i].v : 3);
          else if (ev.a === 'swap') Sound.swap();
          else if (ev.a === 'move') Sound.tick();
        }
        renderHud();
      }
    });
    L.run = run;
    updateControls();
    const me = L;
    const r = await run.go();
    if (L !== me) return;
    L.run = null;
    if (L.editor) L.editor.mark(null, 'cur');
    if (L.lastScope) renderWatch(L.lastScope, interp);
    renderHud();
    updateControls();
    if (r.aborted) { fb('', 'Stopped', 'Press Reset river or Run to try again.'); return; }
    const res = E.judge(lv, L.cfg, world, r.error, output);
    res.world = world; res.output = output; res.cfg = L.cfg;
    afterRun(res, code);
  }
  function appendConsole(s) {
    const c = $('#console');
    c.textContent += s;
    if (c.textContent.length > 8000) c.textContent = c.textContent.slice(-6000);
    c.scrollTop = c.scrollHeight;
  }
  function countRun(ok) {
    if (L.lv.type === 'sandbox' || L.lv.type === 'predict') return;
    L.runs++;
    if (!ok) L.failRuns++;
    rec(L.lv.id).attempts++;
    persist();
  }

  function afterRun(res, code) {
    const lv = L.lv;
    if (lv.type === 'sandbox') {
      if (res.error) { if (res.error.line && L.editor) L.editor.mark(res.error.line, 'err'); fb('err', 'Ember stopped', esc(res.msg)); Sound.bad(); }
      else {
        const o = res.world.ops;
        fb('ok', 'Done', `Moves ${o.moves} · peeks ${o.peeks} · swaps ${o.swaps} · comparisons ${o.compares}` + (res.world.answered ? ` · answer ${esc(W.repr(res.world.answer, true))}` : ''));
      }
      return;
    }
    if (lv.type === 'predict') return predictResult(res);
    if (res.marks) riverView.marks = res.marks;
    if (!res.ok) {
      countRun(false);
      if (res.error && res.error.line && L.editor) L.editor.mark(res.error.line, 'err');
      Sound.bad();
      const actions = [];
      if (L.failRuns >= 3 && !L.scaffolded && lv.solution && lv.type !== 'parsons') {
        actions.push(el('button', { class: 'btn small', onclick: enterScaffold }, 'Show me the pieces (puzzle mode)'));
      }
      if (lv.hints && L.hints < lv.hints.length && lv.type !== 'parsons' && !L.scaffolded) {
        actions.push(el('button', { class: 'btn ghost small', onclick: showHint }, 'I\'d like a hint'));
      }
      fb('err', res.error ? 'Ember stopped' : 'Not yet', esc(res.msg) + `<p style="color:var(--muted);margin-top:6px">${ENCOURAGE[(L.failRuns - 1) % ENCOURAGE.length]}</p>`, actions);
      updateControls();
      return;
    }
    // visible river passed — now the hidden rivers
    const results = [res];
    const states = ['ok'];
    let ast;
    try { ast = W.parse(code); } catch (e) { return; }
    const seed = (Date.now() & 0x7fffffff) >>> 0;
    for (let k = 1; k <= (lv.gen ? lv.tests || 0 : 0); k++) {
      const cfg = E.configFor(lv, k, seed);
      const r = E.runOnce(lv, ast, cfg);
      if (!r.ok) {
        states.push('bad');
        renderHud(states);
        countRun(false);
        Sound.bad();
        fb('err', `Worked here, but not on river ${k + 1}`,
          `It lit up the river you can see, but on another river: ${esc(r.msg)}<p style="color:var(--muted);margin-top:6px">A keeper's spell has to work on <em>any</em> river, not just tonight's. Look for numbers you typed that should come from the river instead.</p>`,
          [el('button', { class: 'btn small', onclick: () => { L.cfg = cfg; clearFeedback(); resetWorld(); fb('', 'This is the river that failed', 'Run your spell on it and watch what happens.'); } }, 'Show me that river')]);
        return;
      }
      states.push('ok');
      results.push(r);
    }
    renderHud(states);
    countRun(true);
    completeLevel(results, code);
  }

  function enterScaffold() {
    L.scaffolded = true;
    L.runs = 0;
    L.failRuns = 0;
    flushSave();
    clearFeedback();
    renderBrief();
    renderTask();
    resetWorld();
    updateControls();
  }

  function showHint() {
    const lv = L.lv;
    if (!lv.hints || L.hints >= lv.hints.length) return;
    const elapsed = (Date.now() - L.started) / 1000;
    if (L.runs === 0 && elapsed < 45) {
      fb('hint', 'Have a go first', `Run your idea first, even if you're unsure. Mistakes show you what to fix, and working it out yourself makes it stick. Hints unlock after your first run, or in ${Math.ceil(45 - elapsed)} seconds.`);
      return;
    }
    const h = lv.hints[L.hints];
    L.hints++;
    fb('hint', `Hint ${L.hints} of ${lv.hints.length}`, h.includes('\n') ? el('pre', { text: h }) : el('div', { text: h }));
    updateControls();
  }

  function completeLevel(results, code) {
    const lv = L.lv;
    let stars, checks, rules = E.starRules(lv);
    if (lv.type === 'parsons' || L.scaffolded) {
      checks = [true, L.runs <= 2, L.hints === 0];
      stars = checks.filter(Boolean).length;
      if (L.scaffolded) { stars = Math.min(stars, 2); rules = ['Solve it', 'Within 2 checks', 'Without hints (puzzle mode caps at 2)']; }
    } else {
      const s = E.starsFor(lv, results, code, { hintsUsed: L.hints > 0, runs: L.runs, scaffolded: L.scaffolded });
      stars = s.stars; checks = s.checks;
    }
    const r = rec(lv.id);
    const first = !r.done;
    const conceptNew = lv.concept && !save.concepts[lv.concept];
    r.done = true;
    r.stars = Math.max(r.stars || 0, stars);
    if (!L.parsons) r.code = code;
    r.solvedAt = Date.now();
    if (lv.concept) recordConcept(lv.concept, (L.hints === 0 && L.runs <= 3 && !L.scaffolded) ? 3 : 2);
    persist();
    renderLevelStars();
    renderBrief();
    Sound.ok();
    const g = riverView.geom();
    for (let i = 0; i < L.world.n; i += Math.max(1, Math.floor(L.world.n / 6))) riverView.burst(riverView.slotX(i), g.water, 10, '#ffd98f');
    showSuccess(stars, checks, rules, results, { first, conceptNew });
  }

  function showSuccess(stars, checks, rules, results, info) {
    const lv = L.lv;
    const ch = lv.chapter;
    const chDone = ch.levels.every(l => l.optional || isDone(l));
    const nxt = lv.chapter.levels[lv.li + 1] || (C.CHAPTERS[lv.ci + 1] && C.CHAPTERS[lv.ci + 1].levels[0]);
    const praise = stars === 3 ? 'Every star. That spell is clean and careful.' : stars === 2 ? 'Lit! There\'s one more star for a sharper spell.' : 'Lit! Your spell works — now see if you can make it better.';
    modal((card, close) => {
      card.append(el('p', { class: 'kicker', text: results.length > 1 ? `Passed all ${results.length} rivers` : 'River lit' }));
      card.append(el('h2', { text: lv.title }));
      card.append(el('div', { class: 'big-stars', html: starStr(stars) }));
      card.append(el('p', { text: praise }));
      const ul = el('ul', {});
      rules.forEach((t, i) => ul.append(el('li', { html: (checks[i] ? '★ ' : '☆ ') + esc(t) })));
      card.append(ul);
      if (info.conceptNew && lv.concept) {
        card.append(el('p', { html: `<strong>A new ember: ${esc(C.CONCEPTS[lv.concept].name)}.</strong> In a few days it will start to fade. When it does, a short recall in Embers keeps it bright. Spaced recall like this is one of the most reliable ways to remember anything.` }));
      }
      if (chDone && info.first && lv.chapter.levels.filter(l => !l.optional).slice(-1)[0] === lv) {
        const nc = C.CHAPTERS[lv.ci + 1];
        card.append(el('p', { html: `<strong>Stretch ${ROMAN[ch.num]} complete!</strong> ${nc ? `The river opens onto <em>${esc(nc.title)}</em>.` : 'You have reached the river\'s mouth. Try the grandmaster trials, or build something of your own on the open river.'}` }));
      }
      const row = el('div', { class: 'row' });
      row.append(el('button', { class: 'btn ghost', onclick: () => { close(); } }, 'Stay here'));
      row.append(el('button', { class: 'btn', onclick: () => { close(); go('map'); } }, 'River map'));
      if (nxt && levelUnlocked(nxt)) row.append(el('button', { class: 'btn primary', onclick: () => { close(); openLevel(nxt.id); } }, 'Next →'));
      card.append(row);
    });
  }

  /* ---------- predictions (PRIMM) ---------- */
  function predictPanel() {
    const lv = L.lv;
    const p = lv.predict;
    const box = el('div', { class: 'predict', id: 'predict' });
    if (p.mode === 'lit') {
      box.append(el('h3', { text: p.prompt || 'Tap the lanterns you think will be lit.' }));
      box.append(el('p', { class: 'sel', id: 'pred-sel', text: 'Your prediction: none yet' }));
    } else {
      box.append(el('h3', { text: p.prompt }));
      if (!L.optOrder) L.optOrder = S.shuffle(W.rng32(lv.seed), p.options);
      const opts = el('div', { class: 'opts' });
      L.optOrder.forEach((o) => opts.append(el('button', {
        class: 'opt', 'aria-pressed': 'false', onclick: (e) => {
          L.choice = o;
          opts.querySelectorAll('.opt').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          updatePredictBtn();
        }
      }, o)));
      box.append(opts);
    }
    box.append(confidenceRow((c) => { L.conf = c; updatePredictBtn(); }));
    box.append(el('div', { class: 'row', style: 'display:flex;gap:8px;flex-wrap:wrap' },
      el('button', { class: 'btn primary', id: 'btn-predict', disabled: true, onclick: checkPrediction }, 'Check my prediction ▶'),
      lv.li + 1 < lv.chapter.levels.length || C.CHAPTERS[lv.ci + 1]
        ? el('button', { class: 'btn ghost small', onclick: skipPredict, title: 'Already know this? Go straight to the next level. You can come back.' }, 'I know this — skip ahead')
        : null));
    return box;
  }
  function confidenceRow(onPick) {
    const row = el('div', { class: 'conf' }, el('span', { text: 'How sure are you?' }));
    [['sure', 'Sure'], ['think', 'I think so'], ['guess', 'Guessing']].forEach(([v, t]) => {
      row.append(el('button', {
        'aria-pressed': 'false', onclick: (e) => {
          row.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          onPick(v);
        }
      }, t));
    });
    return row;
  }
  function onRiverTap(i) {
    if (!L || L.phase !== 'predict') return;
    if (L.predictSel.has(i)) L.predictSel.delete(i); else L.predictSel.add(i);
    Sound.tick();
    const s = Array.from(L.predictSel).sort((a, b) => a - b);
    const t = $('#pred-sel');
    if (t) t.textContent = 'Your prediction: ' + (s.length ? 'lanterns ' + s.join(', ') : 'none yet');
    updatePredictBtn();
  }
  function updatePredictBtn() {
    const b = $('#btn-predict');
    if (!b) return;
    const p = L.lv.predict;
    const has = p.mode === 'lit' ? true : L.choice != null;
    b.disabled = !(has && L.conf);
  }
  function skipPredict() {
    const lv = L.lv;
    const r = rec(lv.id);
    if (!r.done) { r.done = true; r.stars = r.stars || 0; r.skipped = true; persist(); }
    const nxt = lv.chapter.levels[lv.li + 1] || (C.CHAPTERS[lv.ci + 1] && C.CHAPTERS[lv.ci + 1].levels[0]);
    toast('Skipped. You can come back to it any time.');
    if (nxt && levelUnlocked(nxt)) openLevel(nxt.id); else go('map');
  }
  async function checkPrediction() {
    Sound.unlock();
    L.guess = L.lv.predict.mode === 'lit' ? new Set(L.predictSel) : L.choice;
    L.phase = 'running';
    riverView.tapMode = null;
    $('#stage').classList.remove('tappable');
    const box = $('#predict');
    box.querySelectorAll('button').forEach(b => { b.disabled = true; });
    await startRun(false);
  }
  function predictResult(res) {
    const lv = L.lv;
    if (L.phase !== 'running') {
      // replays after the prediction is settled
      if (res.error) fb('err', 'Ember stopped', esc(res.msg));
      return;
    }
    const truth = E.predictionTruth(lv, res);
    const correct = E.predictionMatches(lv, L.guess, truth);
    L.predCorrect = correct;
    const box = $('#predict');
    box.innerHTML = '';
    const fmt = (v) => (lv.predict.mode === 'lit' ? (Array.from(v).sort((a, b) => a - b).join(', ') || 'none') : String(v));
    if (lv.predict.mode === 'lit') {
      const marks = {};
      const g = L.guess;
      truth.forEach(i => { marks[i] = g.has(i) ? 'ok' : 'miss'; });
      g.forEach(i => { if (truth.indexOf(i) < 0) marks[i] = 'bad'; });
      riverView.marks = marks;
      riverView.predict = new Set();
    }
    box.append(el('h3', { text: correct ? 'Your prediction was right.' : 'Not what you expected?' }));
    box.append(el('dl', { class: 'compare' },
      el('dt', { text: 'You predicted' }), el('dd', { text: fmt(L.guess) }),
      el('dt', { text: 'What happened' }), el('dd', { text: fmt(truth) })));
    if (!correct && L.conf === 'sure') {
      box.append(el('p', { html: '<strong>A confident surprise is the best kind.</strong> Mistakes we felt sure about are the ones we remember being corrected. Press <em>Step</em> to watch it line by line and find the moment it differs from your picture.' }));
    } else if (!correct) {
      box.append(el('p', { text: 'Press Step to run it one line at a time, and watch where it surprises you.' }));
    }
    correct ? Sound.ok() : Sound.bad();
    L.phase = 'explain';
    if (lv.explain) {
      const ex = lv.explain;
      box.append(el('h3', { text: ex.q, style: 'margin-top:6px' }));
      const opts = el('div', { class: 'opts' });
      const order = S.shuffle(W.rng32(lv.seed + 3), ex.options.map((o, i) => i));
      order.forEach((i) => opts.append(el('button', {
        class: 'opt text', onclick: () => {
          L.explainCorrect = i === ex.correct;
          opts.querySelectorAll('.opt').forEach((b, k) => { b.disabled = true; if (order[k] === ex.correct) b.classList.add('right'); else if (order[k] === i) b.classList.add('wrong'); });
          box.append(el('p', { html: `<strong>${L.explainCorrect ? 'Exactly.' : 'Not quite.'}</strong> ${esc(ex.why)}` }));
          box.append(finishPredictBtn());
        }
      }, ex.options[i])));
      box.append(opts);
    } else {
      box.append(finishPredictBtn());
    }
    updateControls();
  }
  function finishPredictBtn() {
    return el('div', { class: 'row', style: 'display:flex;gap:8px;flex-wrap:wrap' }, el('button', { class: 'btn primary', onclick: finishPredict }, 'Finish'));
  }
  function finishPredict() {
    const lv = L.lv;
    const third = lv.explain ? !!L.explainCorrect : (L.predCorrect && L.conf === 'sure');
    const checks = [true, !!L.predCorrect, third];
    const stars = checks.filter(Boolean).length;
    const r = rec(lv.id);
    r.done = true; r.skipped = false;
    r.stars = Math.max(r.stars || 0, stars);
    r.solvedAt = Date.now();
    const conceptNew = lv.concept && !save.concepts[lv.concept];
    if (lv.concept) recordConcept(lv.concept, L.predCorrect ? 3 : 2);
    persist();
    renderLevelStars();
    L.phase = 'done';
    updateControls();
    showSuccess(stars, checks, E.starRules(lv), [], { first: true, conceptNew });
  }

  /* ================================================================== */
  /* Embers — spaced, interleaved retrieval practice                     */
  /* ================================================================== */
  let RV = null;
  function introducedConcepts() { return Object.keys(C.CONCEPTS).filter(c => save.concepts[c]); }
  function renderReviewHome() {
    RV = null;
    const root = $('#review');
    root.innerHTML = '';
    const due = dueConcepts();
    const intro = introducedConcepts();
    root.append(el('div', { class: 'review-head' },
      el('p', { class: 'kicker', text: 'Memory' }),
      el('h1', { text: 'Embers' }),
      el('p', { text: 'Every idea you learn on the river becomes an ember. Embers fade over days unless you remember them. A few spaced recalls, timed just as they start to fade, make an idea last for months. Every question here is freshly made, so you\'re recalling the idea, not a memorised answer.' })));
    const grid = el('div', { class: 'embers' });
    Object.keys(C.CONCEPTS).forEach((cid) => {
      const st = save.concepts[cid];
      const s = strength(cid);
      const isDue = st && st.due <= Date.now();
      grid.append(el('div', { class: 'ember' + (!st ? ' locked' : '') + (isDue ? ' due' : '') },
        el('div', { class: 'flame', style: `opacity:${st ? 0.25 + 0.75 * s : 0.15};transform:scale(${st ? 0.7 + 0.3 * s : 0.6})` }),
        el('b', { text: C.CONCEPTS[cid].name }),
        el('span', { text: !st ? 'Not lit yet' : isDue ? `Fading · ${Math.round(s * 100)}%` : `${Math.round(s * 100)}% · next ${relTime(st.due)}` })));
    });
    root.append(grid);
    const act = el('div', { class: 'row', style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' });
    if (due.length) {
      act.append(el('button', { class: 'btn primary', onclick: () => startReview(false) }, `Warm ${due.length} fading ember${due.length > 1 ? 's' : ''}`));
      act.append(el('span', { style: 'color:var(--mist)', text: `About ${Math.max(1, Math.round(Math.max(3, due.length) * 0.5))}–${Math.max(2, due.length)} minutes` }));
    } else if (intro.length) {
      const soon = intro.map(c => save.concepts[c].due).sort((a, b) => a - b)[0];
      act.append(el('p', { style: 'color:var(--muted)', text: `All embers are bright. The next one starts fading ${relTime(soon)}. Reviewing early helps a little; reviewing when it fades helps most.` }));
      act.append(el('button', { class: 'btn', onclick: () => startReview(true) }, 'Practise anyway'));
    } else {
      act.append(el('p', { style: 'color:var(--muted)', text: 'Light your first lanterns on the river and your first ember will appear here.' }));
      act.append(el('button', { class: 'btn primary', onclick: () => go('map') }, 'To the river'));
    }
    root.append(act);
  }

  function startReview(practice) {
    let concepts = dueConcepts();
    if (practice || concepts.length < 3) {
      const extra = introducedConcepts().filter(c => concepts.indexOf(c) < 0).sort((a, b) => strength(a) - strength(b));
      if (practice) concepts = concepts.concat(extra).slice(0, Math.max(3, concepts.length));
    }
    concepts = concepts.slice(0, 6);
    if (!concepts.length) return;
    const r = W.rng32((Date.now() & 0xffffff) >>> 0);
    let list = [];
    concepts.forEach(c => { list.push(c); if (concepts.length < 3) list.push(c); });
    // interleave: shuffle, then avoid two of the same concept in a row where possible
    list = S.shuffle(r, list);
    for (let i = 1; i < list.length; i++) {
      if (list[i] === list[i - 1]) {
        const j = list.findIndex((x, k) => k > i && x !== list[i]);
        if (j > 0) { const t = list[i]; list[i] = list[j]; list[j] = t; }
      }
    }
    RV = { cards: list.map(c => S.makeCard(c, r)), i: 0, grades: {}, right: 0 };
    renderCard();
  }

  function renderCard() {
    const root = $('#review');
    root.innerHTML = '';
    const card = RV.cards[RV.i];
    const prog = el('div', { class: 'progress', 'aria-label': `Question ${RV.i + 1} of ${RV.cards.length}` });
    RV.cards.forEach((c, k) => prog.append(el('i', { class: k < RV.i ? 'done' : '' })));
    root.append(el('div', { class: 'review-head' }, el('p', { class: 'kicker', text: `Ember ${RV.i + 1} of ${RV.cards.length} · ${C.CONCEPTS[card.concept].name}` })), prog);
    const box = el('div', { class: 'card' });
    if (card.code) box.append(el('pre', { class: 'code', html: highlightBlock(card.code) }));
    box.append(el('p', { class: 'q', text: card.q }));
    let answer = null, conf = null;
    const submit = el('button', { class: 'btn primary', disabled: true, onclick: () => grade() }, 'Check');
    const ready = () => { submit.disabled = !(answer != null && String(answer).trim() !== '' && conf); };
    if (card.kind === 'choice') {
      const opts = el('div', { class: 'opts' });
      card.options.forEach(o => opts.append(el('button', {
        class: 'opt', 'aria-pressed': 'false', onclick: (e) => {
          answer = o; opts.querySelectorAll('.opt').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); ready();
        }
      }, o)));
      box.append(opts);
    } else {
      const inp = el('input', { type: 'text', id: 'review-answer', inputmode: card.kind === 'num' ? 'numeric' : 'text', autocomplete: 'off', placeholder: 'Your answer', 'aria-label': 'Your answer' });
      inp.addEventListener('input', () => { answer = inp.value; ready(); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !submit.disabled) grade(); });
      box.append(inp);
      setTimeout(() => inp.focus(), 50);
    }
    box.append(confidenceRow((c) => { conf = c; ready(); }));
    box.append(el('div', { class: 'row', style: 'display:flex;gap:8px' }, submit));
    root.append(box);
    const shownAt = Date.now();

    function grade() {
      const norm = (s) => String(s).trim().replace(/[\[\]\(\),]/g, ' ').split(/\s+/).filter(Boolean).join(' ').toLowerCase();
      const ok = norm(answer) === norm(card.answer);
      const fast = Date.now() - shownAt < 15000;
      const g = !ok ? 1 : conf === 'sure' ? (fast ? 4 : 3) : conf === 'think' ? 3 : 2;
      RV.grades[card.concept] = Math.min(RV.grades[card.concept] || 4, g);
      if (ok) RV.right++;
      ok ? Sound.ok() : Sound.bad();
      box.querySelectorAll('button, input').forEach(b => { b.disabled = true; });
      if (card.kind === 'choice') box.querySelectorAll('.opt').forEach(b => { if (b.textContent === card.answer) b.classList.add('right'); else if (b.textContent === answer) b.classList.add('wrong'); });
      const res = el('div', { class: 'msg ' + (ok ? 'ok' : 'err') });
      res.append(el('div', { class: 'msg-title', text: ok ? (conf === 'guess' ? 'Right — and now you know why it was more than a guess.' : 'Remembered.') : (conf === 'sure' ? 'A confident surprise. Those are the ones that stick once corrected.' : 'Not quite — that\'s useful. Recalling and checking is how memory grows.') }));
      res.append(el('div', { html: `Answer: <code>${esc(card.answer)}</code>` }));
      res.append(el('div', { text: card.explain }));
      const acts = el('div', { class: 'row' });
      if (card.code) {
        const tbox = el('div', { class: 'scroll-x', hidden: true });
        acts.append(el('button', { class: 'btn small', onclick: () => {
          if (!tbox.childElementCount) {
            const rows = S.trace(card.code, 30);
            const t = el('table', { class: 'trace' }, el('tr', {}, el('th', { text: 'line' }), el('th', { text: 'code' }), el('th', { text: 'memory before it runs' })));
            rows.forEach(rw => t.append(rw.line ? el('tr', {}, el('td', { text: rw.line }), el('td', { text: rw.src }), el('td', { class: 'v', text: rw.vars })) : el('tr', {}, el('td', { colspan: '3', text: rw.err ? 'Stops here: ' + rw.err : '…and so on' }))));
            tbox.append(t);
          }
          tbox.hidden = !tbox.hidden;
        } }, 'Trace it line by line'));
        res.append(tbox);
      }
      const last = RV.i === RV.cards.length - 1;
      acts.append(el('button', { class: 'btn primary small', onclick: () => { if (last) finishReview(); else { RV.i++; renderCard(); } } }, last ? 'Finish' : 'Next'));
      res.append(acts);
      box.append(res);
      const nb = res.querySelector('.btn.primary');
      if (nb) nb.focus();
    }
  }

  function finishReview() {
    Object.keys(RV.grades).forEach(c => recordConcept(c, RV.grades[c]));
    save.reviews = (save.reviews || 0) + 1;
    persist();
    updateBadge();
    const root = $('#review');
    root.innerHTML = '';
    root.append(el('div', { class: 'review-head' }, el('p', { class: 'kicker', text: 'Embers warmed' }), el('h1', { text: `${RV.right} of ${RV.cards.length} remembered` }),
      el('p', { text: 'Forgetting a little and then recalling is exactly how memories get stronger. Here is when each ember will need you next:' })));
    const grid = el('div', { class: 'embers' });
    Object.keys(RV.grades).forEach(c => {
      const st = save.concepts[c];
      grid.append(el('div', { class: 'ember' }, el('div', { class: 'flame' }), el('b', { text: C.CONCEPTS[c].name }), el('span', { text: `next ${relTime(st.due)}` })));
    });
    root.append(grid);
    root.append(el('div', { class: 'row', style: 'display:flex;gap:10px;flex-wrap:wrap' },
      el('button', { class: 'btn primary', onclick: () => go('map') }, 'Back to the river'),
      el('button', { class: 'btn', onclick: () => renderReviewHome() }, 'All embers')));
  }

  /* ================================================================== */
  /* Codex                                                               */
  /* ================================================================== */
  function renderCodex() {
    const root = $('#codex');
    root.innerHTML = '';
    root.append(el('div', { class: 'review-head' }, el('p', { class: 'kicker', text: 'The keeper\'s codex' }), el('h1', { text: 'What you\'ll learn' }),
      el('p', { text: 'Eleven big ideas of programming, in the order the river teaches them. Everything you write is real Python, so it works outside the game too.' })));
    const grid = el('div', { class: 'codex-grid' });
    const chapterOf = {};
    C.LEVELS.forEach(l => { if (chapterOf[l.concept] == null) chapterOf[l.concept] = l.chapter.num; });
    Object.keys(C.CONCEPTS).forEach((cid) => {
      const cc = C.CONCEPTS[cid];
      const st = save.concepts[cid];
      const meta = el('div', { class: 'meta' });
      if (st) meta.append(el('span', { text: `Ember ${Math.round(strength(cid) * 100)}%` }), el('span', { text: st.due <= Date.now() ? 'fading — review now' : `next review ${relTime(st.due)}` }));
      else meta.append(el('span', { text: `Learned on stretch ${ROMAN[chapterOf[cid]] || '?'}` }));
      grid.append(el('article', { class: 'cx paper' + (st ? '' : ' locked') },
        el('span', { class: 'glyph', text: ROMAN[chapterOf[cid]] ? 'Stretch ' + ROMAN[chapterOf[cid]] : '' }),
        el('h2', { text: cc.name }), el('p', { text: cc.summary }), el('pre', { html: highlightBlock(cc.example) }), meta));
    });
    root.append(grid);
    const firstUse = {};
    C.LEVELS.forEach(l => l.api.forEach(a => { if (!firstUse[a]) firstUse[a] = l; }));
    const t = el('table', { class: 'spells-table' });
    W.SPELL_ORDER.forEach((name) => {
      const sp = W.SPELLS[name];
      const l = firstUse[name];
      t.append(el('tr', {}, el('td', { text: `${name}(${sp.params.join(', ')})` }), el('td', { text: sp.doc }), el('td', { style: 'color:var(--mist);white-space:nowrap', text: l ? `stretch ${ROMAN[l.chapter.num]}` : '' })));
    });
    root.append(el('div', { class: 'panel' }, el('h3', { text: 'Keeper spells' }), el('div', { class: 'scroll-x' }, t)));
  }

  /* ================================================================== */
  /* Keeper's book (settings, progress, about)                           */
  /* ================================================================== */
  function openSettings() {
    modal((card, close) => {
      card.append(el('h2', { text: 'Keeper\'s book' }));
      const name = el('input', { type: 'text', id: 'keeper-name', maxlength: '24', value: save.name || '', placeholder: 'What should the river call you?' });
      name.addEventListener('change', () => { save.name = name.value.trim(); persist(); });
      card.append(el('label', { for: 'keeper-name', style: 'display:grid;gap:6px' }, el('span', { class: 'kicker', text: 'Your keeper name' }), name));
      const sound = el('button', { class: 'btn small', id: 'set-sound', onclick: () => { save.settings.sound = !save.settings.sound; persist(); sound.textContent = save.settings.sound ? 'On' : 'Off'; } }, save.settings.sound ? 'On' : 'Off');
      card.append(el('div', { class: 'setting' }, el('span', { text: 'Sound (lanterns ring as they light)' }), sound));
      const unlock = el('button', { class: 'btn small', id: 'set-unlock', onclick: () => { save.settings.unlockAll = !save.settings.unlockAll; persist(); unlock.textContent = save.settings.unlockAll ? 'On' : 'Off'; } }, save.settings.unlockAll ? 'On' : 'Off');
      card.append(el('div', { class: 'setting' }, el('span', { text: 'Teacher mode (open every level)' }), unlock));

      card.append(el('details', {}, el('summary', { text: 'Move your progress to another device' }),
        el('div', { style: 'display:grid;gap:10px;margin-top:10px' },
          el('p', { style: 'color:var(--muted);font-size:0.92rem', text: 'Progress is saved in this browser. To move it, copy your save code here and paste it on the other device.' }),
          (() => {
            const ta = el('textarea', { id: 'save-code', readonly: true });
            const copy = el('button', { class: 'btn small', onclick: async () => {
              ta.value = encodeSave();
              ta.select();
              try { await navigator.clipboard.writeText(ta.value); toast('Save code copied'); } catch (e) { toast('Select the text and copy it'); }
            } }, 'Copy my save code');
            const dl = el('button', { class: 'btn small ghost', onclick: () => {
              try {
                const blob = new Blob([JSON.stringify(save, null, 1)], { type: 'application/json' });
                const a = el('a', { href: URL.createObjectURL(blob), download: 'wyk-save.json' });
                document.body.append(a); a.click(); a.remove();
              } catch (e) { toast('Download not available here — use the save code'); }
            } }, 'Download save file');
            return el('div', { style: 'display:grid;gap:8px' }, el('div', { class: 'row', style: 'justify-content:flex-start' }, copy, dl), ta);
          })(),
          (() => {
            const ta = el('textarea', { id: 'load-code', placeholder: 'Paste a save code here' });
            const file = el('input', { type: 'file', id: 'load-file', accept: '.json,application/json' });
            file.addEventListener('change', () => {
              const f = file.files[0]; if (!f) return;
              const rd = new FileReader();
              rd.onload = () => { if (importSave(String(rd.result))) { close(); go('map'); } };
              rd.readAsText(f);
            });
            return el('div', { style: 'display:grid;gap:8px' }, ta,
              el('div', { class: 'row', style: 'justify-content:flex-start' },
                el('button', { class: 'btn small', onclick: () => { if (importSave(ta.value)) { close(); go('map'); } } }, 'Load this save'),
                el('label', { class: 'btn small ghost', for: 'load-file' }, 'Load a save file'), file));
          })())));
      file_hide(card);

      card.append(el('details', {}, el('summary', { text: 'How WYK teaches (for parents and teachers)' }), researchNotes()));

      let armed = false;
      const reset = el('button', { class: 'btn small danger', onclick: () => {
        if (!armed) { armed = true; reset.textContent = 'Tap again to erase everything'; setTimeout(() => { armed = false; reset.textContent = 'Erase all progress'; }, 3000); return; }
        save = blankSave(); persist(); close(); toast('Progress erased'); go('title');
      } }, 'Erase all progress');
      card.append(el('div', { class: 'row', style: 'justify-content:space-between' }, reset, el('button', { class: 'btn primary', onclick: () => { close(); if (current === 'map') renderMap(); } }, 'Done')));
    });
  }
  function file_hide(card) { const f = card.querySelector('#load-file'); if (f) { f.style.position = 'absolute'; f.style.width = '1px'; f.style.height = '1px'; f.style.opacity = '0'; } }
  function encodeSave() {
    const json = JSON.stringify(save);
    return 'WYK1:' + btoa(unescape(encodeURIComponent(json)));
  }
  function importSave(text) {
    try {
      const t = String(text).trim();
      let obj;
      if (t.startsWith('WYK1:')) obj = JSON.parse(decodeURIComponent(escape(atob(t.slice(5)))));
      else obj = JSON.parse(t);
      if (!obj || typeof obj !== 'object' || !obj.levels) throw new Error('not a save');
      save = normalizeSave(obj);
      persist();
      toast('Progress loaded');
      return true;
    } catch (e) {
      toast('That doesn\'t look like a WYK save code');
      return false;
    }
  }
  function researchNotes() {
    const items = [
      ['Predict before you run', 'Each new idea starts with reading code and predicting the result (the PRIMM approach: Predict, Run, Investigate, Modify, Make). Learners commit to a prediction and a confidence level, then see the truth.'],
      ['Confidence and surprise', 'Learners rate how sure they are. Errors made with high confidence are corrected and remembered especially well (the hypercorrection effect), so the game points those moments out.'],
      ['Worked examples, then fading support', 'Ideas arrive as worked examples, then fill-in-the-gap code, then puzzles, then writing from scratch. Support fades as skill grows.'],
      ['Parsons puzzles, adaptively', 'Mixed-up-line puzzles practise the same skill as writing code in less time. After three failed runs, a write task can turn into a puzzle of its own solution. Distractor lines are left out, since they add load for young novices without helping transfer.'],
      ['Code tracing and a visible machine', 'Step runs one line at a time; Ember\'s memory shows every variable as it changes, and position variables appear as arrows under the lanterns. Reading and tracing code comes before writing it.'],
      ['Testing on many rivers', 'Solutions are checked against several randomly generated rivers, so learners must write general algorithms rather than hard-code one answer.'],
      ['Self-explanation', 'After predictions, a short "why?" question asks learners to explain what happened in their own understanding.'],
      ['Spaced, interleaved retrieval', 'Every concept is scheduled with FSRS-4.5, a modern memory model, so it comes back just as it begins to fade. Review mixes concepts together and generates a fresh question each time, which trains recall of the idea rather than a memorised answer.'],
      ['Productive struggle', 'Hints are graduated and unlock after a first attempt, so learners try before being told. Feedback treats bugs as clues and praises strategy, not talent.'],
      ['Low floor, high ceiling', 'A ten-year-old can light the first lanterns in minutes; later stretches ask for binary search, selection and insertion sort, Dijkstra\'s three-way partition, Euclid\'s algorithm, recursion and dynamic programming, with efficiency stars and grandmaster trials for older players.']
    ];
    return el('div', { class: 'research', style: 'margin-top:10px' }, items.map(([b, t]) => el('p', {}, el('b', { text: b + '. ' }), t)));
  }

  /* ================================================================== */
  /* Wiring                                                              */
  /* ================================================================== */
  function init() {
    $('#title-levels').textContent = C.LEVELS.length;
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
    $('#btn-settings').addEventListener('click', openSettings);
    $('#btn-begin').addEventListener('click', () => {
      Sound.unlock();
      const nx = nextLevel();
      if (!Object.keys(save.levels).length && nx) openLevel(nx.id); else go('map');
    });
    $('#btn-begin').textContent = Object.keys(save.levels).length ? 'Continue' : 'Begin';
    $('#lvl-back').addEventListener('click', () => go('map'));
    $('#btn-run').addEventListener('click', () => startRun(false));
    $('#btn-step').addEventListener('click', () => {
      if (L && (L.phase === 'done' || L.phase === 'explain') && L.lv.type === 'predict' && !L.run) { startRun(true); return; }
      startRun(true);
    });
    $('#btn-stop').addEventListener('click', () => { if (L && L.run) L.run.stop(); });
    $('#btn-reset').addEventListener('click', () => { if (!L || L.run) return; clearFeedback(); resetWorld(); if (L.lv.type === 'sandbox') { L.cfg = sandboxCfg(); resetWorld(); } });
    $('#btn-hint').addEventListener('click', showHint);
    $('#speed').addEventListener('input', (e) => { save.settings.speed = parseInt(e.target.value, 10) || 3; persist(); if (riverView) riverView.animMs = speedCfg().anim; });
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
      if (current === 'level' && (e.ctrlKey || e.metaKey) && e.key === 'Enter' && document.activeElement !== (L && L.editor && L.editor.ta)) { e.preventDefault(); startRun(false); }
    });
    window.addEventListener('beforeunload', flushSave);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); else updateBadge(); });
    updateBadge();
    if (Object.keys(save.levels).length) go('map'); else go('title');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.WYK.App = { go, openLevel, get save() { return save; } };
})();
