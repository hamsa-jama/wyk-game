# WYK

**Play it:** https://hamsa-jama.github.io/wyk-game/

**Light the river with code.** WYK (pronounced *wick*, like the wick of a lantern) is a 2D browser game that teaches real Python and algorithmic thinking to learners aged roughly 10 to 16.

Every night a village floats paper lanterns downstream. You are the new lantern keeper, but you can't row the boat yourself: you write *keeper's script* for Ember, a firefly in a paper boat who does exactly what you write. Across ten stretches of river the script grows from `forward()` and `light()` to loops, decisions, variables, functions, lists, binary search, sorting, recursion and dynamic programming.

- 57 puzzles in 10 chapters, plus an open sandbox
- Everything you type is real Python syntax, so the skills carry over
- Solutions are tested on several randomly generated rivers, so hard-coding never works
- A memory system (FSRS-4.5) brings ideas back for review just as they start to fade
- Progress saves automatically in the browser, with a save code to move between devices
- No build step, no dependencies, no tracking, no accounts

## Deploy to GitHub Pages

1. Create a new repository on GitHub (this one is `wyk-game`).
2. Upload everything in this folder to the repository root — `index.html` must be at the top level. From a terminal:
   ```bash
   git init
   git add .
   git commit -m "WYK"
   git branch -M main
   git remote add origin https://github.com/<your-username>/wyk-game.git
   git push -u origin main
   ```
   Or use **Add file → Upload files** on GitHub and drag the folder contents in.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick **main** and **/ (root)**, then **Save**.
5. After a minute the game is live at `https://<your-username>.github.io/wyk-game/`.

The `.nojekyll` file tells GitHub Pages to serve the files as they are.

## Run it locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

`dist/wyk-standalone.html` is the whole game in one file, handy for offline machines. Rebuild it after changes with `node tools/build-single.js`.

## Test every level

```bash
node test/run-tests.js
```

The test harness proves, for every level, that the reference solution passes the visible river and 40 random ones and earns all three stars; that every "fix the bug" level really is broken; that every fill-in level has blanks; that every multiple-choice prediction has exactly one correct option; and that the review-card generators always produce valid questions. A GitHub Actions workflow (`.github/workflows/test.yml`) runs it on every push.

## How it teaches

Each design choice comes from research on learning in general and on learning to program specifically.

| Technique | Where it shows up in WYK |
|---|---|
| **PRIMM** (Predict, Run, Investigate, Modify, Make) | Each chapter opens by reading code and predicting what it will do before running it, then modifying and finally writing from scratch. |
| **Confidence ratings and the hypercorrection effect** | Learners say how sure they are before checking. Confident mistakes are pointed out, because errors made with high confidence are corrected and remembered especially well. |
| **Worked examples with fading** | New ideas arrive as annotated examples, then fill-the-gap code, then puzzles, then blank editors. Support fades as skill grows. |
| **Parsons problems** | Mixed-up-line puzzles reach the same learning gains as writing code in less time. After three failed runs a writing task can turn into a puzzle of its own solution (adaptive scaffolding). No distractor lines, since those raise load for young novices without improving transfer. |
| **Expertise reversal** | Experienced players can skip predict levels; examples that help novices can slow experts down. |
| **Tracing and a visible notional machine** | *Step* runs one line at a time. Ember's memory shows every variable as it changes, and position variables (`i`, `lo`, `mid`, `hi`…) appear as arrows under the lanterns. Review answers can be traced line by line in a table. |
| **Generalisation through random tests** | Solutions must work on several unseen rivers, which pushes learners from one-off answers to real algorithms. |
| **Self-explanation prompts** | After a prediction, a short "why?" question asks the learner to explain what happened. |
| **Spaced retrieval practice** | Every concept becomes an "ember" scheduled with FSRS-4.5. It returns for recall just as predicted memory drops to 90%. |
| **Interleaving and variable practice** | Reviews mix concepts and generate a fresh question each time, with distractors built from known misconceptions (off-by-one ranges, assignment-as-copy, missing `return`…). Answers are computed by running the code. |
| **Productive struggle and desirable difficulty** | Hints are graduated and unlock after a first attempt. Feedback treats bugs as clues and praises strategy and effort, not talent. |
| **Goal setting and mastery** | Star criteria are shown before starting. Chapters unlock through mastery; efficiency and line-count stars stretch older players. |
| **Low floor, high ceiling** | A ten-year-old lights the first lanterns in minutes; later stretches ask for binary search, selection and insertion sort, Dijkstra's three-way partition, Euclid's algorithm, memoisation and subset counting, with two optional grandmaster trials. |

### Sources

- Sentance, S., Waite, J., & Kallia, M. (2019). Teaching computer programming with PRIMM: a sociocultural perspective. *Computer Science Education*, 29(2–3).
- Lee, I. et al. (2011). Computational thinking for youth in practice (Use–Modify–Create). *ACM Inroads*, 2(1).
- Ericson, B. (2018). *Evaluating the effectiveness and efficiency of Parsons problems and dynamically adaptive Parsons problems.* PhD thesis, Georgia Tech.
- *Understanding the effects of using Parsons problems to scaffold code writing for students with varying CS self-efficacy levels.* Koli Calling (NSF PAR record 10510497).
- *Scaffolding novices: analyzing when and how Parsons problems impact novice programming in an integrated science assignment.* ICER 2024.
- Harms, K. J., Chen, J., & Kelleher, C. (2016). Distractors in Parsons problems decrease learning efficiency for young novice programmers. *ICER*.
- Lister, R. et al. (2004). A multi-national study of reading and tracing skills in novice programmers. *ITiCSE Working Group Reports*.
- Sorva, J. (2013). Notional machines and introductory programming education. *ACM TOCE*, 13(2).
- Renkl, A., & Atkinson, R. K. (2003). Structuring the transition from example study to problem solving. *Educational Psychologist*, 38(1).
- Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J. (2003). The expertise reversal effect. *Educational Psychologist*, 38(1).
- Chi, M. T. H. et al. (1994). Eliciting self-explanations improves understanding. *Cognitive Science*, 18(3).
- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning. *Psychological Science*, 17(3).
- Cepeda, N. J. et al. (2006). Distributed practice in verbal recall tasks: a review and quantitative synthesis. *Psychological Bulletin*, 132(3).
- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science*, 35.
- Butterfield, B., & Metcalfe, J. (2001). Errors committed with high confidence are hypercorrected. *JEP: Learning, Memory, and Cognition*, 27(6).
- Bjork, R. A. (1994). Memory and metamemory considerations in the training of human beings (desirable difficulties).
- Kapur, M. (2008). Productive failure. *Cognition and Instruction*, 26(3).
- Mueller, C. M., & Dweck, C. S. (1998). Praise for intelligence can undermine children's motivation and performance. *JPSP*, 75(1).
- Ye, J., Su, J., & Cao, Y. (2022). A stochastic shortest path algorithm for optimizing spaced repetition scheduling. *KDD*. (Origin of FSRS; WYK uses the FSRS-4.5 equations and default weights. Newer versions such as FSRS-6 and FSRS-7 exist and could be dropped into `js/srs.js`.)

## Project layout

```
index.html          the page (GitHub Pages serves this)
css/style.css       all styling
js/lang.js          the Python-subset interpreter: tokenizer, parser, step-by-step evaluator, friendly errors
js/world.js         the river model, keeper spells, and the canvas renderer
js/levels.js        concepts, chapters and all 57 levels (each with a reference solution)
js/engine.js        rules shared by the game and tests: building rivers, judging runs, stars
js/srs.js           FSRS-4.5 scheduler and the review-card generators
js/app.js           screens, editor, Parsons puzzles, predictions, hints, review, saving
test/run-tests.js   proves every level and card generator is correct
tools/build-single.js  builds the one-file version in dist/
```

## Adding a level

Add an object to a chapter's `levels` array in `js/levels.js`. The essentials:

```js
{
  id: 'c3-6', type: 'write', title: 'Edges of the Night', concept: 'cond',
  api: ['forward', 'light', 'size', 'glow'],          // spells this level allows
  brief: '<p>Light the lanterns whose glow is 1 or 9.</p>',
  code: '',                                           // starter code
  solution: 'for i in range(size()):\n    forward()\n    if glow() == 1 or glow() == 9:\n        light()',
  gen: (r) => ({ glows: R.glows(r, R.int(r, 6, 12), 1, 9) }),   // random rivers
  tests: 6,                                           // hidden rivers on top of the visible one
  goal: { type: 'lit', target: where(g => g === 1 || g === 9) },
  hints: ['Two questions joined with or.']
}
```

Types are `predict`, `write`, `fill`, `parsons` and `debug`. Goals are `lit` (exact set of lit lanterns), `answer` (value passed to `answer()`), or `order` (final order of glows). Optional fields include `limits` (hard caps on moves, peeks, swaps or comparisons), `par` (targets for the efficiency and line-count stars), `require: ['def' | 'recursion']`, `forbid: ['max']`, and `maxSteps`. Run `node test/run-tests.js` afterwards.

## Privacy

WYK stores progress only in the browser's local storage on the player's device. It sends nothing anywhere. The only external request is for the Google Fonts stylesheet; without it the game falls back to system fonts.

## Licence

MIT — see `LICENSE`.
