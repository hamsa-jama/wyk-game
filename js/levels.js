/* WYK — chapters, concepts and levels.
 * Every level carries a reference solution; test/run-tests.js proves each one
 * passes its randomized rivers, that debug levels really are broken, and that
 * every prediction question has exactly one right answer.
 */
(function (root) {
  'use strict';
  const WYK = root.WYK = root.WYK || {};

  /* ---------- random river helpers ---------- */
  const R = {
    int: (r, a, b) => a + Math.floor(r() * (b - a + 1)),
    pick: (r, arr) => arr[Math.floor(r() * arr.length)],
    glows: (r, n, a, b) => Array.from({ length: n }, () => R.int(r, a, b)),
    shuffle: (r, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
    distinct: (r, n, a, b) => { const pool = []; for (let v = a; v <= b; v++) pool.push(v); return R.shuffle(r, pool).slice(0, n); },
    sortedDistinct: (r, n, a, b) => R.distinct(r, n, a, b).sort((x, y) => x - y),
    blank: (n) => Array.from({ length: n }, () => 1)
  };
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const where = (fn) => (cfg) => cfg.glows.map((g, i) => (fn(g, i, cfg.glows) ? i : -1)).filter(i => i >= 0);
  const inversions = (a) => { let c = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) c++; return c; };
  const isPrime = (x) => { if (x < 2) return false; for (let d = 2; d * d <= x; d++) if (x % d === 0) return false; return true; };
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

  /* ---------- concepts (the things that get spaced review) ---------- */
  const CONCEPTS = {
    seq: {
      name: 'Sequence', glyph: 'I',
      summary: 'A program is a list of instructions. The computer runs them one at a time, top to bottom, exactly as written.',
      example: 'forward()\nlight()\nforward()'
    },
    loop: {
      name: 'For loops', glyph: 'II',
      summary: 'A for loop repeats the indented lines under it. range(5) gives 0, 1, 2, 3, 4 — five numbers, starting at 0 and stopping before 5.',
      example: 'for i in range(5):\n    forward()\n    light()'
    },
    cond: {
      name: 'Decisions', glyph: 'III',
      summary: 'if checks a question that is True or False. The indented lines only run when it is True. else runs when it is False.',
      example: 'if glow() > 5:\n    light()\nelse:\n    pass'
    },
    while: {
      name: 'While loops', glyph: 'IV',
      summary: 'A while loop keeps repeating as long as its question stays True. Something inside must change, or it repeats forever.',
      example: 'while not at_end():\n    forward()'
    },
    var: {
      name: 'Variables', glyph: 'V',
      summary: 'A variable is a named box that holds a value. You can read it, change it, and use it to remember things while the program runs.',
      example: 'count = 0\ncount = count + 1\ncount += 1'
    },
    func: {
      name: 'Functions', glyph: 'VI',
      summary: 'def makes your own spell. Inputs go in the brackets. return sends a value back to whoever called it.',
      example: 'def double(x):\n    return x * 2\n\nprint(double(4))'
    },
    list: {
      name: 'Lists & positions', glyph: 'VII',
      summary: 'Lanterns and lists are numbered from 0. vals[0] is the first item, vals[-1] the last, and len(vals) counts them.',
      example: 'vals = [7, 3, 9]\nvals.append(4)\nprint(vals[0], vals[-1])'
    },
    search: {
      name: 'Searching', glyph: 'VIII',
      summary: 'On a sorted river, binary search checks the middle and throws away the half that can\'t hold the answer. 1,000 lanterns need only 10 peeks.',
      example: 'mid = (lo + hi) // 2\nif peek(mid) < target:\n    lo = mid + 1\nelse:\n    hi = mid'
    },
    sort: {
      name: 'Sorting', glyph: 'IX',
      summary: 'Sorting puts things in order by comparing and swapping. Different strategies use very different numbers of comparisons and swaps.',
      example: 'if peek(j) > peek(j + 1):\n    swap(j, j + 1)'
    },
    recur: {
      name: 'Recursion', glyph: 'X',
      summary: 'A recursive function solves a big problem by calling itself on a smaller one, until it reaches a base case it can answer straight away.',
      example: 'def countdown(k):\n    if k == 0:\n        return\n    print(k)\n    countdown(k - 1)'
    },
    dp: {
      name: 'Remembering answers', glyph: 'XI',
      summary: 'When a problem keeps solving the same smaller problems, store each answer in a list the first time. This is called dynamic programming.',
      example: 'ways = [0] * n\nways[0] = 1\nfor i in range(1, n):\n    ways[i] = ways[i - 1] + ...'
    }
  };

  /* ---------- chapters ---------- */
  const CHAPTERS = [];
  function chapter(def) { CHAPTERS.push(def); return def; }

  /* I — First Light */
  chapter({
    id: 'c1', num: 1, title: 'First Light', concept: 'seq',
    story: 'The village floats its lanterns at dusk. Ember waits in the paper boat at the dock. Ember does exactly what you write — nothing more, nothing less.',
    world: { showGlow: false },
    levels: [
      {
        id: 'c1-1', type: 'predict', title: 'Wake the Wick', concept: 'seq', intro: true,
        api: ['forward', 'light'],
        brief: '<p>This is keeper\'s script. Each line is one instruction for Ember. <code>forward()</code> rows the boat to the next lantern. <code>light()</code> lights the lantern beside the boat.</p><p>Read the code, then <strong>tap the lanterns you think will be lit</strong>.</p>',
        code: 'forward()\nlight()\nforward()\nforward()\nlight()',
        world: { glows: R.blank(5) },
        predict: { mode: 'lit' },
        explain: {
          q: 'Why does lantern 1 stay dark?',
          options: ['The boat rowed past it without a light() in between', 'Lantern 1 is broken', 'light() only works on every other lantern'],
          correct: 0,
          why: 'Between the two light() calls there are two forward() calls, so the boat passes lantern 1 without lighting it.'
        }
      },
      {
        id: 'c1-2', type: 'write', title: 'Three Sparks', concept: 'seq',
        api: ['forward', 'light'],
        brief: '<p>Light lanterns <strong>0, 1 and 3</strong> — the ones with dashed gold rings. The boat starts at the dock, before lantern 0.</p>',
        code: '# Light lanterns 0, 1 and 3\nforward()\nlight()\n',
        solution: 'forward()\nlight()\nforward()\nlight()\nforward()\nforward()\nlight()',
        world: { glows: R.blank(5) },
        goal: { type: 'lit', target: () => [0, 1, 3] },
        par: { lines: 7, ops: { moves: 4 } },
        hints: [
          'Count the steps: the first forward() reaches lantern 0. How many more to reach lantern 1? And then lantern 3?',
          'After lighting lantern 1 you need two forward() calls to reach lantern 3.',
          'The pattern is: forward, light, forward, light, forward, forward, light.'
        ]
      },
      {
        id: 'c1-3', type: 'parsons', title: 'Scrambled Spell', concept: 'seq',
        api: ['forward', 'light'],
        brief: '<p>The old keeper\'s spell got scrambled by the wind. Put the lines in order so lanterns <strong>1 and 3</strong> light up.</p>',
        solution: 'forward()\nforward()\nlight()\nforward()\nforward()\nlight()',
        world: { glows: R.blank(5) },
        goal: { type: 'lit', target: () => [1, 3] },
        hints: ['Every light() needs the boat to be in the right place first.', 'You need two forward() lines before the first light().']
      },
      {
        id: 'c1-4', type: 'debug', title: 'One Short', concept: 'seq',
        api: ['forward', 'light'],
        brief: '<p>This spell should light lanterns <strong>1 and 4</strong>, but it lights the wrong one. Find the bug and fix it. Bugs are clues, not failures.</p>',
        code: 'forward()\nforward()\nlight()\nforward()\nforward()\nlight()',
        solution: 'forward()\nforward()\nlight()\nforward()\nforward()\nforward()\nlight()',
        world: { glows: R.blank(6) },
        goal: { type: 'lit', target: () => [1, 4] },
        hints: ['Run it first and watch where the second lantern gets lit.', 'From lantern 1 to lantern 4 is three steps, not two.']
      },
      {
        id: 'c1-5', type: 'write', title: 'Rowing Backwards', concept: 'seq',
        api: ['forward', 'back', 'light'],
        brief: '<p>New spell: <code>back()</code> rows one lantern toward the dock. This time the boat starts at <strong>lantern 5</strong>.</p><p>Light lanterns <strong>6 and 2</strong>. Can you plan the shortest trip?</p>',
        code: '# The boat starts at lantern 5.\n',
        solution: 'forward()\nlight()\nback()\nback()\nback()\nback()\nlight()',
        world: { glows: R.blank(7), start: 5 },
        goal: { type: 'lit', target: () => [2, 6] },
        par: { ops: { moves: 5 } },
        hints: ['Which target is closer to lantern 5?', 'Go to 6 first (one step), then row back to 2 (four steps). That\'s 5 moves in total.']
      }
    ]
  });

  /* II — Rhythm of the River */
  chapter({
    id: 'c2', num: 2, title: 'Rhythm of the River', concept: 'loop',
    story: 'Further downstream the river widens and there are more lanterns than you could ever list one by one. Time to teach Ember rhythm.',
    world: { showGlow: false },
    levels: [
      {
        id: 'c2-1', type: 'predict', title: 'Three Strokes', concept: 'loop', intro: true,
        api: ['forward', 'light'],
        brief: '<p><code>for i in range(3):</code> repeats the <strong>indented</strong> lines under it 3 times. Lines that are not indented are outside the loop.</p><p>Tap the lanterns you think will be lit.</p>',
        code: 'for i in range(3):\n    forward()\nlight()',
        world: { glows: R.blank(6) },
        predict: { mode: 'lit' },
        explain: {
          q: 'Why is only one lantern lit?',
          options: ['light() is not indented, so it runs once, after the loop', 'range(3) only lights one lantern', 'The loop stopped early'],
          correct: 0,
          why: 'Only indented lines belong to the loop. forward() ran 3 times; light() ran once at the end.'
        }
      },
      {
        id: 'c2-2', type: 'predict', title: 'Indent Matters', concept: 'loop',
        api: ['forward', 'light'],
        brief: '<p>Same spell, one small change: <code>light()</code> is now indented. Predict again.</p>',
        code: 'for i in range(3):\n    forward()\n    light()',
        world: { glows: R.blank(6) },
        predict: { mode: 'lit' },
        explain: {
          q: 'How many times did light() run?',
          options: ['3 times — it is inside the loop now', '1 time', '4 times'],
          correct: 0,
          why: 'Four spaces of indentation moved light() inside the loop, so it repeats with forward().'
        }
      },
      {
        id: 'c2-3', type: 'fill', title: 'Count the Strokes', concept: 'loop',
        api: ['forward', 'light'],
        brief: '<p>Light <strong>all 8</strong> lanterns. Replace the <code>___</code> with the right number.</p>',
        code: 'for i in range(___):\n    forward()\n    light()',
        solution: 'for i in range(8):\n    forward()\n    light()',
        world: { glows: R.blank(8) },
        goal: { type: 'lit', target: (c) => range(c.glows.length) },
        hints: ['How many lanterns are there? Count the index numbers under them, starting from 0.', 'Lanterns 0 to 7 is 8 lanterns.']
      },
      {
        id: 'c2-4', type: 'write', title: 'Every Other', concept: 'loop',
        api: ['forward', 'light'],
        brief: '<p>Light the even lanterns: <strong>0, 2, 4, 6, 8, 10</strong>. You could write 17 lines… or use a loop and do it in 6.</p>',
        code: '',
        solution: 'forward()\nlight()\nfor i in range(5):\n    forward()\n    forward()\n    light()',
        world: { glows: R.blank(11) },
        goal: { type: 'lit', target: (c) => range(c.glows.length).filter(i => i % 2 === 0) },
        par: { lines: 6 },
        hints: ['What repeats? After the first lantern, it\'s always: forward, forward, light.', 'Light lantern 0 first, then loop 5 times.', 'forward()\nlight()\nfor i in range(5):\n    ...two forwards and a light...']
      },
      {
        id: 'c2-5', type: 'predict', title: 'Counting by Threes', concept: 'loop',
        api: [],
        brief: '<p><code>range(start, stop, step)</code> counts from <em>start</em>, jumps by <em>step</em>, and stops <em>before</em> reaching <em>stop</em>. <code>print</code> writes a value to the log.</p>',
        code: 'for i in range(2, 11, 3):\n    print(i)',
        world: { glows: R.blank(4) },
        predict: { mode: 'choice', ask: 'output', prompt: 'What will be printed?', options: ['2 5 8', '2 5 8 11', '3 6 9', '2 4 6 8 10'] },
        explain: {
          q: 'Why isn\'t 11 printed?',
          options: ['range stops before it reaches the stop value', '11 is too big for print', 'The step skips odd numbers'],
          correct: 0,
          why: 'range(2, 11, 3) gives 2, 5, 8. The next number would be 11, and range always stops before the stop value.'
        }
      },
      {
        id: 'c2-6', type: 'parsons', title: 'Twin Flames', concept: 'loop',
        api: ['forward', 'light'],
        brief: '<p>A loop can live inside another loop. Arrange the lines — <strong>and their indentation</strong> — to light pairs: <strong>1, 2, 4, 5, 7, 8</strong>.</p>',
        solution: 'for group in range(3):\n    forward()\n    for k in range(2):\n        forward()\n        light()',
        world: { glows: R.blank(9) },
        goal: { type: 'lit', target: () => [1, 2, 4, 5, 7, 8] },
        hints: ['Each group is: skip one lantern, then light two.', 'The inner loop (range(2)) lights two lanterns. It goes inside the outer loop.']
      },
      {
        id: 'c2-7', type: 'write', title: 'The Changing River', concept: 'loop',
        api: ['forward', 'light', 'size'],
        brief: '<p>Every night the river is a different length, and your spell is tested on <strong>several rivers you can\'t see</strong>. <code>size()</code> tells you how many lanterns there are tonight.</p><p>Light <strong>every</strong> lantern.</p>',
        code: '',
        solution: 'for i in range(size()):\n    forward()\n    light()',
        gen: (r, k) => ({ glows: R.blank(k === 1 ? 1 : R.int(r, 4, 14)) }),
        tests: 6,
        goal: { type: 'lit', target: (c) => range(c.glows.length) },
        par: { lines: 3 },
        hints: ['Typing a number into range() works for one river but not the others.', 'Put size() inside range().']
      }
    ]
  });

  /* III — Reading the Glow */
  chapter({
    id: 'c3', num: 3, title: 'Reading the Glow', concept: 'cond',
    story: 'These lanterns carry a glow number painted on the paper. A good keeper reads before acting.',
    world: { showGlow: true },
    levels: [
      {
        id: 'c3-1', type: 'predict', title: 'Bright Ones', concept: 'cond', intro: true,
        api: ['forward', 'light', 'size', 'glow'],
        brief: '<p><code>glow()</code> reads the number on the lantern beside the boat. <code>if</code> asks a True/False question and only runs its indented lines when the answer is True.</p><p>Tap the lanterns that will be lit.</p>',
        code: 'for i in range(size()):\n    forward()\n    if glow() > 5:\n        light()',
        world: { glows: [3, 8, 6, 1, 9, 5] },
        predict: { mode: 'lit' },
        explain: {
          q: 'Why didn\'t the lantern with glow 5 light up?',
          options: ['5 > 5 is False — 5 is not bigger than 5', 'The loop ended before the last lantern', 'Only even positions light up'],
          correct: 0,
          why: '> means "strictly bigger than". To include 5 you would write glow() >= 5.'
        }
      },
      {
        id: 'c3-2', type: 'write', title: 'Seven and Up', concept: 'cond',
        api: ['forward', 'light', 'size', 'glow'],
        brief: '<p>Light every lantern with a glow of <strong>7 or more</strong>. Your spell is tested on other rivers too.</p><p><code>&gt;=</code> means "bigger than or equal to".</p>',
        code: 'for i in range(size()):\n    forward()\n',
        solution: 'for i in range(size()):\n    forward()\n    if glow() >= 7:\n        light()',
        gen: (r) => { const g = R.glows(r, R.int(r, 6, 12), 1, 9); g[0] = R.int(r, 7, 9); g[g.length - 1] = R.int(r, 1, 6); return { glows: R.shuffle(r, g) }; },
        tests: 6,
        goal: { type: 'lit', target: where(g => g >= 7) },
        par: { lines: 4 },
        hints: ['Inside the loop, after forward(), ask a question about glow().', 'if glow() >= 7:\n    light()   ← indented under the if']
      },
      {
        id: 'c3-3', type: 'fill', title: 'Even Glows', concept: 'cond',
        api: ['forward', 'light', 'size', 'glow'],
        brief: '<p><code>%</code> gives the remainder after dividing. <code>7 % 2</code> is 1, <code>8 % 2</code> is 0. Even numbers leave no remainder.</p><p>Light the lanterns with an <strong>even</strong> glow.</p>',
        code: 'for i in range(size()):\n    forward()\n    if glow() % 2 == ___:\n        light()',
        solution: 'for i in range(size()):\n    forward()\n    if glow() % 2 == 0:\n        light()',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 6, 12), 1, 9) }),
        tests: 5,
        goal: { type: 'lit', target: where(g => g % 2 === 0) },
        hints: ['What is the remainder when you divide an even number by 2?']
      },
      {
        id: 'c3-4', type: 'debug', title: 'The Lonely If', concept: 'cond',
        api: ['forward', 'light', 'size', 'glow'],
        brief: '<p>This spell should light every lantern with glow <strong>less than 4</strong>, but it only ever checks one lantern. Fix it.</p>',
        code: 'for i in range(size()):\n    forward()\nif glow() < 4:\n    light()',
        solution: 'for i in range(size()):\n    forward()\n    if glow() < 4:\n        light()',
        gen: (r) => { const g = R.glows(r, R.int(r, 6, 11), 1, 9); g[0] = R.int(r, 1, 3); g[1] = R.int(r, 1, 3); g[g.length - 1] = R.int(r, 5, 9); return { glows: g }; },
        tests: 5,
        goal: { type: 'lit', target: where(g => g < 4) },
        hints: ['Step through it. When does the if line run — once per lantern, or once at the end?', 'The if and its light() need to be inside the loop: push them right by 4 spaces.']
      },
      {
        id: 'c3-5', type: 'write', title: 'Just Right', concept: 'cond',
        api: ['forward', 'light', 'size', 'glow'],
        brief: '<p>Light lanterns whose glow is <strong>between 3 and 6</strong>, including 3 and 6.</p><p>You can join questions with <code>and</code>: <code>if a &gt; 1 and a &lt; 9:</code>. Python also lets you write <code>1 &lt; a &lt; 9</code>.</p>',
        code: 'for i in range(size()):\n    forward()\n',
        solution: 'for i in range(size()):\n    forward()\n    if 3 <= glow() <= 6:\n        light()',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 7, 12), 1, 9) }),
        tests: 6,
        goal: { type: 'lit', target: where(g => g >= 3 && g <= 6) },
        par: { ops: { peeks: (c) => c.glows.length }, label: 'Read each glow only once' },
        hints: ['Two conditions must both be True: at least 3, and at most 6.', 'if glow() >= 3 and glow() <= 6:  works. To read each glow once, try  3 <= glow() <= 6.']
      }
    ]
  });

  /* IV — Until the Bank */
  chapter({
    id: 'c4', num: 4, title: 'Until the Bank', concept: 'while',
    story: 'Mist hides the end of this stretch. You can\'t count the lanterns ahead of time. Ember must keep going until something tells it to stop.',
    world: { showGlow: true },
    levels: [
      {
        id: 'c4-1', type: 'predict', title: 'Until Seven', concept: 'while', intro: true,
        api: ['forward', 'light', 'glow', 'at_end'],
        brief: '<p><code>while</code> repeats its indented lines <strong>as long as</strong> its question is True. It checks the question again before every repeat.</p><p>Tap the lanterns that will be lit.</p>',
        code: 'forward()\nwhile glow() < 7:\n    forward()\nlight()',
        world: { glows: [2, 5, 4, 8, 3, 9] },
        predict: { mode: 'lit' },
        explain: {
          q: 'Why didn\'t the 9 at the end light up?',
          options: ['The loop stopped at the first glow of 7 or more', 'while loops skip the last lantern', 'light() only works once per river'],
          correct: 0,
          why: 'At lantern 3 the glow is 8, so  glow() < 7  is False and the loop ends. light() runs there, once.'
        }
      },
      {
        id: 'c4-2', type: 'write', title: 'Unknown Waters', concept: 'while',
        api: ['forward', 'light', 'at_end'],
        brief: '<p><code>size()</code> doesn\'t work in the mist. Use <code>at_end()</code>, which is True when the boat is at the last lantern, and <code>not</code>, which flips True and False.</p><p>Light <strong>every</strong> lantern.</p>',
        code: '',
        solution: 'while not at_end():\n    forward()\n    light()',
        gen: (r, k) => ({ glows: R.glows(r, k === 1 ? 1 : R.int(r, 3, 15), 1, 9) }),
        tests: 6,
        goal: { type: 'lit', target: (c) => range(c.glows.length) },
        par: { lines: 3 },
        hints: ['Keep going while you are NOT at the end.', 'while not at_end():\n    ...move, then light...']
      },
      {
        id: 'c4-3', type: 'write', title: 'First Nine', concept: 'while',
        api: ['forward', 'light', 'glow', 'at_end'],
        brief: '<p>Somewhere ahead is a lantern with glow <strong>9</strong>. Light the <strong>first</strong> one — and nothing else. <code>!=</code> means "is not equal to".</p>',
        code: 'forward()\n',
        solution: 'forward()\nwhile glow() != 9:\n    forward()\nlight()',
        gen: (r) => { const n = R.int(r, 5, 13); const g = R.glows(r, n, 1, 8); const p = R.int(r, 0, n - 1); g[p] = 9; if (p + 2 < n && r() < 0.5) g[R.int(r, p + 1, n - 1)] = 9; return { glows: g }; },
        tests: 6,
        goal: { type: 'lit', target: (c) => [c.glows.indexOf(9)] },
        par: { ops: { peeks: (c) => c.glows.indexOf(9) + 1 }, label: 'Read only up to the first 9' },
        hints: ['Keep moving while the glow is not 9.', 'forward()\nwhile glow() != 9:\n    forward()\n...then light it']
      },
      {
        id: 'c4-4', type: 'debug', title: 'Spinning in Circles', concept: 'while',
        api: ['forward', 'light', 'glow', 'at_end'],
        brief: '<p>This spell should light every lantern <strong>before</strong> the first 9 (not the 9 itself). Instead Ember spins in circles forever. Why?</p>',
        code: 'forward()\nwhile glow() != 9:\n    light()\nforward()',
        solution: 'forward()\nwhile glow() != 9:\n    light()\n    forward()',
        gen: (r) => { const n = R.int(r, 5, 12); const g = R.glows(r, n, 1, 8); g[R.int(r, 1, n - 1)] = 9; return { glows: g }; },
        tests: 5,
        goal: { type: 'lit', target: (c) => range(c.glows.indexOf(9)) },
        maxSteps: 5000,
        hints: ['Step through it. Does anything inside the loop change the answer to  glow() != 9 ?', 'The boat never moves inside the loop. Indent forward() so it runs every time around.']
      },
      {
        id: 'c4-5', type: 'write', title: 'Into the Dark', concept: 'while',
        api: ['forward', 'light', 'glow', 'at_end'],
        brief: '<p>Light lanterns one by one, but stop when you reach a <strong>dark lantern (glow 0)</strong> — don\'t light it or anything after it. Some rivers have no dark lantern at all.</p><p><code>break</code> jumps straight out of a loop.</p>',
        code: '',
        solution: 'while not at_end():\n    forward()\n    if glow() == 0:\n        break\n    light()',
        gen: (r, k) => { const n = R.int(r, 4, 13); const g = R.glows(r, n, 1, 9); if (k % 3 !== 0) g[R.int(r, 0, n - 1)] = 0; if (k === 1) g[0] = 0; return { glows: g }; },
        tests: 7,
        goal: { type: 'lit', target: (c) => { const z = c.glows.indexOf(0); return range(z < 0 ? c.glows.length : z); } },
        hints: ['Use the at_end() loop from Unknown Waters, and check the glow before lighting.', 'Inside the loop: move, then  if glow() == 0: break , then light().']
      }
    ]
  });

  /* V — The Keeper's Ledger */
  chapter({
    id: 'c5', num: 5, title: 'The Keeper\'s Ledger', concept: 'var',
    story: 'The keeper keeps a ledger of the night: how many, how bright, how long. Ember needs somewhere to remember things.',
    world: { showGlow: true },
    levels: [
      {
        id: 'c5-1', type: 'predict', title: 'Running Total', concept: 'var', intro: true,
        api: ['forward', 'glow', 'size', 'answer'],
        brief: '<p><code>total = 0</code> makes a variable — a named box — and puts 0 in it. <code>total = total + glow()</code> reads the box, adds, and stores the result back. <code>answer(x)</code> gives the keeper your result.</p><p>Watch the variables panel while it runs.</p>',
        code: 'total = 0\nfor i in range(size()):\n    forward()\n    total = total + glow()\nanswer(total)',
        world: { glows: [4, 2, 7, 1] },
        predict: { mode: 'choice', ask: 'answer', prompt: 'What will the answer be?', options: ['14', '7', '13', '4'] },
        explain: {
          q: 'What is in the total box just before the last lantern is added?',
          options: ['13', '1', '14'],
          correct: 0,
          why: '0 + 4 + 2 + 7 = 13. Then the last lantern adds 1 to make 14.'
        }
      },
      {
        id: 'c5-2', type: 'write', title: 'Counting Bright Ones', concept: 'var',
        api: ['forward', 'glow', 'size', 'answer'],
        brief: '<p>How many lanterns have a glow <strong>greater than 4</strong>? Count them and <code>answer</code> the number.</p><p><code>count += 1</code> is a short way to write <code>count = count + 1</code>.</p>',
        code: 'count = 0\n',
        solution: 'count = 0\nfor i in range(size()):\n    forward()\n    if glow() > 4:\n        count += 1\nanswer(count)',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 5, 13), 1, 9) }),
        tests: 6,
        goal: { type: 'answer', expect: (c) => c.glows.filter(g => g > 4).length },
        par: { lines: 6 },
        hints: ['Start with count = 0. Every time you find a bright lantern, add one.', 'answer(count) goes after the loop, not inside it — not indented.']
      },
      {
        id: 'c5-3', type: 'fill', title: 'The Brightest', concept: 'var', forbid: ['max'],
        api: ['forward', 'glow', 'size', 'answer'],
        brief: '<p>Find the <strong>highest glow</strong> on the river. <code>max()</code> is switched off — build it yourself: keep the best value so far, and replace it whenever you find something brighter.</p>',
        code: 'best = 0\nfor i in range(size()):\n    forward()\n    if glow() > ___:\n        best = ___\nanswer(best)',
        solution: 'best = 0\nfor i in range(size()):\n    forward()\n    if glow() > best:\n        best = glow()\nanswer(best)',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 5, 12), 1, 40) }),
        tests: 6,
        goal: { type: 'answer', expect: (c) => Math.max(...c.glows) },
        hints: ['Compare the glow with the best you have seen so far.', 'If it\'s bigger, the new best is the glow you just read.']
      },
      {
        id: 'c5-4', type: 'write', title: 'Where Is the Brightest?', concept: 'var', forbid: ['max'],
        api: ['forward', 'glow', 'size', 'answer'],
        brief: '<p>This time, answer the <strong>position</strong> of the brightest lantern, not its glow. There is only one brightest. The loop variable <code>i</code> tells you where the boat is.</p>',
        code: '',
        solution: 'best = -1\nbest_pos = 0\nfor i in range(size()):\n    forward()\n    g = glow()\n    if g > best:\n        best = g\n        best_pos = i\nanswer(best_pos)',
        gen: (r) => ({ glows: R.distinct(r, R.int(r, 5, 12), 1, 60) }),
        tests: 6,
        goal: { type: 'answer', expect: (c) => c.glows.indexOf(Math.max(...c.glows)) },
        par: { ops: { peeks: (c) => c.glows.length }, label: 'Read each glow only once' },
        hints: ['You need two boxes: the best glow so far, and where you saw it.', 'Store the glow in a variable (g = glow()) so you only read it once.', 'When g > best, update both best and best_pos = i.']
      },
      {
        id: 'c5-5', type: 'write', title: 'Rising Tide', concept: 'var',
        api: ['forward', 'glow', 'size', 'answer'],
        brief: '<p>Count how many times the glow <strong>goes up</strong> from one lantern to the next. In <code>3 5 4 6</code> it rises twice (3→5 and 4→6).</p><p>You\'ll need to remember the previous glow.</p>',
        code: '',
        solution: 'count = 0\nforward()\nprev = glow()\nfor i in range(size() - 1):\n    forward()\n    g = glow()\n    if g > prev:\n        count += 1\n    prev = g\nanswer(count)',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 5, 13), 1, 9) }),
        tests: 6,
        goal: { type: 'answer', expect: (c) => c.glows.filter((g, i) => i > 0 && g > c.glows[i - 1]).length },
        par: { ops: { peeks: (c) => c.glows.length }, label: 'Read each glow only once' },
        hints: ['Read the first lantern before the loop and keep it in a variable called prev.', 'Then loop over the remaining size() - 1 lanterns.', 'At the end of each loop, the current glow becomes the new prev.']
      },
      {
        id: 'c5-6', type: 'write', title: 'Longest Bright Streak', concept: 'var', challenge: true,
        api: ['forward', 'glow', 'size', 'answer'],
        brief: '<p>A bright lantern has glow <strong>5 or more</strong>. What is the longest run of bright lanterns <strong>in a row</strong>? In <code>6 7 2 9 9 8 1</code> the answer is 3.</p>',
        code: '',
        solution: 'best = 0\nrun = 0\nfor i in range(size()):\n    forward()\n    if glow() >= 5:\n        run += 1\n        if run > best:\n            best = run\n    else:\n        run = 0\nanswer(best)',
        gen: (r, k) => ({ glows: k === 1 ? R.glows(r, 6, 1, 4) : R.glows(r, R.int(r, 6, 15), 1, 9) }),
        tests: 7,
        goal: { type: 'answer', expect: (c) => { let b = 0, cur = 0; c.glows.forEach(g => { cur = g >= 5 ? cur + 1 : 0; b = Math.max(b, cur); }); return b; } },
        par: { ops: { peeks: (c) => c.glows.length }, label: 'Read each glow only once' },
        hints: ['Keep two numbers: the current streak, and the best streak so far.', 'A dark lantern resets the current streak to 0.', 'Every time the current streak grows, check whether it beats the best.']
      }
    ]
  });

  /* VI — Spells of Your Own */
  chapter({
    id: 'c6', num: 6, title: 'Spells of Your Own', concept: 'func',
    story: 'The keeper\'s oldest book is full of spells the keeper invented. Now you can write your own and give them names.',
    world: { showGlow: true },
    levels: [
      {
        id: 'c6-1', type: 'predict', title: 'The Hop Spell', concept: 'func', intro: true,
        api: ['forward', 'light'],
        brief: '<p><code>def hop(k):</code> creates a new spell called <code>hop</code> with one input, <code>k</code>. Nothing happens when it is defined — only when it is <strong>called</strong>, like <code>hop(2)</code>.</p><p>Tap the lanterns that will be lit.</p>',
        code: 'def hop(k):\n    for i in range(k):\n        forward()\n\nhop(2)\nlight()\nhop(3)\nlight()',
        world: { glows: [5, 2, 8, 1, 4, 9, 3] },
        predict: { mode: 'lit' },
        explain: {
          q: 'Inside the second call, hop(3), what is k?',
          options: ['3', '2', '5'],
          correct: 0,
          why: 'Each call gets its own k. hop(3) sets k to 3, so the boat moves three lanterns.'
        }
      },
      {
        id: 'c6-2', type: 'write', title: 'Growing Gaps', concept: 'func', require: ['def'],
        api: ['forward', 'light'],
        brief: '<p>Light lanterns <strong>0, 2, 5, 9 and 14</strong>. The gaps grow: 2, 3, 4, 5. Write a <code>hop(k)</code> spell and use it.</p>',
        code: 'def hop(k):\n    # move forward k times\n    pass\n',
        solution: 'def hop(k):\n    for i in range(k):\n        forward()\n\nhop(1)\nlight()\nfor g in range(2, 6):\n    hop(g)\n    light()',
        world: { glows: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9] },
        goal: { type: 'lit', target: () => [0, 2, 5, 9, 14] },
        par: { lines: 8 },
        hints: ['First finish hop: a for loop that runs forward() k times.', 'Reach lantern 0 with hop(1). Then the gaps 2, 3, 4, 5 are exactly range(2, 6).', 'for g in range(2, 6):\n    hop(g)\n    light()']
      },
      {
        id: 'c6-3', type: 'fill', title: 'Is It Bright?', concept: 'func',
        api: ['forward', 'light', 'glow', 'size'],
        brief: '<p><code>return</code> sends a value back from a function. <code>is_bright</code> should return True for a glow of <strong>6 or more</strong>.</p>',
        code: 'def is_bright(g):\n    return g >= ___\n\nfor i in range(size()):\n    forward()\n    if is_bright(glow()):\n        light()',
        solution: 'def is_bright(g):\n    return g >= 6\n\nfor i in range(size()):\n    forward()\n    if is_bright(glow()):\n        light()',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 6, 12), 1, 9) }),
        tests: 5,
        goal: { type: 'lit', target: where(g => g >= 6) },
        hints: ['g >= 6 is already a True/False value, so you can return it directly.']
      },
      {
        id: 'c6-4', type: 'parsons', title: 'Prime Lanterns', concept: 'func',
        api: ['forward', 'light', 'glow', 'size'],
        brief: '<p>A prime number can only be divided evenly by 1 and itself (2, 3, 5, 7, 11…). Assemble the <code>is_prime</code> spell and use it to light the prime lanterns.</p>',
        solution: 'def is_prime(x):\n    if x < 2:\n        return False\n    for d in range(2, x):\n        if x % d == 0:\n            return False\n    return True\n\nfor i in range(size()):\n    forward()\n    if is_prime(glow()):\n        light()',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 7, 12), 1, 30) }),
        tests: 5,
        goal: { type: 'lit', target: where(isPrime) },
        hints: ['return False as soon as you find a divisor. return True only after checking them all.', 'return True goes after the for loop, lined up with it — not inside it.']
      },
      {
        id: 'c6-5', type: 'write', title: 'Lucky Sevens', concept: 'func',
        api: ['forward', 'light', 'glow', 'size'],
        brief: '<p>Lanterns here have two-digit glows. Light the ones whose <strong>digits add up to 7</strong> (like 25 or 61).</p><p><code>//</code> divides and drops the remainder: <code>25 // 10</code> is 2. <code>25 % 10</code> is 5.</p>',
        code: 'def digit_sum(x):\n    return ___\n\n',
        solution: 'def digit_sum(x):\n    return x // 10 + x % 10\n\nfor i in range(size()):\n    forward()\n    if digit_sum(glow()) == 7:\n        light()',
        gen: (r) => { const g = R.glows(r, R.int(r, 6, 12), 10, 99); g[0] = R.pick(r, [16, 25, 34, 43, 52, 61, 70]); return { glows: R.shuffle(r, g) }; },
        tests: 6,
        goal: { type: 'lit', target: where(g => Math.floor(g / 10) + (g % 10) === 7) },
        hints: ['The tens digit is x // 10. The ones digit is x % 10.', 'Then loop over the river and light when digit_sum(glow()) == 7.']
      },
      {
        id: 'c6-6', type: 'write', title: 'Common Rhythm', concept: 'func', challenge: true,
        api: ['forward', 'glow', 'size', 'answer'],
        brief: '<p>All glows on this river share a rhythm. Answer the <strong>greatest common divisor</strong>: the biggest number that divides every glow evenly. For <code>12 18 30</code> that\'s 6.</p><p>Euclid found a trick 2,300 years ago: <code>gcd(a, b)</code> equals <code>gcd(b, a % b)</code>, and <code>gcd(a, 0)</code> is <code>a</code>.</p>',
        code: '',
        solution: 'def gcd(a, b):\n    while b != 0:\n        a, b = b, a % b\n    return a\n\ng = 0\nfor i in range(size()):\n    forward()\n    g = gcd(g, glow())\nanswer(g)',
        gen: (r) => { const base = R.int(r, 2, 9); const n = R.int(r, 4, 8); const m = R.glows(r, n, 1, 12); m[0] = 5; m[1] = 7; return { glows: R.shuffle(r, m.map(x => x * base)) }; },
        tests: 6,
        goal: { type: 'answer', expect: (c) => c.glows.reduce(gcd) },
        hints: ['Write gcd(a, b) as a function first. Keep replacing (a, b) with (b, a % b) until b is 0.', 'The gcd of the whole river: start with g = 0 and fold each glow in with g = gcd(g, glow()).', 'a, b = b, a % b  updates both at once.']
      }
    ]
  });

  /* VII — The Blink */
  chapter({
    id: 'c7', num: 7, title: 'The Blink', concept: 'list',
    story: 'Ember learns to blink: to jump to any lantern instantly by its number. Rowing is over. Now positions are everything.',
    world: { showGlow: true, blink: true },
    levels: [
      {
        id: 'c7-1', type: 'predict', title: 'Blink!', concept: 'list', intro: true,
        api: ['size', 'peek', 'light_at'],
        brief: '<p>New spells: <code>light_at(i)</code> blinks to lantern <code>i</code> and lights it. <code>peek(i)</code> reads lantern <code>i</code>. Positions start at 0, so the last lantern is <code>size() - 1</code>.</p>',
        code: 'n = size()\nlight_at(0)\nlight_at(n - 1)\nlight_at(n // 2)',
        world: { glows: [4, 7, 1, 9, 3, 8, 2, 6, 5] },
        predict: { mode: 'lit' },
        explain: {
          q: 'Why is the last lantern n - 1 and not n?',
          options: ['Counting starts at 0, so 9 lanterns are numbered 0 to 8', 'n is always one too big by mistake', 'light_at skips the last one'],
          correct: 0,
          why: 'With 9 lanterns the positions are 0–8. Position 9 would be off the end of the river.'
        }
      },
      {
        id: 'c7-2', type: 'write', title: 'Every Third', concept: 'list',
        api: ['size', 'peek', 'light_at'],
        brief: '<p>Light lanterns <strong>0, 3, 6, 9, …</strong> all the way along, on rivers of any length.</p>',
        code: '',
        solution: 'for i in range(0, size(), 3):\n    light_at(i)',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 4, 17), 1, 9) }),
        tests: 6,
        goal: { type: 'lit', target: (c) => range(c.glows.length).filter(i => i % 3 === 0) },
        par: { lines: 2 },
        hints: ['range can take a step: range(start, stop, step).', 'for i in range(0, size(), 3):']
      },
      {
        id: 'c7-3', type: 'write', title: 'Mirror the River', concept: 'list',
        api: ['size', 'peek', 'swap'],
        brief: '<p><code>swap(i, j)</code> makes lanterns <code>i</code> and <code>j</code> trade places. Reverse the whole river, so the last lantern is first and the first is last.</p>',
        code: '',
        solution: 'n = size()\nfor i in range(n // 2):\n    swap(i, n - 1 - i)',
        gen: (r) => ({ glows: R.distinct(r, R.int(r, 5, 12), 1, 40) }),
        tests: 6,
        goal: { type: 'order', expect: (c) => c.glows.slice().reverse() },
        par: { ops: { swaps: (c) => Math.floor(c.glows.length / 2) }, label: 'Use as few swaps as possible' },
        hints: ['Swap the first with the last, the second with the second-last, and so on.', 'Lantern i trades with lantern n - 1 - i.', 'Only go halfway — if you go all the way, you undo your work!']
      },
      {
        id: 'c7-4', type: 'fill', title: 'Second Brightest', concept: 'list',
        api: ['size', 'peek', 'answer'],
        brief: '<p>Lists hold many values: <code>vals = []</code> makes an empty one, <code>vals.append(x)</code> adds to the end. <code>sorted(vals)</code> gives a sorted copy, and <code>vals[-1]</code> is the last item.</p><p>Answer the <strong>second-highest</strong> glow.</p>',
        code: 'vals = []\nfor i in range(size()):\n    vals.append(peek(i))\nvals = sorted(vals)\nanswer(vals[___])',
        solution: 'vals = []\nfor i in range(size()):\n    vals.append(peek(i))\nvals = sorted(vals)\nanswer(vals[-2])',
        gen: (r) => ({ glows: R.distinct(r, R.int(r, 4, 11), 1, 60) }),
        tests: 6,
        goal: { type: 'answer', expect: (c) => c.glows.slice().sort((a, b) => a - b).slice(-2)[0] },
        hints: ['After sorting, the biggest is last: vals[-1]. What is one before that?']
      },
      {
        id: 'c7-5', type: 'write', title: 'Palindrome River', concept: 'list',
        api: ['size', 'peek', 'answer'],
        brief: '<p>A palindrome reads the same both ways, like <code>3 1 4 1 3</code>. Answer <code>True</code> if tonight\'s river is a palindrome, otherwise <code>False</code>.</p>',
        code: '',
        solution: 'n = size()\nsame = True\nfor i in range(n // 2):\n    if peek(i) != peek(n - 1 - i):\n        same = False\nanswer(same)',
        gen: (r, k) => {
          const n = R.int(r, 4, 11);
          const g = R.glows(r, n, 1, 9);
          if (k % 2 === 0) for (let i = 0; i < n / 2; i++) g[n - 1 - i] = g[i];
          if (k === 3) { for (let i = 0; i < n / 2; i++) g[n - 1 - i] = g[i]; g[0] = (g[0] % 9) + 1; }
          return { glows: g };
        },
        tests: 7,
        goal: { type: 'answer', expect: (c) => c.glows.every((g, i) => g === c.glows[c.glows.length - 1 - i]) },
        par: { ops: { peeks: (c) => c.glows.length }, label: 'Peek each lantern at most once' },
        hints: ['Compare position i with its mirror, n - 1 - i.', 'Start by believing it IS a palindrome (same = True), and change your mind if any pair differs.', 'You only need to check the first half.']
      },
      {
        id: 'c7-6', type: 'write', title: 'Sink the Dark Ones', concept: 'list', challenge: true,
        api: ['size', 'peek', 'swap'],
        brief: '<p>Move every dark lantern (glow <strong>0</strong>) to the right end of the river. The other lanterns must <strong>keep their order</strong>. <code>3 0 5 0 2</code> becomes <code>3 5 2 0 0</code>.</p><p>Try using two position variables at once.</p>',
        code: '',
        solution: 'w = 0\nfor r in range(size()):\n    if peek(r) != 0:\n        swap(w, r)\n        w += 1',
        gen: (r, k) => { const n = R.int(r, 6, 13); const g = R.glows(r, n, 1, 9); const z = k === 1 ? 0 : R.int(r, 1, Math.floor(n / 2)); for (let t = 0; t < z; t++) g[R.int(r, 0, n - 1)] = 0; return { glows: g }; },
        tests: 7,
        goal: { type: 'order', expect: (c) => c.glows.filter(g => g !== 0).concat(c.glows.filter(g => g === 0)) },
        limits: { swaps: (c) => c.glows.length },
        par: { ops: { peeks: (c) => c.glows.length }, label: 'Peek each lantern once' },
        hints: ['Use one variable w for "where the next bright lantern should go".', 'Walk r across the river. When peek(r) is not 0, swap it into position w and move w along.', 'swap(w, r) when w == r does nothing, and doesn\'t count.']
      }
    ]
  });

  /* VIII — Fog on the Water */
  chapter({
    id: 'c8', num: 8, title: 'Fog on the Water', concept: 'search',
    story: 'Thick fog. The numbers are hidden until Ember peeks — and the fog only lets Ember peek a few times. Every peek must count.',
    world: { showGlow: true, blink: true, fog: true },
    levels: [
      {
        id: 'c8-1', type: 'write', title: 'The Lost Lantern', concept: 'search', intro: true,
        api: ['size', 'peek', 'answer'],
        brief: '<p>The variable <code>target</code> holds a glow number. Somewhere in the fog is the lantern with that glow. <strong>Answer its position.</strong></p><p>The lanterns are in no particular order, so you may have to check them one by one. Stop as soon as you find it.</p>',
        code: '',
        solution: 'for i in range(size()):\n    if peek(i) == target:\n        answer(i)\n        break',
        gen: (r) => { const g = R.distinct(r, 12, 10, 99); return { glows: g, vars: { target: R.pick(r, g) } }; },
        tests: 6,
        goal: { type: 'answer', expect: (c) => c.glows.indexOf(c.vars.target) },
        limits: { peeks: 12 },
        par: { ops: { peeks: (c) => c.glows.indexOf(c.vars.target) + 1 }, label: 'Stop as soon as you find it' },
        hints: ['Peek each position in turn and compare with target.', 'When you find it, answer(i) and then break out of the loop.']
      },
      {
        id: 'c8-2', type: 'predict', title: 'The Guessing Game', concept: 'search',
        api: ['size', 'peek', 'answer'],
        brief: '<p>This river is <strong>sorted</strong>: glows grow from left to right. Binary search peeks at the middle. If the middle is too small, the target must be to the right, so the whole left half can be ignored. Watch <code>lo</code>, <code>mid</code> and <code>hi</code> under the lanterns.</p>',
        code: 'lo = 0\nhi = size() - 1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    g = peek(mid)\n    if g == target:\n        answer(mid)\n        break\n    elif g < target:\n        lo = mid + 1\n    else:\n        hi = mid - 1',
        world: { glows: [3, 8, 12, 17, 21, 26, 30, 35, 42, 47, 51, 56, 63, 70, 77], vars: { target: 42 } },
        predict: { mode: 'choice', ask: 'peeks', prompt: 'How many peeks will it take to find 42?', options: ['4', '2', '8', '15'] },
        explain: {
          q: 'After peeking position 7 (glow 35), why can positions 0–7 be ignored?',
          options: ['The river is sorted, so everything left of 35 is smaller than 42', 'Those lanterns were already lit', 'Binary search always skips the first half'],
          correct: 0,
          why: 'Sorting is what makes it work. 35 < 42, and everything to its left is even smaller, so the target can only be to the right.'
        }
      },
      {
        id: 'c8-3', type: 'fill', title: 'Halving the Fog', concept: 'search',
        api: ['size', 'peek', 'answer'],
        brief: '<p>31 sorted lanterns, but the fog allows only <strong>5 peeks</strong>. Complete the binary search.</p>',
        code: 'lo = 0\nhi = size() - 1\nwhile lo <= hi:\n    mid = (lo + hi) // ___\n    g = peek(mid)\n    if g == target:\n        answer(mid)\n        break\n    elif g < target:\n        lo = ___\n    else:\n        hi = ___',
        solution: 'lo = 0\nhi = size() - 1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    g = peek(mid)\n    if g == target:\n        answer(mid)\n        break\n    elif g < target:\n        lo = mid + 1\n    else:\n        hi = mid - 1',
        gen: (r) => { const g = R.sortedDistinct(r, 31, 1, 99); return { glows: g, vars: { target: R.pick(r, g) } }; },
        tests: 8,
        goal: { type: 'answer', expect: (c) => c.glows.indexOf(c.vars.target) },
        limits: { peeks: 5 },
        hints: ['The middle of lo and hi is their sum divided by 2.', 'If the middle glow is too small, the target is to the right of mid: the new lo is one past mid.', 'If it\'s too big, the new hi is one before mid.']
      },
      {
        id: 'c8-4', type: 'write', title: 'Where Would It Go?', concept: 'search',
        api: ['size', 'peek', 'answer'],
        brief: '<p>A new lantern with glow <code>target</code> is coming. It might not match any lantern on the river. Answer <strong>how many lanterns glow less than target</strong> — that\'s exactly the position where it would slot in.</p><p>31 sorted lanterns, <strong>5 peeks</strong>.</p>',
        code: '',
        solution: 'lo = 0\nhi = size()\nwhile lo < hi:\n    mid = (lo + hi) // 2\n    if peek(mid) < target:\n        lo = mid + 1\n    else:\n        hi = mid\nanswer(lo)',
        gen: (r, k) => {
          const g = R.sortedDistinct(r, 31, 5, 120);
          let t;
          if (k === 1) t = 1; else if (k === 2) t = 200; else if (k % 2 === 0) t = R.pick(r, g); else t = R.int(r, 6, 119);
          return { glows: g, vars: { target: t } };
        },
        tests: 8,
        goal: { type: 'answer', expect: (c) => c.glows.filter(g => g < c.vars.target).length },
        limits: { peeks: 5 },
        hints: ['Keep a window [lo, hi) where the answer must be. Start with lo = 0 and hi = size().', 'If peek(mid) < target, the answer is bigger than mid: lo = mid + 1. Otherwise the answer is mid or smaller: hi = mid.', 'Stop when lo == hi. That\'s your answer.']
      },
      {
        id: 'c8-5', type: 'write', title: 'The Crest', concept: 'search', challenge: true,
        api: ['size', 'peek', 'answer'],
        brief: '<p>This river rises, reaches a crest, then falls — like <code>2 5 9 14 11 6 3</code>. Answer the <strong>position of the crest</strong>. 31 lanterns, only <strong>10 peeks</strong>.</p><p>Comparing a lantern with its right-hand neighbour tells you whether you\'re still climbing.</p>',
        code: '',
        solution: 'lo = 0\nhi = size() - 1\nwhile lo < hi:\n    mid = (lo + hi) // 2\n    if peek(mid) < peek(mid + 1):\n        lo = mid + 1\n    else:\n        hi = mid\nanswer(lo)',
        gen: (r, k) => {
          const vals = R.distinct(r, 31, 1, 200).sort((a, b) => a - b);
          const crest = k === 1 ? 0 : k === 2 ? 30 : R.int(r, 1, 29);
          const top = vals.pop();
          const left = R.shuffle(r, vals).slice(0, crest).sort((a, b) => a - b);
          const right = vals.filter(v => left.indexOf(v) < 0).slice(0, 30 - crest).sort((a, b) => b - a);
          return { glows: left.concat([top], right) };
        },
        tests: 8,
        goal: { type: 'answer', expect: (c) => c.glows.indexOf(Math.max(...c.glows)) },
        limits: { peeks: 10 },
        hints: ['If peek(mid) < peek(mid + 1) you are still climbing, so the crest is to the right of mid.', 'Otherwise the crest is at mid or to its left.', 'Same shape as Where Would It Go?: shrink [lo, hi] until lo == hi.']
      }
    ]
  });

  /* IX — Order from Chaos */
  chapter({
    id: 'c9', num: 9, title: 'Order from Chaos', concept: 'sort',
    story: 'A storm has jumbled the festival lanterns. They must float in order, dimmest to brightest — and every swap costs effort.',
    world: { showGlow: true, blink: true },
    levels: [
      {
        id: 'c9-1', type: 'predict', title: 'One Pass', concept: 'sort', intro: true,
        api: ['size', 'peek', 'swap'],
        brief: '<p>This spell walks along the river once. Whenever a lantern is brighter than its right-hand neighbour, they swap. Watch the brightest lantern travel.</p>',
        code: 'n = size()\nfor j in range(n - 1):\n    if peek(j) > peek(j + 1):\n        swap(j, j + 1)',
        world: { glows: [5, 1, 4, 2, 8, 3] },
        predict: { mode: 'choice', ask: 'glows', prompt: 'What order will the lanterns be in afterwards?', options: ['1 4 2 5 3 8', '1 2 3 4 5 8', '5 1 4 2 3 8', '1 4 5 2 8 3'] },
        explain: {
          q: 'After one pass, what can you be sure of?',
          options: ['The brightest lantern is at the far right', 'Everything is sorted', 'The dimmest lantern is at the far left'],
          correct: 0,
          why: 'The biggest value wins every comparison it is part of, so it bubbles all the way to the end. That\'s why this is called bubble sort.'
        }
      },
      {
        id: 'c9-2', type: 'parsons', title: 'Bubble Sort', concept: 'sort',
        api: ['size', 'peek', 'swap'],
        brief: '<p>Repeat the pass enough times and the whole river is sorted. Assemble bubble sort. Each pass can stop a little earlier, because the end is already sorted.</p>',
        solution: 'n = size()\nfor i in range(n - 1):\n    for j in range(n - 1 - i):\n        if peek(j) > peek(j + 1):\n            swap(j, j + 1)',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 6, 9), 1, 30) }),
        tests: 5,
        goal: { type: 'order', expect: (c) => c.glows.slice().sort((a, b) => a - b) },
        hints: ['The outer loop counts passes. The inner loop walks along the river.', 'The swap only happens inside the if.']
      },
      {
        id: 'c9-3', type: 'write', title: 'Few Swaps', concept: 'sort',
        api: ['size', 'peek', 'swap'],
        brief: '<p>Sort 8 lanterns, dimmest first — but the lanterns are heavy: <strong>at most 7 swaps</strong>. Bubble sort uses too many.</p><p>Idea: find the dimmest lantern and swap it into place 0. Then find the dimmest of the rest for place 1…</p>',
        code: '',
        solution: 'n = size()\nfor i in range(n - 1):\n    best = i\n    for j in range(i + 1, n):\n        if peek(j) < peek(best):\n            best = j\n    swap(i, best)',
        gen: (r) => ({ glows: R.distinct(r, 8, 1, 50) }),
        tests: 7,
        goal: { type: 'order', expect: (c) => c.glows.slice().sort((a, b) => a - b) },
        limits: { swaps: 7 },
        hints: ['For each position i, find where the smallest remaining lantern is. Remember its position, don\'t swap yet.', 'Only after the inner loop: swap(i, best). That\'s one swap per position at most.', 'This is called selection sort.']
      },
      {
        id: 'c9-4', type: 'write', title: 'Neighbours Only', concept: 'sort',
        api: ['size', 'peek', 'swap'],
        brief: '<p>This river is narrow: only <strong>neighbouring</strong> lanterns can swap. The lanterns are already <em>nearly</em> sorted. Sort them, and for the efficiency star don\'t waste peeks on parts that are already in order.</p>',
        code: '',
        solution: 'n = size()\nfor i in range(1, n):\n    j = i\n    while j > 0 and peek(j - 1) > peek(j):\n        swap(j - 1, j)\n        j -= 1',
        gen: (r) => {
          const n = R.int(r, 9, 13);
          const g = R.sortedDistinct(r, n, 1, 60);
          for (let t = 0; t < 2; t++) { const a = R.int(r, 0, n - 2); const s = g[a]; g[a] = g[a + 1]; g[a + 1] = s; }
          const from = R.int(r, 0, n - 1), to = R.int(r, 0, n - 1);
          const v = g.splice(from, 1)[0]; g.splice(to, 0, v);
          return { glows: g, adjacentOnly: true };
        },
        tests: 6,
        goal: { type: 'order', expect: (c) => c.glows.slice().sort((a, b) => a - b) },
        par: { ops: { peeks: (c) => 2 * (inversions(c.glows) + c.glows.length - 1) }, label: 'Stop early when a lantern is in place' },
        hints: ['Take each lantern in turn and slide it left until the lantern to its left is smaller.', 'while j > 0 and peek(j - 1) > peek(j):  then swap and move j left.', 'This is insertion sort. On nearly sorted rivers it hardly does any work.']
      },
      {
        id: 'c9-5', type: 'write', title: 'Three Colours', concept: 'sort', challenge: true,
        api: ['size', 'peek', 'swap'],
        brief: '<p>Every lantern glows 1, 2 or 3. Sort them — but you may peek each lantern <strong>only once</strong> (<code>size()</code> peeks in total).</p><p>Hint from a famous computer scientist (Dijkstra): keep three regions. Ones at the left, threes at the right, and a growing middle.</p>',
        code: '',
        solution: 'lo = 0\nmid = 0\nhi = size() - 1\nwhile mid <= hi:\n    g = peek(mid)\n    if g == 1:\n        swap(lo, mid)\n        lo += 1\n        mid += 1\n    elif g == 2:\n        mid += 1\n    else:\n        swap(mid, hi)\n        hi -= 1',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 9, 15), 1, 3) }),
        tests: 7,
        goal: { type: 'order', expect: (c) => c.glows.slice().sort((a, b) => a - b) },
        limits: { peeks: (c) => c.glows.length },
        hints: ['Use three positions: lo (next spot for a 1), mid (lantern you\'re looking at), hi (next spot for a 3).', 'A 1 swaps to lo. A 3 swaps to hi — but then don\'t move mid, because a new unknown lantern just arrived there.', 'Loop while mid <= hi.']
      },
      {
        id: 'c9-6', type: 'write', title: 'Blind Sort', concept: 'sort', challenge: true, optional: true,
        api: ['size', 'less', 'swap'],
        brief: '<p><strong>Grandmaster trial.</strong> 16 lanterns in total fog. You can\'t peek at all. <code>less(i, j)</code> tells you whether lantern i is dimmer than lantern j, and you get only <strong>64 comparisons</strong>.</p><p>Simple sorts need around 120. You\'ll need to combine two ideas from this river.</p>',
        code: '',
        solution: 'n = size()\nfor i in range(1, n):\n    lo = 0\n    hi = i\n    while lo < hi:\n        mid = (lo + hi) // 2\n        if less(i, mid):\n            hi = mid\n        else:\n            lo = mid + 1\n    j = i\n    while j > lo:\n        swap(j - 1, j)\n        j -= 1',
        gen: (r) => ({ glows: R.distinct(r, 16, 1, 99), fog: true }),
        tests: 6,
        goal: { type: 'order', expect: (c) => c.glows.slice().sort((a, b) => a - b) },
        limits: { compares: 64 },
        hints: ['Insertion sort keeps the left part sorted. To find where the next lantern belongs in that sorted part, you don\'t need to check every spot…', '…binary search the sorted part with less(i, mid). Swaps are free here.', 'Binary-search for the slot lo, then slide lantern i left until it reaches lo.']
      }
    ]
  });

  /* X — Echoes */
  chapter({
    id: 'c10', num: 10, title: 'Echoes', concept: 'recur',
    story: 'At the river\'s mouth, voices echo off the cliffs and come back changed. A spell can call itself.',
    world: { showGlow: true, blink: true },
    levels: [
      {
        id: 'c10-1', type: 'predict', title: 'The Echo', concept: 'recur', intro: true,
        api: [],
        brief: '<p><code>echo</code> calls itself with a smaller number. Each call waits for the one inside it to finish before it carries on. <code>k == 0</code> is the <strong>base case</strong> that stops the echo.</p>',
        code: 'def echo(k):\n    if k == 0:\n        return\n    print(k)\n    echo(k - 1)\n    print(k)\n\necho(3)',
        world: { glows: R.blank(4) },
        predict: { mode: 'choice', ask: 'output', prompt: 'What will be printed (in order)?', options: ['3 2 1 1 2 3', '3 2 1', '1 2 3 3 2 1', '3 2 1 0 0 1 2 3'] },
        explain: {
          q: 'Why do the numbers come back in reverse?',
          options: ['Each call prints again after the call inside it finishes', 'print reverses numbers the second time', 'Python runs the program twice'],
          correct: 0,
          why: 'echo(3) prints 3, then waits for echo(2) to finish completely. Only then does it print 3 again, so the second prints happen innermost-first.'
        }
      },
      {
        id: 'c10-2', type: 'write', title: 'Leapfrog', concept: 'recur', require: ['recursion'],
        api: ['size', 'light_at'],
        brief: '<p>Write <code>leap(i)</code>: light lantern i, then leap two ahead by <strong>calling itself</strong>. Stop when you\'d land past the end. Start it with <code>leap(0)</code>. No loops needed!</p>',
        code: 'def leap(i):\n    \n\nleap(0)',
        solution: 'def leap(i):\n    if i >= size():\n        return\n    light_at(i)\n    leap(i + 2)\n\nleap(0)',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 3, 15), 1, 9) }),
        tests: 6,
        goal: { type: 'lit', target: (c) => range(c.glows.length).filter(i => i % 2 === 0) },
        hints: ['First the base case: if i is past the last lantern, return.', 'Otherwise light_at(i), then call leap(i + 2).']
      },
      {
        id: 'c10-3', type: 'fill', title: 'Total Echo', concept: 'recur',
        api: ['size', 'peek', 'answer'],
        brief: '<p>The total of the river from position <code>i</code> onwards is: lantern i, plus the total from <code>i + 1</code> onwards. Past the end, the total is nothing. Fill in the blanks.</p>',
        code: 'def total(i):\n    if i == size():\n        return ___\n    return peek(i) + total(___)\n\nanswer(total(0))',
        solution: 'def total(i):\n    if i == size():\n        return 0\n    return peek(i) + total(i + 1)\n\nanswer(total(0))',
        gen: (r) => ({ glows: R.glows(r, R.int(r, 4, 12), 1, 20) }),
        tests: 6,
        goal: { type: 'answer', expect: (c) => c.glows.reduce((a, b) => a + b, 0) },
        hints: ['When there are no lanterns left, what do they add up to?', 'The smaller problem starts one lantern further along.']
      },
      {
        id: 'c10-4', type: 'debug', title: 'The Frozen Tide', concept: 'dp',
        api: ['size', 'peek', 'answer'],
        brief: '<p>Tide numbers: each is the sum of the two before it — 0, 1, 1, 2, 3, 5, 8, 13… The old keeper\'s spell is correct, but it is so slow the river freezes before it finishes. Lantern 0 says which tide number to find.</p><p>Make it fast. Why is it slow? Count how often <code>tide(5)</code> gets worked out.</p>',
        code: 'def tide(k):\n    if k < 2:\n        return k\n    return tide(k - 1) + tide(k - 2)\n\nanswer(tide(peek(0)))',
        solution: 'memo = [-1] * 100\n\ndef tide(k):\n    if k < 2:\n        return k\n    if memo[k] != -1:\n        return memo[k]\n    memo[k] = tide(k - 1) + tide(k - 2)\n    return memo[k]\n\nanswer(tide(peek(0)))',
        gen: (r) => { const g = R.glows(r, 6, 1, 9); g[0] = R.int(r, 20, 30); return { glows: g }; },
        tests: 5,
        goal: { type: 'answer', expect: (c) => { let a = 0, b = 1; for (let i = 0; i < c.glows[0]; i++) { const t = a + b; a = b; b = t; } return a; } },
        hints: ['tide(k - 1) already works out tide(k - 2) inside it — and then it gets worked out all over again.', 'Keep a list memo = [-1] * 100. Before working something out, check whether memo[k] already has it.', 'Or skip recursion: walk forward from 0 and 1 with a loop, keeping the last two numbers.']
      },
      {
        id: 'c10-5', type: 'write', title: 'Stepping Stones', concept: 'dp', challenge: true,
        api: ['size', 'peek', 'answer'],
        brief: '<p>Ember hops from lantern 0 to the last lantern, jumping <strong>1 or 2</strong> lanterns at a time. Lanterns with glow 0 are rocks — Ember can\'t land there. <strong>How many different routes are there?</strong></p><p>Peek each lantern only once. The number of ways to reach lantern i depends on the ways to reach i − 1 and i − 2.</p>',
        code: '',
        solution: 'n = size()\nways = [0] * n\nways[0] = 1\nfor i in range(1, n):\n    if peek(i) != 0:\n        ways[i] = ways[i - 1]\n        if i >= 2:\n            ways[i] += ways[i - 2]\nanswer(ways[n - 1])',
        gen: (r) => { const n = R.int(r, 8, 18); const g = R.glows(r, n, 1, 9).map(v => (r() < 0.22 ? 0 : v)); g[0] = R.int(r, 1, 9); g[n - 1] = R.int(r, 1, 9); return { glows: g }; },
        tests: 7,
        goal: {
          type: 'answer', expect: (c) => {
            const n = c.glows.length, w = new Array(n).fill(0); w[0] = 1;
            for (let i = 1; i < n; i++) if (c.glows[i] !== 0) w[i] = w[i - 1] + (i >= 2 ? w[i - 2] : 0);
            return w[n - 1];
          }
        },
        limits: { peeks: (c) => c.glows.length },
        hints: ['Make a list ways with one slot per lantern. There is exactly 1 way to be at lantern 0.', 'A rock has 0 ways. Any other lantern: ways[i - 1] + ways[i - 2].', 'Fill the list from left to right, then answer the last slot.']
      },
      {
        id: 'c10-6', type: 'write', title: 'Lantern Sums', concept: 'recur', challenge: true, optional: true,
        api: ['size', 'peek', 'answer'],
        brief: '<p><strong>Grandmaster trial.</strong> In how many ways can you choose some of the lanterns so their glows add up to exactly <code>target</code>? Lanterns with equal glows still count as different lanterns.</p><p>For every lantern there are two futures: take it, or leave it. Recursion can explore both.</p>',
        code: '',
        solution: 'vals = []\nfor i in range(size()):\n    vals.append(peek(i))\n\ndef count(i, left):\n    if i == len(vals):\n        if left == 0:\n            return 1\n        return 0\n    return count(i + 1, left - vals[i]) + count(i + 1, left)\n\nanswer(count(0, target))',
        gen: (r) => { const n = R.int(r, 7, 10); const g = R.glows(r, n, 1, 9); let t = 0; g.forEach(v => { if (r() < 0.45) t += v; }); if (t === 0) t = g[0]; return { glows: g, vars: { target: t } }; },
        tests: 6,
        maxSteps: 60000,
        goal: {
          type: 'answer', expect: (c) => {
            const g = c.glows, t = c.vars.target;
            const f = (i, left) => (i === g.length ? (left === 0 ? 1 : 0) : f(i + 1, left - g[i]) + f(i + 1, left));
            return f(0, t);
          }
        },
        hints: ['Read all the glows into a list first.', 'count(i, left) = the number of ways using lanterns i onwards to make exactly left.', 'At the end of the list, there is 1 way if left is 0, otherwise 0. Otherwise add: take lantern i, plus skip lantern i.']
      }
    ]
  });

  /* ---------- index ---------- */
  const LEVELS = [];
  const BY_ID = {};
  CHAPTERS.forEach((ch, ci) => {
    ch.levels.forEach((lv, li) => {
      lv.chapter = ch;
      lv.ci = ci;
      lv.li = li;
      lv.world = lv.world ? Object.assign({}, lv.world) : null;
      lv.view = Object.assign({}, ch.world || {}, lv.viewOverride || {});
      if (lv.seed == null) lv.seed = 1000 + ci * 97 + li * 13;
      LEVELS.push(lv);
      BY_ID[lv.id] = lv;
    });
  });

  WYK.Content = { CONCEPTS, CHAPTERS, LEVELS, BY_ID, R, range, inversions };
})(typeof window !== 'undefined' ? window : globalThis);
