#!/usr/bin/env node
/* Checks every level in WYK:
 *  - reference solutions pass the visible river and 40 random rivers
 *  - reference solutions earn every star that is awarded for efficiency/length
 *  - debug levels really are broken, fill levels really have blanks
 *  - every multiple-choice prediction has exactly one matching option
 *  - spaced-review cards generate, run, and have unique options
 * Run with:  node test/run-tests.js
 */
'use strict';
const path = require('path');
const base = path.join(__dirname, '..', 'js');
['lang.js', 'world.js', 'levels.js', 'engine.js', 'srs.js'].forEach(f => require(path.join(base, f)));
const W = globalThis.WYK;
const E = W.Engine;
const { LEVELS, CONCEPTS } = W.Content;

let failures = 0;
let checks = 0;
function fail(id, msg) { failures++; console.log(`  ✗ ${id}: ${msg}`); }
function ok() { checks++; }

const ids = new Set();
for (const lv of LEVELS) {
  if (ids.has(lv.id)) fail(lv.id, 'duplicate id');
  ids.add(lv.id);
  if (!E.TYPE_LABEL[lv.type]) fail(lv.id, 'unknown type ' + lv.type);
  if (!CONCEPTS[lv.concept]) fail(lv.id, 'unknown concept ' + lv.concept);
  for (const a of lv.api) if (!W.SPELLS[a]) fail(lv.id, 'unknown spell ' + a);

  if (lv.type === 'predict') {
    const cfg = E.configFor(lv, 0, 1);
    const res = E.runOnce(lv, W.parse(lv.code), cfg);
    if (res.error || res.crash) { fail(lv.id, 'predict code errors: ' + res.msg); continue; }
    const truth = E.predictionTruth(lv, res);
    if (lv.predict.mode === 'choice') {
      const matches = lv.predict.options.filter(o => E.predictionMatches(lv, o, truth));
      if (matches.length !== 1) fail(lv.id, `expected exactly 1 matching option, got ${matches.length} (truth: ${truth})`);
      else ok();
      if (lv.predict.options[0] !== matches[0]) fail(lv.id, 'convention: correct option should be listed first (UI shuffles)');
    } else {
      ok();
    }
    if (lv.explain && (lv.explain.correct == null || !lv.explain.options[lv.explain.correct])) fail(lv.id, 'explain question has no correct option');
    console.log(`  · ${lv.id} predict → ${JSON.stringify(truth)}`);
    continue;
  }

  if (!lv.solution) { fail(lv.id, 'missing solution'); continue; }
  let ast;
  try { ast = W.parse(lv.solution); } catch (e) { fail(lv.id, 'solution does not parse: ' + e.message); continue; }
  const reqErr = E.requirementsError(lv, ast, lv.solution);
  if (reqErr) fail(lv.id, 'solution fails requirement: ' + reqErr);

  const results = [];
  const N = lv.gen ? 41 : 1;
  for (let k = 0; k < N; k++) {
    const cfg = E.configFor(lv, k, 12345 + k * 3);
    const res = E.runOnce(lv, ast, cfg);
    if (!res.ok) { fail(lv.id, `solution fails river k=${k} [${cfg.glows.join(' ')}] ${cfg.vars ? JSON.stringify(cfg.vars) : ''}: ${res.msg}`); break; }
    results.push(res);
  }
  if (results.length === N) ok();
  // goal sanity: a do-nothing program must not pass the visible river
  const empty = E.runOnce(lv, W.parse('pass'), E.configFor(lv, 0, 1));
  if (empty.ok) fail(lv.id, 'an empty program passes the visible river — goal is trivial');

  if (results.length === N) {
    const st = E.starsFor(lv, results, lv.solution, { hintsUsed: 0, runs: 1 });
    if (st.stars !== 3) fail(lv.id, `reference solution only earns ${st.stars} stars (${JSON.stringify(st.checks)})`);
    const maxSteps = Math.max(...results.map(r => r.steps));
    const peeks = Math.max(...results.map(r => r.world.ops.peeks));
    console.log(`  · ${lv.id} ${lv.type.padEnd(7)} ok  lines=${W.codeLines(lv.solution)} maxSteps=${maxSteps} maxPeeks=${peeks}`);
  }

  if (lv.type === 'fill') {
    if (!/___/.test(lv.code)) fail(lv.id, 'fill level has no blanks');
  }
  if (lv.type === 'debug') {
    let broken = false;
    let bast = null;
    try { bast = W.parse(lv.code); } catch (e) { broken = true; }
    if (bast) {
      for (let k = 0; k < (lv.gen ? 8 : 1) && !broken; k++) {
        const r = E.runOnce(lv, bast, E.configFor(lv, k, 999 + k));
        if (!r.ok) broken = true;
      }
    }
    if (!broken) fail(lv.id, 'debug starter code is not actually broken');
    else ok();
  }
  if (lv.type === 'write' || lv.type === 'fill' || lv.type === 'debug') {
    if (!lv.hints || !lv.hints.length) fail(lv.id, 'no hints');
  }
}

/* review cards */
console.log('\nReview cards');
for (const cid of Object.keys(CONCEPTS)) {
  for (let s = 0; s < 60; s++) {
    let card;
    try { card = W.SRS.makeCard(cid, W.rng32(s * 101 + cid.length)); } catch (e) { fail('card ' + cid, 'generator threw: ' + e.message); break; }
    if (!card || card.answer == null || card.answer === '') { fail('card ' + cid, 'empty answer'); break; }
    if (card.kind === 'choice') {
      const uniq = new Set(card.options);
      if (uniq.size !== card.options.length) { fail('card ' + cid, 'duplicate options ' + JSON.stringify(card.options)); break; }
      if (card.options.indexOf(card.answer) < 0) { fail('card ' + cid, 'answer missing from options'); break; }
    }
    if (card.kind === 'num' && !/^-?\d+$/.test(card.answer)) { fail('card ' + cid, 'numeric card with non-numeric answer ' + card.answer); break; }
  }
  const ex = W.SRS.makeCard(cid, W.rng32(5));
  console.log(`  · ${cid.padEnd(7)} e.g. answer=${JSON.stringify(ex.answer)}  ${ex.kind}`);
  ok();
}

/* FSRS sanity */
const F = W.SRS.FSRS;
let st = F.init(3, 0);
const DAY = 86400000;
if (Math.abs(F.retrievability(st, st.last + F.intervalDays(st.S) * DAY) - 0.9) > 0.01) fail('fsrs', 'R at due date should be 0.9');
const good = F.review(st, 3, st.last + 4 * DAY);
const again = F.review(st, 1, st.last + 4 * DAY);
if (!(good.S > st.S)) fail('fsrs', 'a successful review should grow stability');
if (!(again.S < st.S)) fail('fsrs', 'a lapse should shrink stability');
const same = F.review(st, 3, st.last + 60000);
if (same.S > st.S * 1.05) fail('fsrs', 'a same-day review should barely change stability');
console.log(`\nFSRS: S0(good)=${st.S.toFixed(2)}d → after good@4d ${good.S.toFixed(2)}d, after again@4d ${again.S.toFixed(2)}d`);

console.log(`\n${LEVELS.length} levels, ${checks} checks passed, ${failures} failure${failures === 1 ? '' : 's'}.`);
process.exit(failures ? 1 : 0);
