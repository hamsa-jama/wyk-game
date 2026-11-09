/* WYK — game rules that don't touch the screen: building rivers, running a
 * program against a river, judging the result, and awarding stars.
 * Shared by the game and by test/run-tests.js.
 */
(function (root) {
  'use strict';
  const WYK = root.WYK = root.WYK || {};
  const { PyError } = WYK;

  const TYPE_LABEL = { predict: 'Predict', write: 'Write', fill: 'Fill the gaps', parsons: 'Puzzle', debug: 'Fix the bug', sandbox: 'Open river' };
  const OP_NAMES = { moves: 'moves', peeks: 'peeks', swaps: 'swaps', compares: 'comparisons', lights: 'lights' };

  function val(v, cfg) { return typeof v === 'function' ? v(cfg) : v; }

  function configFor(level, k, runSeed) {
    let cfg;
    if (level.world && !level.gen) {
      cfg = JSON.parse(JSON.stringify(level.world));
    } else {
      const seed = k === 0 ? level.seed : ((runSeed || 1) * 31 + k * 7919) >>> 0;
      cfg = level.gen(WYK.rng32(seed), k);
      cfg.glows = cfg.glows.slice();
    }
    const chw = (level.chapter && level.chapter.world) || {};
    if (cfg.fog == null && chw.fog) cfg.fog = true;
    return cfg;
  }

  function buildInterp(level, world, out) {
    const api = WYK.makeApi(world, level.api || []);
    const interp = new WYK.Interp({ maxSteps: level.maxSteps || 20000, api, out });
    (level.forbid || []).forEach((n) => {
      interp.builtins[n] = {
        type: 'builtin', name: n,
        fn: () => { throw new PyError('LockedSpell', `"${n}()" is switched off in this level — the point is to build it yourself!`); }
      };
    });
    if (world.cfg.vars) Object.keys(world.cfg.vars).forEach((k) => interp.globalScope.vars.set(k, world.cfg.vars[k]));
    return interp;
  }

  function requirementsError(level, ast, code) {
    if (/___/.test(code)) return 'Fill in every blank  ___  first.';
    for (const req of level.require || []) {
      if (req === 'recursion' && !WYK.usesRecursion(ast)) return 'This level is about recursion: your function needs to call itself.';
      if (req === 'def' && !WYK.usesNode(ast, 'Def')) return 'This level is about making your own spell: use def to create a function.';
    }
    return null;
  }

  function describeList(a) { return a.length ? a.join(', ') : 'none'; }

  /* Judge a finished run. Returns {ok, msg, marks}. */
  function judge(level, cfg, world, error, output) {
    if (error) {
      if (!(error instanceof PyError)) {
        return { ok: false, crash: true, msg: 'Something went wrong inside the game: ' + (error && error.message) };
      }
      return { ok: false, error, msg: friendly(error) };
    }
    for (const k of Object.keys(level.limits || {})) {
      const lim = val(level.limits[k], cfg);
      if (world.ops[k] > lim) {
        return { ok: false, limit: k, msg: `You used ${world.ops[k]} ${OP_NAMES[k] || k}, but this river only allows ${lim}. The program works — can you make it use fewer?` };
      }
    }
    const goal = level.goal || { type: 'none' };
    if (goal.type === 'lit') {
      const want = goal.target(cfg).slice().sort((a, b) => a - b);
      const got = world.litSet();
      const marks = {};
      const missing = want.filter(i => got.indexOf(i) < 0);
      const extra = got.filter(i => want.indexOf(i) < 0);
      got.forEach(i => { marks[i] = extra.indexOf(i) >= 0 ? 'bad' : 'ok'; });
      missing.forEach(i => { marks[i] = 'miss'; });
      if (missing.length || extra.length) {
        let msg = '';
        if (missing.length) msg += `Lantern${missing.length > 1 ? 's' : ''} ${describeList(missing)} should be lit but ${missing.length > 1 ? 'are' : 'is'} dark. `;
        if (extra.length) msg += `Lantern${extra.length > 1 ? 's' : ''} ${describeList(extra)} ${extra.length > 1 ? 'are' : 'is'} lit but shouldn't be.`;
        return { ok: false, msg: msg.trim(), marks };
      }
      return { ok: true, marks };
    }
    if (goal.type === 'answer') {
      const exp = goal.expect(cfg);
      if (!world.answered) return { ok: false, msg: 'The keeper is still waiting for an answer. Use  answer(...)  to give it.' };
      if (!WYK.pyEq(world.answer, exp)) {
        return { ok: false, msg: `You answered ${WYK.repr(world.answer, true)}, but the right answer for this river is ${WYK.repr(exp, true)}.` };
      }
      return { ok: true };
    }
    if (goal.type === 'order') {
      const exp = goal.expect(cfg);
      const got = world.glows();
      if (!WYK.pyEq(got, exp)) {
        const k = got.findIndex((g, i) => g !== exp[i]);
        return { ok: false, msg: `Not quite. The lanterns should end up as  ${exp.join(' ')}  but they are  ${got.join(' ')}.` + (k >= 0 ? ` The first difference is at position ${k}.` : '') };
      }
      return { ok: true };
    }
    return { ok: true };
  }

  function friendly(e) {
    const where = e.line ? `Line ${e.line}: ` : '';
    const body = e.message.replace(/^Line \d+: /, '');
    const cap = body.charAt(0).toUpperCase() + body.slice(1);
    return where + cap;
  }

  /* Run a program to completion on one river without animation. */
  function runOnce(level, ast, cfg) {
    const world = new WYK.River(cfg);
    let output = '';
    const interp = buildInterp(level, world, (s) => { output += s; });
    let error = null;
    try { WYK.runSync(interp.run(ast)); } catch (e) { error = e; }
    const res = judge(level, cfg, world, error, output);
    res.world = world; res.output = output; res.steps = interp.steps; res.cfg = cfg;
    return res;
  }

  function normOut(s) { return String(s).trim().split(/\s+/).filter(Boolean).join(' '); }

  /* What actually happened, in the terms a prediction asks about. */
  function predictionTruth(level, res) {
    const p = level.predict;
    if (p.mode === 'lit') return res.world.litSet();
    if (p.mode === 'pos') return res.world.boat;
    switch (p.ask) {
      case 'output': return normOut(res.output);
      case 'answer': return res.world.answered ? WYK.repr(res.world.answer, true) : '(no answer)';
      case 'glows': return res.world.glows().join(' ');
      case 'peeks': return String(res.world.ops.peeks);
      case 'pos': return String(res.world.boat);
    }
    return '';
  }
  function predictionMatches(level, guess, truth) {
    const p = level.predict;
    if (p.mode === 'lit') {
      const a = Array.from(guess || []).sort((x, y) => x - y);
      return a.length === truth.length && a.every((v, i) => v === truth[i]);
    }
    if (p.mode === 'pos') return guess === truth;
    return normOut(guess) === normOut(truth);
  }

  /* Star rules. Shown to the player before they start (goal setting). */
  function starRules(level) {
    if (level.type === 'predict') {
      return ['Run it and see', 'Predict correctly', level.explain ? 'Explain why' : 'Predict correctly, and be sure'];
    }
    if (level.type === 'parsons') return ['Solve the puzzle', 'Within 2 checks', 'Without hints'];
    const rules = ['Solve it on every river'];
    const p = level.par || {};
    const eff = p.ops ? (p.label || effLabel(p.ops)) : null;
    if (eff) rules.push(eff);
    if (p.lines) rules.push(`Use ${p.lines} lines or fewer`);
    if (rules.length < 3) rules.push('Without hints');
    if (rules.length < 3) rules.push('Within 3 runs');
    return rules;
  }
  function effLabel(ops) {
    const k = Object.keys(ops)[0];
    const v = ops[k];
    return typeof v === 'number' ? `Use ${v} ${OP_NAMES[k] || k} or fewer` : `Use as few ${OP_NAMES[k] || k} as possible`;
  }

  /* Decide stars for a solved write/fill/debug level.
   * results: array of runOnce-like results (all ok). */
  function starsFor(level, results, code, ctx) {
    const p = level.par || {};
    const checks = [true];
    if (p.ops) {
      checks.push(results.every(r => Object.keys(p.ops).every(k => r.world.ops[k] <= val(p.ops[k], r.cfg))));
    }
    if (p.lines) checks.push(WYK.codeLines(code) <= p.lines);
    if (checks.length < 3) checks.push(!ctx.hintsUsed);
    if (checks.length < 3) checks.push(ctx.runs <= 3);
    let stars = checks.filter(Boolean).length;
    if (ctx.scaffolded) stars = Math.min(stars, 2);
    return { stars, checks };
  }

  WYK.Engine = {
    TYPE_LABEL, OP_NAMES, val, configFor, buildInterp, requirementsError, judge, friendly, runOnce,
    predictionTruth, predictionMatches, normOut, starRules, starsFor
  };
})(typeof window !== 'undefined' ? window : globalThis);
