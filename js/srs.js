/* WYK — keeping what you learn.
 * FSRS-4.5 memory model (Ye et al.) scheduled per concept, plus generators that
 * create a fresh question every review, so learners recall the idea rather than
 * a memorised answer. Every answer is computed by running the code.
 */
(function (root) {
  'use strict';
  const WYK = root.WYK = root.WYK || {};
  const DAY = 86400000;

  /* ---------------- FSRS-4.5 ---------------- */
  const FSRS = {
    W: [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755],
    DECAY: -0.5,
    FACTOR: 19 / 81,
    RETENTION: 0.9,
    clampD(d) { return Math.min(10, Math.max(1, d)); },
    initD(g) { return this.clampD(this.W[4] - (g - 3) * this.W[5]); },
    curve(days, S) { return Math.pow(1 + this.FACTOR * days / S, this.DECAY); },
    intervalDays(S) { return S / this.FACTOR * (Math.pow(this.RETENTION, 1 / this.DECAY) - 1); },
    retrievability(st, now) {
      if (!st) return 0;
      return this.curve(Math.max(0, (now - st.last) / DAY), st.S);
    },
    schedule(st) {
      const days = Math.max(4 / 24, this.intervalDays(st.S));
      st.due = st.last + days * DAY;
      return st;
    },
    init(g, now) {
      const st = { S: this.W[g - 1], D: this.initD(g), last: now, reps: 1, lapses: g === 1 ? 1 : 0 };
      return this.schedule(st);
    },
    review(prev, g, now) {
      const R = this.retrievability(prev, now);
      const W = this.W;
      let D = prev.D - W[6] * (g - 3);
      D = this.clampD(W[7] * this.initD(3) + (1 - W[7]) * D);
      let S;
      if (g === 1) {
        S = W[11] * Math.pow(prev.D, -W[12]) * (Math.pow(prev.S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R));
        S = Math.min(S, prev.S);
      } else {
        const hard = g === 2 ? W[15] : 1;
        const easy = g === 4 ? W[16] : 1;
        S = prev.S * (1 + Math.exp(W[8]) * (11 - prev.D) * Math.pow(prev.S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * hard * easy);
      }
      return this.schedule({ S: Math.max(0.1, S), D, last: now, reps: (prev.reps || 0) + 1, lapses: (prev.lapses || 0) + (g === 1 ? 1 : 0) });
    }
  };

  /* ---------------- helpers ---------------- */
  function int(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function runCode(code) {
    let out = '';
    const it = new WYK.Interp({ out: (s) => { out += s; }, maxSteps: 20000 });
    WYK.runSync(it.run(WYK.parse(code)));
    return out.trim().split(/\s+/).filter(Boolean).join(' ');
  }

  /* Build choice options: the right answer plus misconception-based distractors. */
  function choices(r, answer, distractors, filler) {
    const opts = [answer];
    for (const d of distractors) if (d != null && opts.indexOf(String(d)) < 0 && opts.length < 4) opts.push(String(d));
    let guard = 0;
    while (opts.length < 4 && filler && guard++ < 40) {
      const f = String(filler(r));
      if (opts.indexOf(f) < 0) opts.push(f);
    }
    return shuffle(r, opts);
  }

  /* ---------------- card generators ---------------- */
  /* Each returns { code?, q, kind: 'num'|'choice', options?, answer?, explain }.
   * When answer is missing, it is computed by running the code. */
  const GEN = {
    seq: [
      (r) => {
        const a = int(r, 2, 9), b = int(r, 1, 9), c = int(r, 2, 4);
        return { code: `x = ${a}\nx = x + ${b}\nx = x * ${c}\nprint(x)`, q: 'What is printed?', kind: 'num',
          explain: `Lines run top to bottom: x is ${a}, then ${a + b}, then ${(a + b) * c}.` };
      },
      (r) => {
        const a = int(r, 2, 9), c = int(r, 10, 20);
        return { code: `a = ${a}\nb = a\na = ${c}\nprint(b)`, q: 'What is printed?', kind: 'num',
          explain: `b = a copies the value ${a} into b at that moment. Changing a afterwards doesn't change b.` };
      },
      (r) => {
        const s = int(r, 1, 3), f = int(r, 3, 5), bk = int(r, 1, 2);
        const lines = [];
        for (let k = 0; k < f; k++) lines.push('pos = pos + 1');
        for (let k = 0; k < bk; k++) lines.push('pos = pos - 1');
        return { code: `pos = ${s}\n${lines.join('\n')}\nprint(pos)`, q: 'A boat starts at position ' + s + '. Where does it end up?', kind: 'num',
          explain: `${f} steps forward and ${bk} back: ${s} + ${f} - ${bk} = ${s + f - bk}.` };
      }
    ],
    loop: [
      (r) => {
        const a = int(r, 0, 4), b = a + int(r, 3, 8);
        return { code: `count = 0\nfor i in range(${a}, ${b}):\n    count += 1\nprint(count)`, q: 'What is printed?', kind: 'num',
          explain: `range(${a}, ${b}) gives ${a} up to ${b - 1} — that's ${b} - ${a} = ${b - a} numbers. The stop value is never included.` };
      },
      (r) => {
        const a = int(r, 0, 5), s = int(r, 2, 4), b = a + s * int(r, 2, 4) + int(r, 0, s - 1);
        const vals = []; for (let i = a; i < b; i += s) vals.push(i);
        return { code: `for i in range(${a}, ${b}, ${s}):\n    print(i)`, q: 'What is the LAST number printed?', kind: 'num', answer: String(vals[vals.length - 1]),
          explain: `It prints ${vals.join(', ')}. The next would be ${vals[vals.length - 1] + s}, which isn't below ${b}.` };
      },
      (r) => {
        const a = int(r, 2, 5), b = int(r, 2, 4);
        return { code: `c = 0\nfor i in range(${a}):\n    for j in range(${b}):\n        c += 1\nprint(c)`, q: 'What is printed?', kind: 'num',
          explain: `The inner loop runs ${b} times for each of the ${a} outer repeats: ${a} × ${b} = ${a * b}.` };
      },
      (r) => {
        const n = int(r, 3, 6);
        const code = `for i in range(${n}):\n    print("*")\nprint("done")`;
        const ans = String(n);
        return { code, q: 'How many stars are printed?', kind: 'choice', answer: ans,
          options: choices(r, ans, [n + 1, n - 1, 1], () => int(r, 1, 9)),
          explain: `"done" is not indented, so it runs once after the loop. The loop prints ${n} stars.` };
      }
    ],
    cond: [
      (r) => {
        const v = pick(r, [3, 5, 6, 10, 11, 15]);
        return { code: `x = ${v}\nif x > 10:\n    print("big")\nelif x > 5:\n    print("medium")\nelse:\n    print("small")`, q: 'What is printed?', kind: 'choice',
          options: shuffle(r, ['big', 'medium', 'small', 'nothing']),
          explain: v > 10 ? `${v} > 10 is True, so "big" — the elif is never checked.` : v > 5 ? `${v} > 10 is False, ${v} > 5 is True, so "medium".` : `${v} is not bigger than 10 or 5, so else runs.` };
      },
      (r) => {
        const a = int(r, 1, 8), b = int(r, 1, 8), op = pick(r, ['and', 'or']);
        return { code: `a = ${a}\nb = ${b}\nif a > 4 ${op} b > 4:\n    print("yes")\nelse:\n    print("no")`, q: 'What is printed?', kind: 'choice',
          options: shuffle(r, ['yes', 'no']),
          explain: `a > 4 is ${a > 4 ? 'True' : 'False'}, b > 4 is ${b > 4 ? 'True' : 'False'}. "${op}" needs ${op === 'and' ? 'both' : 'at least one'} to be True.` };
      },
      (r) => {
        const vals = Array.from({ length: 6 }, () => int(r, 1, 9));
        return { code: `n = 0\nfor g in [${vals.join(', ')}]:\n    if g % 2 == 1:\n        n += 1\nprint(n)`, q: 'What is printed?', kind: 'num',
          explain: `g % 2 == 1 is True for odd numbers. Count the odd ones in [${vals.join(', ')}].` };
      }
    ],
    while: [
      (r) => {
        const N = int(r, 10, 70);
        return { code: `k = 1\nsteps = 0\nwhile k < ${N}:\n    k = k * 2\n    steps += 1\nprint(steps)`, q: 'What is printed?', kind: 'num',
          explain: 'k doubles each time: 1, 2, 4, 8, 16, 32, 64… Count the doublings until k is no longer below ' + N + '.' };
      },
      (r) => {
        const n = int(r, 10, 25), s = int(r, 3, 6);
        return { code: `n = ${n}\nwhile n > 0:\n    n = n - ${s}\nprint(n)`, q: 'What is printed?', kind: 'num',
          explain: `The loop stops the first time n is not above 0 — which may be below 0.` };
      },
      (r) => {
        const t = int(r, 3, 8);
        const code = `x = 0\nwhile x != ${t}:\n    x = x + 2\nprint(x)`;
        const ans = t % 2 === 0 ? `prints ${t}` : 'never stops';
        return { code, q: 'What happens?', kind: 'choice', answer: ans,
          options: choices(r, ans, [t % 2 === 0 ? 'never stops' : `prints ${t}`, `prints ${t + 1}`, `prints ${t - 1}`]),
          explain: t % 2 === 0 ? `x goes 0, 2, 4 … and reaches ${t} exactly.` : `x only takes even values, so it jumps over ${t} and the question x != ${t} stays True forever.` };
      }
    ],
    var: [
      (r) => {
        const a = int(r, 1, 9); let b = int(r, 1, 9); if (b === a) b = a % 9 + 1;
        const ans = `${b} ${b}`;
        return { code: `a = ${a}\nb = ${b}\na = b\nb = a\nprint(a, b)`, q: 'What is printed?', kind: 'choice', answer: ans,
          options: choices(r, ans, [`${b} ${a}`, `${a} ${b}`, `${a} ${a}`]),
          explain: `After a = b, both hold ${b}. Then b = a copies ${b} again. The old ${a} is lost — swapping needs a third box, or  a, b = b, a.` };
      },
      (r) => {
        const vals = Array.from({ length: 5 }, () => int(r, 1, 9));
        return { code: `total = 0\nfor x in [${vals.join(', ')}]:\n    if x % 2 == 0:\n        total += x\nprint(total)`, q: 'What is printed?', kind: 'num',
          explain: 'Only even numbers are added to total.' };
      },
      (r) => {
        const vals = Array.from({ length: 5 }, () => int(r, 1, 20));
        return { code: `best = 0\nfor x in [${vals.join(', ')}]:\n    if x > best:\n        best = x\nprint(best)`, q: 'What is printed?', kind: 'num',
          explain: 'best keeps the biggest value seen so far.' };
      }
    ],
    func: [
      (r) => {
        const a = int(r, 1, 9), b = int(r, 1, 9), m = int(r, 2, 3);
        return { code: `def f(a, b):\n    return a * ${m} + b\n\nprint(f(${b}, ${a}))`, q: 'What is printed?', kind: 'num',
          explain: `Inputs are matched by position: inside f, a is ${b} and b is ${a}. So ${b} × ${m} + ${a}.` };
      },
      (r) => {
        const y = int(r, 2, 9);
        const ans = `${y} ${(y + 1) * 2}`;
        return { code: `def g(x):\n    x = x + 1\n    return x * 2\n\ny = ${y}\nz = g(y)\nprint(y, z)`, q: 'What is printed?', kind: 'choice', answer: ans,
          options: choices(r, ans, [`${y + 1} ${(y + 1) * 2}`, `${y} ${y * 2}`, `${y + 1} ${y * 2 + 1}`]),
          explain: `g gets a copy of the number ${y} in x. Changing x doesn't change y.` };
      },
      (r) => {
        const a = int(r, 2, 9);
        const ans = 'None';
        return { code: `def h(x):\n    x * 2\n\nprint(h(${a}))`, q: 'What is printed?', kind: 'choice', answer: ans,
          options: choices(r, ans, [String(a * 2), String(a), 'an error']),
          explain: 'h works out x * 2 but never returns it. A function without return gives back None.' };
      }
    ],
    list: [
      (r) => {
        const v = Array.from({ length: 5 }, () => int(r, 1, 9)), i = int(r, 0, 3);
        return { code: `a = [${v.join(', ')}]\nprint(a[${i}] + a[-1])`, q: 'What is printed?', kind: 'num',
          explain: `a[${i}] is ${v[i]} (counting from 0) and a[-1] is the last item, ${v[4]}.` };
      },
      (r) => {
        const v = Array.from({ length: 4 }, () => int(r, 1, 9)), i = int(r, 0, 3); let j = int(r, 0, 3); if (j === i) j = (i + 1) % 4;
        const res = v.slice(); res[i] = v[j];
        const ans = '[' + res.join(', ') + ']';
        const wrong1 = v.slice(); wrong1[j] = v[i];
        const wrong2 = v.slice(); wrong2[i] = v[j]; wrong2[j] = v[i];
        return { code: `a = [${v.join(', ')}]\na[${i}] = a[${j}]\nprint(a)`, q: 'What is printed?', kind: 'choice', answer: ans,
          options: choices(r, ans, ['[' + wrong1.join(', ') + ']', '[' + wrong2.join(', ') + ']', '[' + v.join(', ') + ']']),
          explain: `Position ${i} gets a copy of what's at position ${j}. Position ${j} doesn't change.` };
      },
      (r) => {
        const n = int(r, 3, 6);
        return { code: `vals = []\nfor i in range(${n}):\n    vals.append(i * 2)\nprint(len(vals), vals[-1])`, q: 'What is printed?', kind: 'choice',
          options: choices(r, `${n} ${(n - 1) * 2}`, [`${n} ${n * 2}`, `${n - 1} ${(n - 1) * 2}`, `${n + 1} ${n * 2}`]),
          explain: `${n} items are appended: 0, 2, … ${(n - 1) * 2}.` };
      }
    ],
    search: [
      (r) => {
        const n = pick(r, [7, 15, 31, 100, 1000]);
        const ans = String(Math.floor(Math.log2(n)) + 1);
        return { q: `A sorted river has ${n} lanterns. What is the most peeks binary search needs to find one?`, kind: 'num', answer: ans,
          explain: `Each peek halves what's left: ${n} → ${Math.floor(n / 2)} → … → 1. That takes ${ans} peeks. Checking one by one could take ${n}.` };
      },
      (r) => {
        const n = pick(r, [8, 12, 16, 20, 30]);
        const target = int(r, 0, n - 1);
        return { code: `lo = 0\nhi = ${n - 1}\npeeks = 0\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    peeks += 1\n    if mid == ${target}:\n        break\n    elif mid < ${target}:\n        lo = mid + 1\n    else:\n        hi = mid - 1\nprint(peeks)`,
          q: `Lanterns 0 to ${n - 1} are sorted. How many peeks to find position ${target}?`, kind: 'num',
          explain: 'Follow lo and hi: each peek looks at the middle and throws away the half that can\'t contain the target.' };
      },
      (r) => {
        const ans = 'It must be sorted';
        return { q: 'What must be true about a river for binary search to work?', kind: 'choice', answer: ans,
          options: shuffle(r, [ans, 'It must have an even number of lanterns', 'The target must be in the middle', 'It must be short']),
          explain: 'Binary search throws away half the river after one peek. That is only safe when everything left of a lantern is smaller and everything right is bigger.' };
      }
    ],
    sort: [
      (r) => {
        const v = shuffle(r, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 5);
        const a = v.slice();
        for (let j = 0; j < a.length - 1; j++) if (a[j] > a[j + 1]) { const t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; }
        const ans = a.join(' ');
        const sorted = v.slice().sort((x, y) => x - y).join(' ');
        return { code: `a = [${v.join(', ')}]\nfor j in range(len(a) - 1):\n    if a[j] > a[j + 1]:\n        a[j], a[j + 1] = a[j + 1], a[j]`, q: 'After ONE pass of bubble sort, what order is the list in?', kind: 'choice', answer: ans,
          options: choices(r, ans, [sorted, v.join(' '), v.slice().reverse().join(' ')], () => shuffle(r, v).join(' ')),
          explain: 'One pass carries the biggest value to the end, but the rest may still be jumbled.' };
      },
      (r) => {
        const n = int(r, 5, 12);
        return { q: `Selection sort puts one lantern in its final place per swap. At most how many swaps does it need for ${n} lanterns?`, kind: 'num', answer: String(n - 1),
          explain: `Once ${n - 1} lanterns are in place, the last one must be too. So ${n - 1}.` };
      },
      (r) => {
        const v = shuffle(r, [1, 2, 3, 4, 5]).slice(0, 4);
        return { code: `a = [${v.join(', ')}]\nflips = 0\nfor i in range(len(a)):\n    for j in range(i + 1, len(a)):\n        if a[i] > a[j]:\n            flips += 1\nprint(flips)`,
          q: `How many neighbour-swaps does it take to sort [${v.join(', ')}]? (This code counts it.)`, kind: 'num',
          explain: 'Every pair that is in the wrong order needs exactly one neighbour-swap to fix. Count the out-of-order pairs.' };
      }
    ],
    recur: [
      (r) => {
        const n = int(r, 3, 5);
        return { code: `def f(n):\n    if n <= 1:\n        return 1\n    return n * f(n - 1)\n\nprint(f(${n}))`, q: 'What is printed?', kind: 'num',
          explain: `f(${n}) = ${n} × f(${n - 1}) = … = ${Array.from({ length: n }, (_, i) => n - i).join(' × ')}.` };
      },
      (r) => {
        const n = int(r, 3, 6);
        return { code: `def s(n):\n    if n == 0:\n        return 0\n    return n + s(n - 1)\n\nprint(s(${n}))`, q: 'What is printed?', kind: 'num',
          explain: `s adds ${n} + ${n - 1} + … + 1 + 0.` };
      },
      (r) => {
        const n = int(r, 2, 3);
        const ans = runCode(`def e(k):\n    if k == 0:\n        return\n    e(k - 1)\n    print(k)\n\ne(${n})`);
        const rev = ans.split(' ').reverse().join(' ');
        return { code: `def e(k):\n    if k == 0:\n        return\n    e(k - 1)\n    print(k)\n\ne(${n})`, q: 'What is printed (in order)?', kind: 'choice', answer: ans,
          options: choices(r, ans, [rev, ans + ' 0', '0 ' + ans]),
          explain: 'The print comes after the recursive call, so the innermost call (k = 1) prints first.' };
      }
    ],
    dp: [
      (r) => {
        const n = int(r, 3, 6);
        return { code: `calls = 0\ndef fib(n):\n    global calls\n    calls += 1\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\n\nfib(${n})\nprint(calls)`,
          q: `How many times is fib called to work out fib(${n}) without remembering answers?`, kind: 'num',
          explain: 'Each call makes two more, so the same small values get worked out again and again. Storing answers (memoization) makes each one get worked out once.' };
      },
      (r) => {
        const n = int(r, 4, 7);
        return { code: `ways = [0] * ${n}\nways[0] = 1\nways[1] = 1\nfor i in range(2, ${n}):\n    ways[i] = ways[i - 1] + ways[i - 2]\nprint(ways[${n - 1}])`,
          q: 'What is printed?', kind: 'num',
          explain: 'Each slot is filled from the two before it, left to right — every answer is worked out exactly once.' };
      }
    ]
  };

  function makeCard(concept, r) {
    const gens = GEN[concept];
    const g = gens[Math.floor(r() * gens.length)];
    const card = g(r);
    card.concept = concept;
    if (card.answer == null) card.answer = runCode(card.code);
    if (card.kind === 'choice' && card.options && card.options.indexOf(card.answer) < 0) {
      card.options = card.options.slice(0, 3).concat([card.answer]);
      card.options = shuffle(r, card.options);
    }
    return card;
  }

  /* Trace a snippet for the "show me" table: line + variables at each step. */
  function trace(code, limit) {
    const rows = [];
    let out = '';
    const it = new WYK.Interp({ out: (s) => { out += s; }, maxSteps: 4000 });
    const lines = WYK.normalize(code).split('\n');
    try {
      const gen = it.run(WYK.parse(code));
      for (;;) {
        const r = gen.next();
        if (r.done) break;
        const ev = r.value;
        if (ev.t !== 'line') continue;
        if (rows.length >= (limit || 40)) { rows.push({ line: null }); break; }
        const vars = [];
        const add = (m, prefix) => m.forEach((v, k) => { if (!(v && (v.type === 'func' || v.type === 'builtin'))) vars.push(prefix + k + '=' + WYK.repr(v, true)); });
        if (ev.scope.locals) add(ev.scope.vars, '');
        add(it.globalScope.vars, ev.scope.locals ? '(outer) ' : '');
        rows.push({ line: ev.line, src: (lines[ev.line - 1] || '').trim(), vars: vars.join('  ') });
      }
    } catch (e) { rows.push({ line: null, err: e.message }); }
    return rows;
  }

  WYK.SRS = { FSRS, GEN, makeCard, trace, DAY, shuffle };
})(typeof window !== 'undefined' ? window : globalThis);
