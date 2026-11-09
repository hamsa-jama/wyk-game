/* WYK — the river: world model, keeper spells, and the canvas renderer. */
(function (root) {
  'use strict';
  const WYK = root.WYK = root.WYK || {};
  const PyError = WYK.PyError;

  function deepCopy(v) {
    if (Array.isArray(v)) {
      const c = v.map(deepCopy);
      if (v.__tuple) Object.defineProperty(c, '__tuple', { value: true });
      return c;
    }
    return v;
  }

  /* ------------------------------------------------------------------ */
  /* Model                                                               */
  /* ------------------------------------------------------------------ */
  class River {
    constructor(cfg) {
      this.cfg = cfg || {};
      const glows = this.cfg.glows || [];
      const lit = this.cfg.lit || [];
      this.lanterns = glows.map((v, i) => ({ id: i, v, lit: lit.indexOf(i) >= 0, seen: !this.cfg.fog }));
      this.n = this.lanterns.length;
      this.boat = this.cfg.start == null ? -1 : this.cfg.start;
      this.focus = this.boat;
      this.fog = !!this.cfg.fog;
      this.adjacentOnly = !!this.cfg.adjacentOnly;
      this.ops = { moves: 0, peeks: 0, swaps: 0, lights: 0, compares: 0 };
      this.answered = false;
      this.answer = undefined;
    }
    glows() { return this.lanterns.map(l => l.v); }
    litSet() {
      const s = [];
      this.lanterns.forEach((l, i) => { if (l.lit) s.push(i); });
      return s;
    }
    checkIndex(i, spell) {
      if (typeof i === 'boolean' || typeof i !== 'number' || !Number.isInteger(i)) {
        throw new PyError('TypeError', `${spell}() needs a whole-number lantern position, like ${spell}(3)` +
          (typeof i === 'number' ? `, but got ${i}. Tip: use // instead of / to divide without decimals.` : `, but got ${WYK.typeName(i)}.`));
      }
      if (i < 0 || i >= this.n) {
        throw new PyError('IndexError', `there is no lantern ${i}. This river has lanterns 0 to ${this.n - 1}.` + (i === this.n ? ' (Counting starts at 0, so the last one is size() - 1.)' : ''));
      }
    }
    here(what) {
      if (this.boat < 0) throw new PyError('RiverError', `the boat is still at the dock, so there's no lantern here to ${what}. Use forward() first.`);
      return this.lanterns[this.boat];
    }
    forward() {
      if (this.boat >= this.n - 1) throw new PyError('RiverError', `bump! The boat hit the far riverbank. It's already at the last lantern (${this.n - 1}).`);
      this.boat++; this.focus = this.boat; this.ops.moves++;
    }
    back() {
      if (this.boat <= -1) throw new PyError('RiverError', 'bump! The boat is already at the dock and can\'t go back any further.');
      this.boat--; this.focus = this.boat; this.ops.moves++;
    }
    light() { const l = this.here('light'); if (!l.lit) { l.lit = true; this.ops.lights++; } }
    glow() { const l = this.here('read'); l.seen = true; this.ops.peeks++; return l.v; }
    atEnd() { return this.boat >= this.n - 1; }
    isLit() { return this.here('check').lit; }
    peek(i) { this.checkIndex(i, 'peek'); const l = this.lanterns[i]; l.seen = true; this.ops.peeks++; this.focus = i; return l.v; }
    lightAt(i) { this.checkIndex(i, 'light_at'); const l = this.lanterns[i]; if (!l.lit) { l.lit = true; this.ops.lights++; } this.focus = i; }
    swap(i, j) {
      this.checkIndex(i, 'swap'); this.checkIndex(j, 'swap');
      if (i === j) return false;
      if (this.adjacentOnly && Math.abs(i - j) !== 1) {
        throw new PyError('RiverError', `on this stretch of river only neighbouring lanterns can swap. swap(${i}, ${j}) is too far apart. Try swap(${i}, ${i + 1}).`);
      }
      const t = this.lanterns[i];
      this.lanterns[i] = this.lanterns[j];
      this.lanterns[j] = t;
      this.ops.swaps++;
      this.focus = j;
      return true;
    }
    less(i, j) {
      this.checkIndex(i, 'less'); this.checkIndex(j, 'less');
      this.ops.compares++;
      this.focus = i;
      return this.lanterns[i].v < this.lanterns[j].v;
    }
    setAnswer(v) {
      if (this.answered) throw new PyError('RiverError', 'you already gave an answer! answer() can only be used once. Is it inside a loop by mistake?');
      this.answered = true;
      this.answer = deepCopy(v);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Keeper spells — the world API that programs can call                */
  /* ------------------------------------------------------------------ */
  const SPELLS = {
    forward: { params: [], doc: 'Row the boat to the next lantern.', run: (w) => { w.forward(); return [null, { a: 'move' }]; } },
    back: { params: [], doc: 'Row back one lantern, toward the dock.', run: (w) => { w.back(); return [null, { a: 'move' }]; } },
    light: { params: [], doc: 'Light the lantern the boat is next to.', run: (w) => { w.light(); return [null, { a: 'light', i: w.boat }]; } },
    glow: { params: [], doc: 'Read the glow number of the lantern here.', run: (w) => { const v = w.glow(); return [v, { a: 'peek', i: w.boat }]; } },
    at_end: { params: [], doc: 'True when the boat is at the last lantern.', run: (w) => [w.atEnd(), null] },
    is_lit: { params: [], doc: 'True when the lantern here is already lit.', run: (w) => [w.isLit(), null] },
    size: { params: [], doc: 'How many lanterns float on this river.', run: (w) => [w.n, null] },
    answer: { params: ['x'], doc: 'Give the keeper your answer.', run: (w, a) => { w.setAnswer(a[0]); return [null, { a: 'answer', v: a[0] }]; } },
    peek: { params: ['i'], doc: 'Blink to lantern i and read its glow.', run: (w, a) => { const v = w.peek(a[0]); return [v, { a: 'peek', i: a[0] }]; } },
    light_at: { params: ['i'], doc: 'Blink to lantern i and light it.', run: (w, a) => { w.lightAt(a[0]); return [null, { a: 'light', i: a[0] }]; } },
    swap: { params: ['i', 'j'], doc: 'Swap the places of lanterns i and j.', run: (w, a) => { const did = w.swap(a[0], a[1]); return [null, did ? { a: 'swap', i: a[0], j: a[1] } : null]; } },
    less: { params: ['i', 'j'], doc: 'True if lantern i glows less than lantern j. Reveals neither number.', run: (w, a) => { const r = w.less(a[0], a[1]); return [r, { a: 'compare', i: a[0], j: a[1] }]; } }
  };
  const SPELL_ORDER = ['forward', 'back', 'light', 'glow', 'at_end', 'is_lit', 'size', 'answer', 'peek', 'light_at', 'swap', 'less'];

  function makeApi(world, names) {
    const api = {};
    for (const name of SPELL_ORDER) {
      const sp = SPELLS[name];
      if (names.indexOf(name) >= 0) {
        api[name] = {
          type: 'builtin', name, gen: true,
          fn: function* (args, kw, line) {
            if (args.length !== sp.params.length) {
              const n = sp.params.length;
              throw new PyError('TypeError', `${name}() needs ${n === 0 ? 'nothing inside its brackets' : n + ' input' + (n === 1 ? '' : 's') + ': ' + name + '(' + sp.params.join(', ') + ')'}, but was given ${args.length}.`, line);
            }
            const res = sp.run(world, args);
            if (res[1]) yield Object.assign({ t: 'act', line }, res[1]);
            return res[0];
          }
        };
      } else {
        api[name] = {
          type: 'builtin', name,
          fn: (args, kw, line) => { throw new PyError('LockedSpell', `"${name}()" is a keeper spell you haven't unlocked on this stretch of river.`, line); }
        };
      }
    }
    return api;
  }

  /* ------------------------------------------------------------------ */
  /* Renderer                                                            */
  /* ------------------------------------------------------------------ */
  const COL = {
    skyTop: '#0b1026', skyMid: '#18204a', skyLow: '#2b2a5a',
    hill: '#121735', water: '#0d2a3d', waterDeep: '#081a28',
    paper: '#efe4cc', paperDim: '#4a4560', paperEdge: '#7b7396',
    glowA: '#ffe2a0', glowB: '#ffb547', glowC: '#ff7a3a',
    ink: '#1d1a2b', label: '#8fa3c7', labelHi: '#ffe2a0',
    target: '#ffcf6b', predict: '#c8a6ff', ok: '#8ee6a0', bad: '#ff7b6b',
    boat: '#e9dcc0', boatShade: '#b9a98a', ember: '#fff2a8', mist: 'rgba(200,215,240,0.10)',
    ptr: ['#7fd7ff', '#ff9ecf', '#b8f28a', '#ffd479']
  };

  function rng32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class RiverView {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.world = null;
      this.W = 600; this.H = 300;
      this.particles = [];
      this.beams = [];
      this.targets = new Set();
      this.predict = new Set();
      this.marks = {};
      this.pointers = [];
      this.showGlow = true;
      this.animMs = 380;
      this.skyStars = 40;
      this.onTap = null;
      this.tapMode = null; // 'lit' | 'pos' | null
      this.answerFx = null;
      this.boatX = null;
      this.emberX = null; this.emberY = null;
      this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.time = 0;
      this.last = 0;
      this.running = true;
      this.makeStars();
      const onDown = (ev) => this.handleTap(ev);
      canvas.addEventListener('pointerdown', onDown);
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(() => this.resize());
        this.ro.observe(canvas.parentElement || canvas);
      }
      this.resize();
      this.paused = false;
      const loop = (ts) => {
        if (!this.running) return;
        if (this.paused || !this.canvas.offsetParent) this.last = ts;
        else this.frame(ts);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    makeStars() {
      const r = rng32(7);
      this.stars = [];
      for (let k = 0; k < 260; k++) this.stars.push({ x: r(), y: r() * 0.5, s: 0.4 + r() * 1.3, p: r() * 6.28, sp: 0.5 + r() * 1.5 });
    }

    resize() {
      const parent = this.canvas.parentElement;
      const w = Math.max(280, Math.floor((parent ? parent.clientWidth : 600)));
      const h = Math.round(Math.min(360, Math.max(230, w * 0.44)));
      const dpr = Math.min(2, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) || 1);
      this.W = w; this.H = h;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.height = h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.snap();
    }

    setWorld(world, opts) {
      opts = opts || {};
      this.world = world;
      this.targets = new Set(opts.targets || []);
      this.predict = new Set();
      this.marks = {};
      this.pointers = [];
      this.particles = [];
      this.beams = [];
      this.answerFx = null;
      this.showGlow = opts.showGlow !== false;
      this.blink = !!opts.blink;
      this.snap();
    }

    geom() {
      const n = this.world ? this.world.n : 6;
      const margin = Math.max(10, this.W * 0.025);
      const spacing = (this.W - margin * 2) / (n + 1);
      const size = Math.max(9, Math.min(46, spacing * 0.64));
      const water = this.H * 0.5;
      const baseY = water + this.H * 0.17;
      return { n, margin, spacing, size, water, baseY, labelY: baseY + size * 0.55 + 14 };
    }
    slotX(i) { const g = this.geom(); return g.margin + g.spacing * (i + 1.5); }

    snap() {
      if (!this.world) return;
      this.world.lanterns.forEach((l, i) => {
        l._x = this.slotX(i); l._from = l._x; l._to = l._x; l._t = 1; l._dir = 1;
        l._g = l.lit ? 1 : 0; l._r = l.seen ? 1 : 0;
      });
      this.boatX = this.slotX(this.world.boat);
      const f = this.blink ? this.world.focus : this.world.boat;
      this.emberX = this.slotX(f);
      this.emberY = null;
    }

    handleTap(ev) {
      if (!this.world || !this.tapMode || !this.onTap) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) * (this.W / rect.width);
      const y = (ev.clientY - rect.top) * (this.H / rect.height);
      const g = this.geom();
      if (y < g.water - g.size * 2.2 || y > g.labelY + 18) return;
      const i = Math.round((x - g.margin) / g.spacing - 1.5);
      if (i >= 0 && i < this.world.n && Math.abs(x - this.slotX(i)) < g.spacing * 0.6) this.onTap(i);
    }

    onAct(ev) {
      if (!this.world) return;
      const g = this.geom();
      if (ev.a === 'light') this.burst(this.slotX(ev.i), g.baseY - g.size * 1.1, 16, COL.glowB);
      else if (ev.a === 'peek') this.beams.push({ i: ev.i, t: 0, col: COL.ember });
      else if (ev.a === 'compare') { this.beams.push({ i: ev.i, t: 0, col: COL.predict }); this.beams.push({ i: ev.j, t: 0, col: COL.predict }); }
      else if (ev.a === 'answer') this.answerFx = { t: 0, text: WYK.repr(ev.v, true) };
    }

    burst(x, y, n, col) {
      if (this.reduced) n = Math.ceil(n / 3);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 20 + Math.random() * 60;
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0, max: 0.6 + Math.random() * 0.7, col });
      }
    }

    frame(ts) {
      const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000);
      this.last = ts;
      this.time += dt;
      const ctx = this.ctx;
      const W = this.W, H = this.H;
      const g = this.geom();
      this.drawSky(ctx, W, H, g);
      this.drawWater(ctx, W, H, g);
      if (!this.world) return;
      this.updateTweens(dt, g);
      this.drawDock(ctx, g);
      this.drawReflections(ctx, g);
      this.drawTargets(ctx, g);
      this.drawLanterns(ctx, g);
      this.drawLabelsAndPointers(ctx, g);
      this.drawBoat(ctx, g, dt);
      this.drawBeams(ctx, g, dt);
      this.drawParticles(ctx, dt);
      if (this.world.fog) this.drawFog(ctx, W, H, g);
      this.drawAnswer(ctx, g, dt);
    }

    updateTweens(dt, g) {
      const dur = Math.max(0.06, this.animMs / 1000);
      const wl = this.world.lanterns;
      for (let i = 0; i < wl.length; i++) {
        const l = wl[i];
        const tx = this.slotX(i);
        if (l._x === undefined) { l._x = tx; l._from = tx; l._to = tx; l._t = 1; l._g = l.lit ? 1 : 0; l._r = l.seen ? 1 : 0; }
        if (Math.abs(l._to - tx) > 0.5) { l._from = l._x; l._to = tx; l._t = 0; l._dir = tx > l._from ? -1 : 1; }
        if (l._t < 1) {
          l._t = Math.min(1, l._t + dt / dur);
          const e = l._t < 0.5 ? 2 * l._t * l._t : 1 - Math.pow(-2 * l._t + 2, 2) / 2;
          l._x = l._from + (l._to - l._from) * e;
        } else l._x = l._to;
        const gl = l.lit ? 1 : 0;
        l._g += (gl - l._g) * Math.min(1, dt * 7);
        const rv = l.seen ? 1 : 0;
        l._r += (rv - l._r) * Math.min(1, dt * 6);
      }
      const bx = this.slotX(this.world.boat);
      const k = Math.min(1, dt / Math.max(0.05, dur * 0.45));
      this.boatX += (bx - this.boatX) * k;
      if (Math.abs(bx - this.boatX) < 0.3) this.boatX = bx;
      const fx = this.slotX(this.blink ? this.world.focus : this.world.boat);
      if (this.blink && Math.abs(fx - this.emberX) > g.spacing * 1.5) {
        this.burst(this.emberX, g.baseY - g.size * 1.6, 5, COL.ember);
        this.emberX = fx;
        this.burst(this.emberX, g.baseY - g.size * 1.6, 7, COL.ember);
      }
      this.emberX += (fx - this.emberX) * Math.min(1, dt * 9);
    }

    drawSky(ctx, W, H, g) {
      const gr = ctx.createLinearGradient(0, 0, 0, g.water);
      gr.addColorStop(0, COL.skyTop); gr.addColorStop(0.65, COL.skyMid); gr.addColorStop(1, COL.skyLow);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, g.water + 1);
      const count = Math.min(this.stars.length, this.skyStars);
      for (let k = 0; k < count; k++) {
        const s = this.stars[k];
        const tw = this.reduced ? 0.8 : 0.55 + 0.45 * Math.sin(this.time * s.sp + s.p);
        ctx.globalAlpha = tw * (k >= 40 ? 1 : 0.75);
        ctx.fillStyle = k >= 40 ? '#ffe9b8' : '#cfd8ff';
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * g.water * 1.6, s.s * (k >= 40 ? 1.15 : 1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // moon
      const mx = W * 0.9, my = g.water * 0.28, mr = Math.max(10, H * 0.06);
      const mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3.2);
      mg.addColorStop(0, 'rgba(255,240,210,0.20)'); mg.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, my, mr * 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4e9cf';
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COL.skyMid;
      ctx.beginPath(); ctx.arc(mx - mr * 0.45, my - mr * 0.2, mr * 0.92, 0, Math.PI * 2); ctx.fill();
      // far hills
      ctx.fillStyle = COL.hill;
      ctx.beginPath();
      ctx.moveTo(0, g.water);
      for (let x = 0; x <= W; x += 8) {
        const y = g.water - H * 0.06 - Math.sin(x * 0.011 + 1.3) * H * 0.035 - Math.sin(x * 0.027) * H * 0.018;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, g.water);
      ctx.closePath();
      ctx.fill();
    }

    drawWater(ctx, W, H, g) {
      const gr = ctx.createLinearGradient(0, g.water, 0, H);
      gr.addColorStop(0, COL.water); gr.addColorStop(1, COL.waterDeep);
      ctx.fillStyle = gr;
      ctx.fillRect(0, g.water, W, H - g.water);
      ctx.strokeStyle = 'rgba(143,163,199,0.10)';
      ctx.lineWidth = 1;
      for (let r = 0; r < 7; r++) {
        const y = g.water + 6 + r * ((H - g.water) / 7);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 10) {
          const yy = y + Math.sin(x * 0.03 + this.time * (0.6 + r * 0.15) + r) * 1.6;
          if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }

    drawDock(ctx, g) {
      const x = this.slotX(-1);
      const w = Math.min(g.spacing * 0.9, 50);
      const y = g.baseY + g.size * 0.1;
      ctx.fillStyle = '#3a2c25';
      ctx.fillRect(x - w / 2 - 6, y - 4, w + 6, 7);
      ctx.fillStyle = '#2a201b';
      for (let k = 0; k < 3; k++) ctx.fillRect(x - w / 2 - 4 + k * (w / 2), y + 3, 4, g.size * 0.45);
      ctx.fillStyle = 'rgba(143,163,199,0.55)';
      ctx.font = `600 ${Math.max(8, Math.min(11, g.spacing * 0.22))}px "Atkinson Hyperlegible", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('dock', x - 2, g.labelY);
    }

    bob(i) { return this.reduced ? 0 : Math.sin(this.time * 1.6 + i * 0.9) * 2; }

    drawReflections(ctx, g) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.world.lanterns.forEach((l, i) => {
        if (l._g < 0.02) return;
        const x = l._x;
        const h = g.size * 2.4;
        const gr = ctx.createLinearGradient(0, g.baseY, 0, g.baseY + h);
        gr.addColorStop(0, `rgba(255,170,70,${0.32 * l._g})`);
        gr.addColorStop(1, 'rgba(255,170,70,0)');
        ctx.fillStyle = gr;
        const wob = this.reduced ? 0 : Math.sin(this.time * 3 + i) * 1.5;
        ctx.fillRect(x - g.size * 0.32 + wob, g.baseY, g.size * 0.64, h);
      });
      ctx.restore();
    }

    drawTargets(ctx, g) {
      if (!this.targets.size) return;
      ctx.save();
      this.targets.forEach((i) => {
        if (i < 0 || i >= this.world.n) return;
        const x = this.slotX(i);
        ctx.strokeStyle = COL.target;
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(this.time * 2.5);
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, g.baseY + g.size * 0.12, g.size * 0.62, g.size * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();
    }

    drawLanterns(ctx, g) {
      const s = g.size;
      const fontPx = Math.max(8, Math.round(s * 0.42));
      this.world.lanterns.forEach((l, i) => {
        const swapLift = l._t < 1 ? Math.sin(l._t * Math.PI) * s * 0.9 * l._dir : 0;
        const x = l._x;
        const yb = g.baseY + this.bob(i) - swapLift;
        const bw = s * 0.78, bh = s * 0.92;
        const top = yb - bh - s * 0.12;
        // glow halo
        if (l._g > 0.02) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const hr = s * (1.5 + 0.08 * Math.sin(this.time * 4 + i));
          const hg = ctx.createRadialGradient(x, top + bh / 2, s * 0.2, x, top + bh / 2, hr);
          hg.addColorStop(0, `rgba(255,190,90,${0.45 * l._g})`);
          hg.addColorStop(1, 'rgba(255,150,60,0)');
          ctx.fillStyle = hg;
          ctx.beginPath(); ctx.arc(x, top + bh / 2, hr, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        // wooden base
        ctx.fillStyle = '#3b2a22';
        ctx.fillRect(x - bw * 0.62, yb - s * 0.12, bw * 1.24, s * 0.16);
        // paper body
        const pg = ctx.createLinearGradient(0, top, 0, top + bh);
        if (l._g > 0.02) {
          pg.addColorStop(0, mix(COL.paperDim, COL.glowA, l._g));
          pg.addColorStop(1, mix(COL.paperDim, COL.glowB, l._g));
        } else {
          pg.addColorStop(0, COL.paperDim); pg.addColorStop(1, '#3a3550');
        }
        ctx.fillStyle = pg;
        roundRect(ctx, x - bw / 2, top, bw, bh, Math.min(4, s * 0.12));
        ctx.fill();
        ctx.strokeStyle = l._g > 0.5 ? 'rgba(120,60,20,0.55)' : COL.paperEdge;
        ctx.lineWidth = 1;
        ctx.stroke();
        // paper ribs
        ctx.strokeStyle = l._g > 0.5 ? 'rgba(150,80,30,0.25)' : 'rgba(123,115,150,0.35)';
        ctx.beginPath();
        ctx.moveTo(x - bw / 2 + 2, top + bh * 0.33); ctx.lineTo(x + bw / 2 - 2, top + bh * 0.33);
        ctx.moveTo(x - bw / 2 + 2, top + bh * 0.66); ctx.lineTo(x + bw / 2 - 2, top + bh * 0.66);
        ctx.stroke();
        // cap
        ctx.fillStyle = '#2b2033';
        ctx.fillRect(x - bw * 0.56, top - s * 0.1, bw * 1.12, s * 0.12);
        // number
        if (this.showGlow) {
          const hidden = this.world.fog && l._r < 0.5;
          ctx.font = `700 ${fontPx}px "JetBrains Mono", ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = hidden ? 'rgba(200,215,240,0.75)' : (l._g > 0.5 ? COL.ink : '#e9e2d0');
          const txt = hidden ? '?' : String(l.v);
          ctx.fillText(txt, x, top + bh / 2 + 1, bw * 0.98);
          ctx.textBaseline = 'alphabetic';
        }
        // predicted marker
        if (this.predict.has(i)) {
          ctx.save();
          ctx.strokeStyle = COL.predict;
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          roundRect(ctx, x - bw / 2 - 4, top - s * 0.16 - 4, bw + 8, bh + s * 0.16 + 8, 5);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = COL.predict;
          ctx.beginPath();
          ctx.arc(x, top - s * 0.42, Math.max(3, s * 0.11), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // result marks
        const m = this.marks[i];
        if (m) {
          ctx.save();
          ctx.font = `700 ${Math.max(11, s * 0.42)}px "Atkinson Hyperlegible", system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = m === 'ok' ? COL.ok : COL.bad;
          ctx.fillText(m === 'ok' ? '✓' : m === 'miss' ? '○' : '✕', x, top - s * 0.32);
          ctx.restore();
        }
      });
    }

    drawLabelsAndPointers(ctx, g) {
      const fs = Math.max(8, Math.min(12, g.spacing * 0.3));
      ctx.font = `600 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      const byIdx = {};
      this.pointers.forEach((p, k) => { (byIdx[p.i] = byIdx[p.i] || []).push({ name: p.name, col: COL.ptr[k % COL.ptr.length] }); });
      for (let i = 0; i < this.world.n; i++) {
        const x = this.slotX(i);
        const hi = byIdx[i];
        ctx.fillStyle = hi ? COL.labelHi : 'rgba(143,163,199,0.7)';
        if (g.spacing >= 14 || i % 5 === 0 || hi) ctx.fillText(String(i), x, g.labelY);
        if (hi) {
          hi.forEach((p, k) => {
            const y = g.labelY + 6 + k * (fs + 6);
            ctx.fillStyle = p.col;
            ctx.beginPath();
            ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 5); ctx.lineTo(x + 4, y + 5); ctx.closePath(); ctx.fill();
            ctx.fillText(p.name, x, y + 5 + fs);
          });
        }
      }
    }

    drawBoat(ctx, g, dt) {
      const s = g.size;
      const x = this.boatX;
      const y = g.baseY + s * 0.42 + (this.reduced ? 0 : Math.sin(this.time * 2) * 1.2);
      if (!this.blink || this.world.boat === -1) {
        const w = Math.max(18, Math.min(52, g.spacing * 0.95));
        ctx.fillStyle = COL.boatShade;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y - 2);
        ctx.lineTo(x + w / 2, y - 2);
        ctx.lineTo(x + w * 0.32, y + w * 0.16);
        ctx.lineTo(x - w * 0.32, y + w * 0.16);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = COL.boat;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y - 2);
        ctx.lineTo(x, y - w * 0.32);
        ctx.lineTo(x + w / 2, y - 2);
        ctx.closePath();
        ctx.fill();
      }
      // Ember the firefly
      const ex = this.emberX;
      const targetY = g.baseY - s * 1.45 + (this.reduced ? 0 : Math.sin(this.time * 3.1) * 3);
      this.emberY = this.emberY == null ? targetY : this.emberY + (targetY - this.emberY) * Math.min(1, dt * 6);
      const ey = this.blink ? this.emberY : Math.min(this.emberY, y - s * 0.55);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const eg = ctx.createRadialGradient(ex, ey, 1, ex, ey, s * 0.7);
      eg.addColorStop(0, 'rgba(255,245,170,0.9)'); eg.addColorStop(1, 'rgba(255,245,170,0)');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(ex, ey, s * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      const flap = this.reduced ? 0.6 : 0.6 + 0.4 * Math.sin(this.time * 22);
      ctx.fillStyle = 'rgba(220,235,255,0.55)';
      ctx.beginPath(); ctx.ellipse(ex - 4, ey - 3, 4, 2.2 * flap + 0.6, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex + 4, ey - 3, 4, 2.2 * flap + 0.6, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COL.ember;
      ctx.beginPath(); ctx.arc(ex, ey, 3.2, 0, Math.PI * 2); ctx.fill();
      this._emberPos = { x: ex, y: ey };
    }

    drawBeams(ctx, g, dt) {
      if (!this.beams.length) return;
      const life = Math.max(0.25, this.animMs / 1000 * 1.4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.beams = this.beams.filter(b => (b.t += dt) < life);
      this.beams.forEach((b) => {
        if (b.i < 0 || b.i >= this.world.n) return;
        const a = 1 - b.t / life;
        const lx = this.slotX(b.i);
        const ly = g.baseY - g.size * 0.6;
        const e = this._emberPos || { x: lx, y: ly - 30 };
        ctx.strokeStyle = b.col;
        ctx.globalAlpha = a * 0.8;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.beginPath(); ctx.arc(lx, ly, g.size * 0.5 * (1 + b.t), 0, Math.PI * 2); ctx.stroke();
      });
      ctx.restore();
    }

    drawParticles(ctx, dt) {
      if (!this.particles.length) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.particles = this.particles.filter(p => (p.life += dt) < p.max);
      this.particles.forEach((p) => {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt;
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }

    drawFog(ctx, W, H, g) {
      ctx.save();
      for (let k = 0; k < 5; k++) {
        const x = ((this.time * (8 + k * 3) + k * 220) % (W + 300)) - 150;
        const y = g.water - g.size * 0.6 + Math.sin(k * 2.1) * g.size * 0.5;
        const r = 90 + k * 25;
        const gr = ctx.createRadialGradient(x, y, 10, x, y, r);
        gr.addColorStop(0, 'rgba(200,215,240,0.10)'); gr.addColorStop(1, 'rgba(200,215,240,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
    }

    drawAnswer(ctx, g, dt) {
      const a = this.answerFx;
      if (!a) return;
      a.t = Math.min(1, a.t + dt / 1.1);
      const e = this._emberPos || { x: this.W / 2, y: g.water };
      const tx = this.W - 20, ty = 26;
      const k = 1 - Math.pow(1 - a.t, 3);
      const x = e.x + (tx - e.x) * k;
      const y = e.y + (ty - e.y) * k;
      ctx.save();
      ctx.font = '700 14px "JetBrains Mono", ui-monospace, monospace';
      const text = 'answer: ' + (a.text.length > 24 ? a.text.slice(0, 23) + '…' : a.text);
      const w = ctx.measureText(text).width + 22;
      const bx = Math.min(x, this.W - w - 8);
      ctx.globalCompositeOperation = 'lighter';
      const hg = ctx.createRadialGradient(bx + w / 2, y, 4, bx + w / 2, y, w * 0.7);
      hg.addColorStop(0, 'rgba(255,190,90,0.35)'); hg.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(bx - w * 0.2, y - w * 0.7, w * 1.4, w * 1.4);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,226,160,0.95)';
      roundRect(ctx, bx, y - 13, w, 26, 13);
      ctx.fill();
      ctx.fillStyle = COL.ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + 11, y + 1);
      ctx.restore();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
  }

  Object.assign(WYK, { River, SPELLS, SPELL_ORDER, makeApi, RiverView, deepCopy, rng32 });
})(typeof window !== 'undefined' ? window : globalThis);
