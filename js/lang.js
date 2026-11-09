/* WYK — Keeper's Script
 * A friendly, step-able interpreter for a subset of Python.
 * Every statement yields an event so the game can animate, pause and trace it.
 */
(function (root) {
  'use strict';
  const WYK = root.WYK = root.WYK || {};

  class PyError extends Error {
    constructor(kind, message, line) {
      super(message);
      this.kind = kind;
      this.line = line == null ? null : line;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Tokenizer                                                           */
  /* ------------------------------------------------------------------ */
  const KEYWORDS = new Set(['def', 'if', 'elif', 'else', 'while', 'for', 'in', 'return', 'break',
    'continue', 'pass', 'and', 'or', 'not', 'True', 'False', 'None', 'global', 'is']);
  const OPS3 = ['//=', '**='];
  const OPS2 = ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '//', '**'];
  const OPS1 = '+-*/%<>=()[]:,.';

  function normalize(src) {
    return String(src == null ? '' : src)
      .replace(/\r\n?/g, '\n').replace(/\t/g, '    ')
      .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
      .replace(/ /g, ' ').replace(/−/g, '-');
  }

  function tokenize(src) {
    const lines = normalize(src).split('\n');
    const toks = [];
    const indents = [0];
    const open = []; // stack of {ch, line}
    for (let ln = 0; ln < lines.length; ln++) {
      const raw = lines[ln];
      const L = ln + 1;
      let i = 0;
      if (open.length === 0) {
        while (i < raw.length && raw[i] === ' ') i++;
        if (i >= raw.length || raw[i] === '#') continue;
        const col = i;
        const top = indents[indents.length - 1];
        if (col > top) {
          indents.push(col);
          toks.push({ t: 'INDENT', line: L });
        } else if (col < top) {
          while (col < indents[indents.length - 1]) {
            indents.pop();
            toks.push({ t: 'DEDENT', line: L });
          }
          if (col !== indents[indents.length - 1]) {
            throw new PyError('IndentationError',
              `Line ${L} is pushed in by ${col} spaces, which doesn't line up with any block above it. Line it up with the code it belongs to.`, L);
          }
        }
      }
      while (i < raw.length) {
        const c = raw[i];
        if (c === ' ') { i++; continue; }
        if (c === '#') break;
        if (/\d/.test(c) || (c === '.' && /\d/.test(raw[i + 1] || ''))) {
          let j = i;
          while (j < raw.length && /[\d_.]/.test(raw[j])) j++;
          const text = raw.slice(i, j);
          const v = Number(text.replace(/_/g, ''));
          if (!isFinite(v) || (text.match(/\./g) || []).length > 1) {
            throw new PyError('SyntaxError', `Line ${L}: "${text}" isn't a number I understand.`, L);
          }
          if (j < raw.length && /[A-Za-z_]/.test(raw[j])) {
            throw new PyError('SyntaxError', `Line ${L}: names can't start with a digit ("${text}${raw[j]}..."). Try putting letters first.`, L);
          }
          toks.push({ t: 'NUM', v, line: L });
          i = j;
          continue;
        }
        if (/[A-Za-z_]/.test(c)) {
          let j = i;
          while (j < raw.length && /\w/.test(raw[j])) j++;
          const w = raw.slice(i, j);
          toks.push({ t: KEYWORDS.has(w) ? 'KW' : 'NAME', v: w, line: L });
          i = j;
          continue;
        }
        if (c === '"' || c === "'") {
          let j = i + 1;
          let s = '';
          while (j < raw.length && raw[j] !== c) {
            if (raw[j] === '\\' && j + 1 < raw.length) {
              const e = raw[j + 1];
              s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
              j += 2;
            } else {
              s += raw[j];
              j++;
            }
          }
          if (j >= raw.length) {
            throw new PyError('SyntaxError', `Line ${L}: some text was started with ${c} but never closed. Add another ${c} at the end of the text.`, L);
          }
          toks.push({ t: 'STR', v: s, line: L });
          i = j + 1;
          continue;
        }
        let op = null;
        if (OPS3.includes(raw.substr(i, 3))) op = raw.substr(i, 3);
        else if (OPS2.includes(raw.substr(i, 2))) op = raw.substr(i, 2);
        else if (OPS1.includes(c)) op = c;
        if (op) {
          if (op === '(' || op === '[') open.push({ ch: op, line: L });
          else if (op === ')' || op === ']') {
            const want = op === ')' ? '(' : '[';
            if (!open.length) throw new PyError('SyntaxError', `Line ${L}: there's a "${op}" without a matching "${want}" before it.`, L);
            const top = open.pop();
            if (top.ch !== want) throw new PyError('SyntaxError', `Line ${L}: "${top.ch}" was opened on line ${top.line} but closed with "${op}".`, L);
          }
          toks.push({ t: 'OP', v: op, line: L });
          i += op.length;
          continue;
        }
        if (c === ';' && open.length === 0) {
          toks.push({ t: 'NL', line: L });
          i++;
          continue;
        }
        if (c === '{' || c === '}') {
          throw new PyError('SyntaxError', `Line ${L}: curly braces { } aren't used here. Python groups code by indenting it instead.`, L);
        }
        if (c === '!') {
          throw new PyError('SyntaxError', `Line ${L}: use "not" instead of "!", or "!=" for "is not equal to".`, L);
        }
        if (c === '&' || c === '|') {
          throw new PyError('SyntaxError', `Line ${L}: use the words "and" / "or" instead of "${c}".`, L);
        }
        throw new PyError('SyntaxError', `Line ${L}: I don't understand the symbol "${c}".`, L);
      }
      if (open.length === 0) toks.push({ t: 'NL', line: L });
    }
    const last = Math.max(1, lines.length);
    if (open.length) {
      const o = open[open.length - 1];
      throw new PyError('SyntaxError', `Line ${o.line}: a "${o.ch}" was opened but never closed.`, o.line);
    }
    while (indents.length > 1) {
      indents.pop();
      toks.push({ t: 'DEDENT', line: last });
    }
    toks.push({ t: 'EOF', line: last });
    return toks;
  }

  /* ------------------------------------------------------------------ */
  /* Parser                                                              */
  /* ------------------------------------------------------------------ */
  class Parser {
    constructor(toks) {
      this.toks = toks;
      this.p = 0;
      this.loopDepth = 0;
      this.funcDepth = 0;
    }
    peek(o) { return this.toks[Math.min(this.p + (o || 0), this.toks.length - 1)]; }
    next() { return this.toks[this.p++]; }
    op(v) { const k = this.peek(); return k.t === 'OP' && k.v === v; }
    kw(v) { const k = this.peek(); return k.t === 'KW' && k.v === v; }
    err(msg, tok) {
      tok = tok || this.peek();
      throw new PyError('SyntaxError', `Line ${tok.line}: ${msg}`, tok.line);
    }
    describe(tok) {
      if (tok.t === 'NL') return 'the end of the line';
      if (tok.t === 'EOF') return 'the end of the program';
      if (tok.t === 'INDENT' || tok.t === 'DEDENT') return 'a change in indentation';
      if (tok.t === 'STR') return 'some text';
      return `"${tok.v}"`;
    }
    expectOp(v, msg) {
      if (!this.op(v)) this.err(msg || `expected "${v}" but found ${this.describe(this.peek())}.`);
      return this.next();
    }
    expectColon(what, head) {
      if (this.op(':')) { this.next(); return; }
      if (this.op('=')) this.err('use == (two equals signs) to compare. A single = stores a value.');
      this.err(`a "${what}" line must end with a colon ":".`, this.peek().t === 'NL' ? head : this.peek());
    }

    program() {
      const body = [];
      while (this.peek().t !== 'EOF') {
        if (this.peek().t === 'NL') { this.next(); continue; }
        body.push(this.statement());
      }
      return body;
    }

    block(head, what) {
      if (this.peek().t !== 'NL' && this.peek().t !== 'EOF') {
        const s = this.simpleStatement();
        this.endLine();
        return [s];
      }
      if (this.peek().t === 'NL') this.next();
      if (this.peek().t !== 'INDENT') {
        this.err(`the code inside this "${what}" must be indented (pushed right by 4 spaces) on the lines below it.`, head);
      }
      this.next();
      const body = [];
      while (this.peek().t !== 'DEDENT' && this.peek().t !== 'EOF') {
        if (this.peek().t === 'NL') { this.next(); continue; }
        body.push(this.statement());
      }
      if (this.peek().t === 'DEDENT') this.next();
      return body;
    }

    statement() {
      const t = this.peek();
      if (t.t === 'INDENT') {
        this.err('this line is pushed in further than it should be. Only lines inside a block (after a line ending in ":") get indented.');
      }
      if (t.t === 'KW') {
        if (t.v === 'def') return this.defStmt();
        if (t.v === 'if') return this.ifStmt();
        if (t.v === 'while') return this.whileStmt();
        if (t.v === 'for') return this.forStmt();
        if (t.v === 'elif' || t.v === 'else') {
          this.err(`"${t.v}" must come straight after an if-block, lined up exactly under its "if".`);
        }
      }
      const s = this.simpleStatement();
      this.endLine();
      return s;
    }

    endLine() {
      const t = this.peek();
      if (t.t === 'NL') { this.next(); return; }
      if (t.t === 'EOF' || t.t === 'DEDENT') return;
      if (t.t === 'OP' && t.v === ':') this.err('there\'s a ":" here that doesn\'t belong. Colons only end lines that start with if, elif, else, for, while or def.');
      this.err(`I didn't expect ${this.describe(t)} here. Is something missing, like an operator, a comma or a bracket?`);
    }

    defStmt() {
      const head = this.next();
      const nameTok = this.next();
      if (nameTok.t !== 'NAME') this.err('after "def" comes the name of your new spell, like  def hop(k):', head);
      this.expectOp('(', `after the name "${nameTok.v}" put brackets with the inputs, like  def ${nameTok.v}():`);
      const params = [];
      while (!this.op(')')) {
        const pt = this.next();
        if (pt.t !== 'NAME') this.err('the inputs of a function must be simple names, separated by commas.', pt);
        if (params.includes(pt.v)) this.err(`the input "${pt.v}" appears twice.`, pt);
        params.push(pt.v);
        if (this.op(',')) this.next();
        else if (!this.op(')')) this.err('separate inputs with commas, and close with ")".');
      }
      this.next();
      this.expectColon('def', head);
      const savedLoop = this.loopDepth;
      this.loopDepth = 0;
      this.funcDepth++;
      const body = this.block(head, 'def');
      this.funcDepth--;
      this.loopDepth = savedLoop;
      const node = { type: 'Def', line: head.line, name: nameTok.v, params, body };
      const info = analyzeLocals(body);
      node.locals = new Set(params.concat([...info.assigned]));
      node.globals = info.globals;
      for (const g of info.globals) node.locals.delete(g);
      return node;
    }

    ifStmt() {
      const head = this.next();
      const test = this.expr();
      this.expectColon(head.v, head);
      const body = this.block(head, head.v);
      let orelse = null;
      if (this.kw('elif')) {
        orelse = [this.ifStmt()];
      } else if (this.kw('else')) {
        const e = this.next();
        this.expectColon('else', e);
        orelse = this.block(e, 'else');
      }
      return { type: 'If', line: head.line, test, body, orelse };
    }

    whileStmt() {
      const head = this.next();
      const test = this.expr();
      this.expectColon('while', head);
      this.loopDepth++;
      const body = this.block(head, 'while');
      this.loopDepth--;
      return { type: 'While', line: head.line, test, body };
    }

    forStmt() {
      const head = this.next();
      const targets = [];
      do {
        const t = this.next();
        if (t.t !== 'NAME') this.err('after "for" comes a variable name, like  for i in range(5):', head);
        targets.push({ type: 'Name', id: t.v, line: t.line });
        if (this.op(',')) this.next(); else break;
      } while (true);
      if (!this.kw('in')) this.err('a for-loop needs the word "in", like  for i in range(5):', head);
      this.next();
      const iter = this.expr();
      this.expectColon('for', head);
      this.loopDepth++;
      const body = this.block(head, 'for');
      this.loopDepth--;
      const target = targets.length === 1 ? targets[0] : { type: 'Tuple', items: targets, line: head.line };
      return { type: 'For', line: head.line, target, iter, body };
    }

    simpleStatement() {
      const t = this.peek();
      if (t.t === 'KW') {
        if (t.v === 'return') {
          this.next();
          if (this.funcDepth === 0) this.err('"return" can only be used inside a function (a def).', t);
          let value = null;
          if (!['NL', 'EOF', 'DEDENT'].includes(this.peek().t)) value = this.exprList();
          return { type: 'Return', line: t.line, value };
        }
        if (t.v === 'break' || t.v === 'continue') {
          this.next();
          if (this.loopDepth === 0) this.err(`"${t.v}" only works inside a loop (for or while).`, t);
          return { type: t.v === 'break' ? 'Break' : 'Continue', line: t.line };
        }
        if (t.v === 'pass') { this.next(); return { type: 'Pass', line: t.line }; }
        if (t.v === 'global') {
          this.next();
          const names = [];
          do {
            const n = this.next();
            if (n.t !== 'NAME') this.err('after "global" write the variable name(s).', t);
            names.push(n.v);
            if (this.op(',')) this.next(); else break;
          } while (true);
          return { type: 'Global', line: t.line, names };
        }
      }
      const startTok = this.peek();
      const e = this.exprList();
      const nt = this.peek();
      if (nt.t === 'OP' && nt.v === '=') {
        this.next();
        checkTarget(e, startTok, this);
        if (this.peek().t === 'NL' || this.peek().t === 'EOF') this.err('there is nothing after the "=". What should be stored?', nt);
        const value = this.exprList();
        if (this.op('=')) this.err('only one "=" per line, please.');
        return { type: 'Assign', line: startTok.line, target: e, value };
      }
      if (nt.t === 'OP' && ['+=', '-=', '*=', '/=', '//=', '%=', '**='].includes(nt.v)) {
        this.next();
        if (e.type !== 'Name' && e.type !== 'Index') this.err(`"${nt.v}" needs a variable or list item on its left.`, startTok);
        const value = this.expr();
        return { type: 'AugAssign', line: startTok.line, target: e, op: nt.v.slice(0, -1), value };
      }
      return { type: 'Expr', line: startTok.line, e };
    }

    exprList() {
      const first = this.expr();
      if (!this.op(',')) return first;
      const items = [first];
      while (this.op(',')) {
        this.next();
        if (['NL', 'EOF', 'DEDENT'].includes(this.peek().t) || this.op('=')) break;
        items.push(this.expr());
      }
      return { type: 'Tuple', items, line: first.line };
    }

    expr() { return this.orExpr(); }
    orExpr() {
      let l = this.andExpr();
      while (this.kw('or')) { const t = this.next(); l = { type: 'BoolOp', op: 'or', l, r: this.andExpr(), line: t.line }; }
      return l;
    }
    andExpr() {
      let l = this.notExpr();
      while (this.kw('and')) { const t = this.next(); l = { type: 'BoolOp', op: 'and', l, r: this.notExpr(), line: t.line }; }
      return l;
    }
    notExpr() {
      if (this.kw('not')) { const t = this.next(); return { type: 'Not', e: this.notExpr(), line: t.line }; }
      return this.comparison();
    }
    comparison() {
      const l = this.arith();
      const ops = [];
      const rs = [];
      for (;;) {
        const t = this.peek();
        let op = null;
        if (t.t === 'OP' && ['<', '>', '<=', '>=', '==', '!='].includes(t.v)) { op = t.v; this.next(); }
        else if (t.t === 'KW' && t.v === 'in') { op = 'in'; this.next(); }
        else if (t.t === 'KW' && t.v === 'not' && this.peek(1).t === 'KW' && this.peek(1).v === 'in') { op = 'not in'; this.next(); this.next(); }
        else if (t.t === 'KW' && t.v === 'is') {
          this.next();
          if (this.kw('not')) { this.next(); op = 'is not'; } else op = 'is';
        }
        else if (t.t === 'OP' && t.v === '=' && this.inCondition) { this.err('use == to compare two things. A single = stores a value.'); }
        if (!op) break;
        ops.push(op);
        rs.push(this.arith());
      }
      if (!ops.length) return l;
      return { type: 'Compare', l, ops, rs, line: l.line };
    }
    arith() {
      let l = this.term();
      while (this.op('+') || this.op('-')) {
        const t = this.next();
        l = { type: 'BinOp', op: t.v, l, r: this.term(), line: t.line };
      }
      return l;
    }
    term() {
      let l = this.unary();
      while (this.op('*') || this.op('/') || this.op('//') || this.op('%')) {
        const t = this.next();
        l = { type: 'BinOp', op: t.v, l, r: this.unary(), line: t.line };
      }
      return l;
    }
    unary() {
      if (this.op('-') || this.op('+')) {
        const t = this.next();
        return { type: 'Unary', op: t.v, e: this.unary(), line: t.line };
      }
      return this.power();
    }
    power() {
      const base = this.postfix();
      if (this.op('**')) {
        const t = this.next();
        return { type: 'BinOp', op: '**', l: base, r: this.unary(), line: t.line };
      }
      return base;
    }
    postfix() {
      let e = this.atom();
      for (;;) {
        if (this.op('(')) {
          const t = this.next();
          const args = [];
          const kwargs = {};
          while (!this.op(')')) {
            if (this.peek().t === 'NAME' && this.peek(1).t === 'OP' && this.peek(1).v === '=') {
              const k = this.next().v;
              this.next();
              kwargs[k] = this.expr();
            } else {
              if (Object.keys(kwargs).length) this.err('plain inputs must come before named ones like end=...');
              args.push(this.expr());
            }
            if (this.op(',')) this.next();
            else if (!this.op(')')) this.err(`inside ( ) separate inputs with commas. Found ${this.describe(this.peek())}.`);
          }
          this.next();
          e = { type: 'Call', f: e, args, kwargs, line: t.line };
        } else if (this.op('[')) {
          const t = this.next();
          if (this.op(']')) this.err('put a position inside the square brackets, like  vals[0]');
          const idx = this.expr();
          if (this.op(':')) this.err('slices like [a:b] aren\'t available in keeper\'s script. Use a loop instead.');
          this.expectOp(']', 'close the square bracket with "]".');
          e = { type: 'Index', obj: e, idx, line: t.line };
        } else if (this.op('.')) {
          const t = this.next();
          const n = this.next();
          if (n.t !== 'NAME') this.err('after "." comes a method name, like  vals.append(3)', t);
          e = { type: 'Attr', obj: e, name: n.v, line: t.line };
        } else break;
      }
      return e;
    }
    atom() {
      const t = this.next();
      if (t.t === 'NUM') return { type: 'Num', v: t.v, line: t.line };
      if (t.t === 'STR') return { type: 'Str', v: t.v, line: t.line };
      if (t.t === 'NAME') return { type: 'Name', id: t.v, line: t.line };
      if (t.t === 'KW') {
        if (t.v === 'True') return { type: 'Const', v: true, line: t.line };
        if (t.v === 'False') return { type: 'Const', v: false, line: t.line };
        if (t.v === 'None') return { type: 'Const', v: null, line: t.line };
        this.err(`"${t.v}" is a special word and can't be used here.`, t);
      }
      if (t.t === 'OP' && t.v === '(') {
        if (this.op(')')) { this.next(); return { type: 'Tuple', items: [], line: t.line }; }
        const e = this.exprList();
        this.expectOp(')', 'a "(" needs a matching ")".');
        return e;
      }
      if (t.t === 'OP' && t.v === '[') {
        const items = [];
        while (!this.op(']')) {
          items.push(this.expr());
          if (this.op(',')) this.next();
          else if (!this.op(']')) this.err('inside [ ] separate items with commas.');
        }
        this.next();
        return { type: 'List', items, line: t.line };
      }
      if (t.t === 'NL' || t.t === 'EOF') this.err('this line stops too early. Something is missing at the end.', t);
      if (t.t === 'INDENT' || t.t === 'DEDENT') this.err('the indentation here is confusing. Check how far each line is pushed in.', t);
      this.err(`I didn't expect ${this.describe(t)} here.`, t);
    }
  }

  function checkTarget(e, tok, parser) {
    if (e.type === 'Name' || e.type === 'Index') return;
    if (e.type === 'Tuple') { e.items.forEach(x => checkTarget(x, tok, parser)); return; }
    if (e.type === 'Call') parser.err('you can\'t store a value into a function call. Did you mean == to compare?', tok);
    parser.err('the left side of "=" must be a variable name (like  count = 0) or a list item (like  vals[2] = 5).', tok);
  }

  function analyzeLocals(body) {
    const assigned = new Set();
    const globals = new Set();
    const addTarget = (t) => {
      if (!t) return;
      if (t.type === 'Name') assigned.add(t.id);
      else if (t.type === 'Tuple') t.items.forEach(addTarget);
    };
    const walk = (stmts) => {
      for (const s of stmts) {
        switch (s.type) {
          case 'Assign': addTarget(s.target); break;
          case 'AugAssign': addTarget(s.target); break;
          case 'For': addTarget(s.target); walk(s.body); break;
          case 'While': walk(s.body); break;
          case 'If': walk(s.body); if (s.orelse) walk(s.orelse); break;
          case 'Def': assigned.add(s.name); break;
          case 'Global': s.names.forEach(n => globals.add(n)); break;
        }
      }
    };
    walk(body);
    return { assigned, globals };
  }

  function parse(src) {
    const p = new Parser(tokenize(src));
    return p.program();
  }

  /* ------------------------------------------------------------------ */
  /* Values                                                              */
  /* ------------------------------------------------------------------ */
  class PyRange {
    constructor(start, stop, step) {
      this.start = start; this.stop = stop; this.step = step;
      const n = step > 0 ? Math.ceil((stop - start) / step) : Math.ceil((start - stop) / -step);
      this.length = Math.max(0, n);
    }
    get(k) { return this.start + k * this.step; }
    has(v) {
      if (typeof v !== 'number' || !Number.isInteger(v)) return false;
      const k = (v - this.start) / this.step;
      return Number.isInteger(k) && k >= 0 && k < this.length;
    }
    toArray() {
      if (this.length > 100000) throw new PyError('MemoryError', 'that range is too big to turn into a list (over 100,000 numbers).');
      const a = [];
      for (let k = 0; k < this.length; k++) a.push(this.get(k));
      return a;
    }
  }

  function typeName(v) {
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'boolean') return 'a True/False value';
    if (typeof v === 'number') return 'a number';
    if (typeof v === 'string') return 'text';
    if (Array.isArray(v)) return v.__tuple ? 'a tuple' : 'a list';
    if (v instanceof PyRange) return 'a range';
    if (v.type === 'func' || v.type === 'builtin') return 'a function';
    return 'a value';
  }

  function truthy(v) {
    if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof PyRange) return v.length > 0;
    return true;
  }

  function pyEq(a, b) {
    if ((typeof a === 'number' || typeof a === 'boolean') && (typeof b === 'number' || typeof b === 'boolean')) return Number(a) === Number(b);
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length || !!a.__tuple !== !!b.__tuple) return false;
      for (let i = 0; i < a.length; i++) if (!pyEq(a[i], b[i])) return false;
      return true;
    }
    if (a instanceof PyRange && b instanceof PyRange) return a.start === b.start && a.length === b.length && a.step === b.step;
    return a === b;
  }

  function fmtFloat(v) {
    if (!isFinite(v)) return v > 0 ? 'inf' : (v < 0 ? '-inf' : 'nan');
    return String(v);
  }

  function repr(v, inner, depth) {
    depth = depth || 0;
    if (depth > 20) return '[...]';
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : fmtFloat(v);
    if (typeof v === 'string') return inner ? "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'" : v;
    if (Array.isArray(v)) {
      const s = v.map(x => repr(x, true, depth + 1)).join(', ');
      return v.__tuple ? '(' + s + (v.length === 1 ? ',' : '') + ')' : '[' + s + ']';
    }
    if (v instanceof PyRange) return `range(${v.start}, ${v.start + v.length * v.step === v.stop ? v.stop : v.stop}${v.step !== 1 ? ', ' + v.step : ''})`;
    if (v.type === 'func') return `<function ${v.name}>`;
    if (v.type === 'builtin') return `<spell ${v.name}>`;
    return String(v);
  }
  function str(v) { return typeof v === 'string' ? v : repr(v, false); }

  function makeTuple(arr) { Object.defineProperty(arr, '__tuple', { value: true }); return arr; }

  function isNum(x) { return typeof x === 'number' || typeof x === 'boolean'; }

  function binop(op, a, b, line) {
    switch (op) {
      case '+':
        if (isNum(a) && isNum(b)) return Number(a) + Number(b);
        if (typeof a === 'string' && typeof b === 'string') return a + b;
        if (Array.isArray(a) && Array.isArray(b) && !a.__tuple && !b.__tuple) return a.concat(b);
        throw new PyError('TypeError', `can't add ${typeName(a)} and ${typeName(b)} together.` +
          ((typeof a === 'string') !== (typeof b === 'string') ? ' To join text with a number, turn the number into text first: str(x).' : ''), line);
      case '-':
        if (isNum(a) && isNum(b)) return Number(a) - Number(b);
        throw new PyError('TypeError', `can't subtract ${typeName(b)} from ${typeName(a)}.`, line);
      case '*': {
        if (isNum(a) && isNum(b)) return Number(a) * Number(b);
        let seq = null, n = null;
        if ((Array.isArray(a) || typeof a === 'string') && isNum(b)) { seq = a; n = b; }
        if ((Array.isArray(b) || typeof b === 'string') && isNum(a)) { seq = b; n = a; }
        if (seq !== null) {
          if (!Number.isInteger(Number(n))) throw new PyError('TypeError', 'you can only repeat a list or text a whole number of times.', line);
          n = Math.max(0, Number(n));
          if (seq.length * n > 100000) throw new PyError('MemoryError', 'that would make something over 100,000 items long.', line);
          if (typeof seq === 'string') return seq.repeat(n);
          const out = [];
          for (let k = 0; k < n; k++) for (const x of seq) out.push(x);
          return out;
        }
        throw new PyError('TypeError', `can't multiply ${typeName(a)} by ${typeName(b)}.`, line);
      }
      case '/':
      case '//':
      case '%': {
        if (!isNum(a) || !isNum(b)) throw new PyError('TypeError', `"${op}" needs two numbers, but got ${typeName(a)} and ${typeName(b)}.`, line);
        a = Number(a); b = Number(b);
        if (b === 0) throw new PyError('ZeroDivisionError', op === '%' ? 'you can\'t find the remainder after dividing by zero.' : 'dividing by zero is impossible, even for Ember.', line);
        if (op === '/') return a / b;
        if (op === '//') return Math.floor(a / b);
        return ((a % b) + b) % b;
      }
      case '**':
        if (!isNum(a) || !isNum(b)) throw new PyError('TypeError', '"**" needs two numbers.', line);
        {
          const r = Math.pow(Number(a), Number(b));
          if (!isFinite(r) || Math.abs(r) > 1e300) throw new PyError('OverflowError', 'that number is far too big.', line);
          return r;
        }
    }
    throw new PyError('SyntaxError', `unknown operator ${op}`, line);
  }

  function compare(op, a, b, line) {
    switch (op) {
      case '==': return pyEq(a, b);
      case '!=': return !pyEq(a, b);
      case 'is': return a === b || (a === null && b === undefined) || (a === undefined && b === null);
      case 'is not': return !(a === b || (a == null && b == null));
      case 'in':
      case 'not in': {
        let r;
        if (Array.isArray(b)) r = b.some(x => pyEq(x, a));
        else if (b instanceof PyRange) r = b.has(a);
        else if (typeof b === 'string') {
          if (typeof a !== 'string') throw new PyError('TypeError', `"in" with text on the right needs text on the left too.`, line);
          r = b.includes(a);
        } else throw new PyError('TypeError', `can't look "in" ${typeName(b)}. Use a list, a range or text.`, line);
        return op === 'in' ? r : !r;
      }
    }
    const bothNum = isNum(a) && isNum(b);
    const bothStr = typeof a === 'string' && typeof b === 'string';
    if (!bothNum && !bothStr) {
      if (Array.isArray(a) && Array.isArray(b)) {
        const n = Math.min(a.length, b.length);
        for (let i = 0; i < n; i++) {
          if (!pyEq(a[i], b[i])) return compare(op, a[i], b[i], line);
        }
        return compare(op, a.length, b.length, line);
      }
      throw new PyError('TypeError', `can't compare ${typeName(a)} with ${typeName(b)} using "${op}".` +
        (a === null || b === null ? ' One side is None — did a function forget to return a value?' : ''), line);
    }
    if (bothNum) { a = Number(a); b = Number(b); }
    switch (op) {
      case '<': return a < b;
      case '>': return a > b;
      case '<=': return a <= b;
      case '>=': return a >= b;
    }
    return false;
  }

  function checkPos(o, i, line) {
    if (typeof i === 'boolean') i = Number(i);
    if (typeof i !== 'number' || !Number.isInteger(i)) {
      throw new PyError('TypeError', typeof i === 'number'
        ? `positions must be whole numbers, but got ${repr(i)}. Tip: use // instead of / to divide without decimals.`
        : `a position must be a whole number, not ${typeName(i)}.`, line);
    }
    const len = o.length;
    const k = i < 0 ? i + len : i;
    if (k < 0 || k >= len) {
      throw new PyError('IndexError', len === 0
        ? `position ${i} doesn't exist — the ${typeof o === 'string' ? 'text' : 'list'} is empty.`
        : `position ${i} is outside this ${typeof o === 'string' ? 'text' : 'list'}. It has ${len} item${len === 1 ? '' : 's'}, so positions go from 0 to ${len - 1}.`, line);
    }
    return k;
  }

  function getIndex(o, i, line) {
    if (Array.isArray(o)) return o[checkPos(o, i, line)];
    if (typeof o === 'string') return o[checkPos(o, i, line)];
    if (o instanceof PyRange) return o.get(checkPos(o, i, line));
    throw new PyError('TypeError', `can't use [ ] on ${typeName(o)}.`, line);
  }
  function setIndex(o, i, v, line) {
    if (Array.isArray(o) && !o.__tuple) { o[checkPos(o, i, line)] = v; return; }
    if (typeof o === 'string') throw new PyError('TypeError', 'text can\'t be changed letter by letter. Build new text instead.', line);
    throw new PyError('TypeError', `can't store into ${typeName(o)} with [ ].`, line);
  }

  function seqOf(v, line, what) {
    if (Array.isArray(v)) return v;
    if (v instanceof PyRange) return v;
    if (typeof v === 'string') return v.split('');
    throw new PyError('TypeError', `can't ${what || 'loop over'} ${typeName(v)}. Use a list, range(...) or text.`, line);
  }
  function toArray(v, line, what) {
    const s = seqOf(v, line, what);
    return s instanceof PyRange ? s.toArray() : s.slice();
  }

  function callMethod(obj, name, args, line) {
    if (Array.isArray(obj) && !obj.__tuple) {
      const need = (n, sig) => {
        if (args.length !== n) throw new PyError('TypeError', `${name}() needs ${n} input${n === 1 ? '' : 's'}: list.${sig}`, line);
      };
      switch (name) {
        case 'append':
          need(1, 'append(item)');
          if (obj.length >= 100000) throw new PyError('MemoryError', 'that list is getting enormous (100,000 items). Is a loop running forever?', line);
          obj.push(args[0]);
          return null;
        case 'pop': {
          if (args.length > 1) throw new PyError('TypeError', 'pop() takes at most one position.', line);
          if (!obj.length) throw new PyError('IndexError', 'can\'t pop from an empty list.', line);
          const k = args.length ? checkPos(obj, args[0], line) : obj.length - 1;
          return obj.splice(k, 1)[0];
        }
        case 'insert': {
          need(2, 'insert(position, item)');
          let k = args[0];
          if (typeof k !== 'number' || !Number.isInteger(k)) throw new PyError('TypeError', 'insert needs a whole-number position.', line);
          if (k < 0) k = Math.max(0, obj.length + k);
          obj.splice(Math.min(k, obj.length), 0, args[1]);
          return null;
        }
        case 'index': {
          need(1, 'index(item)');
          const k = obj.findIndex(x => pyEq(x, args[0]));
          if (k < 0) throw new PyError('ValueError', `${repr(args[0], true)} is not in the list.`, line);
          return k;
        }
        case 'count': need(1, 'count(item)'); return obj.filter(x => pyEq(x, args[0])).length;
        case 'reverse': need(0, 'reverse()'); obj.reverse(); return null;
        case 'sort': need(0, 'sort()'); obj.sort(sortCmp(line)); return null;
      }
      throw new PyError('AttributeError', `lists don't have a method called "${name}". Try append, pop, insert, index, count, reverse or sort.`, line);
    }
    throw new PyError('AttributeError', `${typeName(obj)} doesn't have a method called "${name}".`, line);
  }

  function sortCmp(line) {
    return (a, b) => (compare('<', a, b, line) ? -1 : compare('<', b, a, line) ? 1 : 0);
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[m][n];
  }

  /* ------------------------------------------------------------------ */
  /* Built-in functions                                                  */
  /* ------------------------------------------------------------------ */
  function needInt(v, what, line) {
    if (typeof v === 'boolean') v = Number(v);
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      throw new PyError('TypeError', `${what} needs whole numbers, but got ${repr(v, true)}.` + (typeof v === 'number' ? ' Use // to divide without decimals.' : ''), line);
    }
    return v;
  }

  function makeBuiltins(interp) {
    const B = {};
    const def = (name, fn, opts) => { B[name] = Object.assign({ type: 'builtin', name, fn }, opts || {}); };
    def('print', (args, kw) => {
      const sep = kw.sep === undefined ? ' ' : str(kw.sep);
      const end = kw.end === undefined ? '\n' : str(kw.end);
      interp.out(args.map(str).join(sep) + end);
      return null;
    }, { kw: true });
    def('range', (args, kw, line) => {
      if (args.length < 1 || args.length > 3) throw new PyError('TypeError', 'range() needs 1, 2 or 3 numbers: range(stop), range(start, stop) or range(start, stop, step).', line);
      const a = args.map(x => needInt(x, 'range()', line));
      const [start, stop, step] = a.length === 1 ? [0, a[0], 1] : a.length === 2 ? [a[0], a[1], 1] : a;
      if (step === 0) throw new PyError('ValueError', 'range() can\'t have a step of 0 — it would never get anywhere.', line);
      return new PyRange(start, stop, step);
    });
    def('len', (args, kw, line) => {
      if (args.length !== 1) throw new PyError('TypeError', 'len() needs exactly one thing to measure.', line);
      const v = args[0];
      if (Array.isArray(v) || typeof v === 'string' || v instanceof PyRange) return v.length;
      throw new PyError('TypeError', `${typeName(v)} has no length.`, line);
    });
    def('abs', (args, kw, line) => {
      if (args.length !== 1 || !isNum(args[0])) throw new PyError('TypeError', 'abs() needs one number.', line);
      return Math.abs(Number(args[0]));
    });
    const minmax = (which) => (args, kw, line) => {
      let items = args.length === 1 ? toArray(args[0], line, `find the ${which} of`) : args;
      if (!items.length) throw new PyError('ValueError', `${which}() of an empty list has no answer.`, line);
      let best = items[0];
      for (const x of items) {
        if (which === 'max' ? compare('>', x, best, line) : compare('<', x, best, line)) best = x;
      }
      return best;
    };
    def('max', minmax('max'));
    def('min', minmax('min'));
    def('sum', (args, kw, line) => {
      if (args.length !== 1) throw new PyError('TypeError', 'sum() needs one list of numbers.', line);
      let t = 0;
      for (const x of toArray(args[0], line, 'add up')) {
        if (!isNum(x)) throw new PyError('TypeError', 'sum() can only add up numbers.', line);
        t += Number(x);
      }
      return t;
    });
    def('str', (args) => (args.length ? str(args[0]) : ''));
    def('int', (args, kw, line) => {
      const v = args[0];
      if (typeof v === 'string') {
        if (!/^\s*[-+]?\d+\s*$/.test(v)) throw new PyError('ValueError', `"${v}" doesn't look like a whole number.`, line);
        return parseInt(v, 10);
      }
      if (isNum(v)) return Math.trunc(Number(v));
      throw new PyError('TypeError', `can't turn ${typeName(v)} into a whole number.`, line);
    });
    def('bool', (args) => truthy(args[0]));
    def('list', (args, kw, line) => (args.length ? toArray(args[0], line, 'make a list from') : []));
    def('sorted', (args, kw, line) => {
      if (args.length !== 1) throw new PyError('TypeError', 'sorted() needs one list.', line);
      const a = toArray(args[0], line, 'sort');
      a.sort(sortCmp(line));
      if (truthy(kw.reverse)) a.reverse();
      return a;
    }, { kw: true });
    def('reversed', (args, kw, line) => toArray(args[0], line, 'reverse').reverse());
    def('round', (args, kw, line) => {
      if (!isNum(args[0])) throw new PyError('TypeError', 'round() needs a number.', line);
      const x = Number(args[0]);
      const f = Math.floor(x);
      const diff = x - f;
      if (diff === 0.5) return f % 2 === 0 ? f : f + 1; // banker's rounding, like Python
      return Math.round(x);
    });
    return B;
  }

  /* ------------------------------------------------------------------ */
  /* Interpreter                                                         */
  /* ------------------------------------------------------------------ */
  class Interp {
    constructor(opts) {
      opts = opts || {};
      this.maxSteps = opts.maxSteps || 20000;
      this.maxDepth = opts.maxDepth || 150;
      this.out = opts.out || function () {};
      this.builtins = makeBuiltins(this);
      if (opts.api) Object.assign(this.builtins, opts.api);
      this.steps = 0;
      this.depth = 0;
      this.callStack = [];
      this.globalScope = { vars: new Map(), locals: null, globals: null, fname: null };
      this.curLine = 0;
    }

    tick(line) {
      this.steps++;
      this.curLine = line;
      if (this.steps > this.maxSteps) {
        const n = this.maxSteps.toLocaleString('en-US');
        throw new PyError('TooManySteps', this.depth > 3
          ? `your program ran more than ${n} steps without finishing — the river froze. It is ${this.depth} calls deep, so a recursive function may be working out the same answers again and again.`
          : `your program ran more than ${n} steps without finishing. A loop might never end — make sure something changes each time around so the loop can stop.`, line);
      }
    }

    *run(ast) {
      yield* this.execBlock(ast, this.globalScope);
    }

    nameError(name, scope, line) {
      const cands = new Set([...this.globalScope.vars.keys(), ...Object.keys(this.builtins), 'True', 'False', 'None']);
      if (scope && scope.vars) for (const k of scope.vars.keys()) cands.add(k);
      const sound = (w) => w.toLowerCase().replace(/ght/g, 't').replace(/ph/g, 'f').replace(/(.)\1/g, '$1').replace(/e$/, '');
      let best = null, bestD = 99;
      for (const c of cands) {
        let d = c.toLowerCase() === name.toLowerCase() ? 0.2 : Math.min(levenshtein(name, c), levenshtein(sound(name), sound(c)) + 0.4);
        const b = this.builtins[c];
        if (b && b.type === 'builtin') d += b.gen ? -0.3 : (b.fn && b.name && !b.kw && /unlocked/.test(String(b.fn)) ? 1 : 0.2);
        if (d < bestD) { bestD = d; best = c; }
      }
      let msg = `I don't know what "${name}" is.`;
      if (best && bestD <= (name.length <= 3 ? 1.2 : 2.2)) msg += ` Did you mean "${best}"?`;
      else msg += ' If it\'s a variable, give it a value first (like  ' + name + ' = 0).';
      return new PyError('NameError', msg, line);
    }

    lookup(name, scope, line) {
      if (scope.locals) {
        if (scope.vars.has(name)) return scope.vars.get(name);
        if (scope.locals.has(name)) {
          throw new PyError('UnboundLocalError',
            `"${name}" is used here before it gets a value inside ${scope.fname}(). If you meant the "${name}" from outside the function, add the line  global ${name}  at the top of the function.`, line);
        }
      }
      const g = this.globalScope.vars;
      if (g.has(name)) return g.get(name);
      if (Object.prototype.hasOwnProperty.call(this.builtins, name)) return this.builtins[name];
      throw this.nameError(name, scope, line);
    }

    setName(name, v, scope) {
      if (scope.locals && !(scope.globals && scope.globals.has(name))) scope.vars.set(name, v);
      else this.globalScope.vars.set(name, v);
    }

    *assign(target, v, scope, line) {
      if (target.type === 'Name') {
        if (Object.prototype.hasOwnProperty.call(this.builtins, target.id) && !this.globalScope.vars.has(target.id) && this.builtins[target.id].type === 'builtin') {
          throw new PyError('NameError', `"${target.id}" is the name of a built-in spell, so it can't be used as a variable name. Pick another name.`, line);
        }
        this.setName(target.id, v, scope);
        return;
      }
      if (target.type === 'Index') {
        const o = yield* this.eval(target.obj, scope);
        const i = yield* this.eval(target.idx, scope);
        setIndex(o, i, v, line);
        return;
      }
      if (target.type === 'Tuple') {
        const vals = toArray(v, line, 'unpack');
        if (vals.length !== target.items.length) {
          throw new PyError('ValueError', `there are ${target.items.length} names on the left of "=" but ${vals.length} value${vals.length === 1 ? '' : 's'} on the right.`, line);
        }
        for (let k = 0; k < vals.length; k++) yield* this.assign(target.items[k], vals[k], scope, line);
        return;
      }
      throw new PyError('SyntaxError', 'can\'t assign to that.', line);
    }

    *execBlock(stmts, scope) {
      for (const s of stmts) {
        const sig = yield* this.exec(s, scope);
        if (sig) return sig;
      }
      return null;
    }

    *exec(s, scope) {
      this.tick(s.line);
      yield { t: 'line', line: s.line, scope };
      try {
        switch (s.type) {
          case 'Expr':
            yield* this.eval(s.e, scope);
            return null;
          case 'Assign': {
            const v = yield* this.eval(s.value, scope);
            yield* this.assign(s.target, s.value.type === 'Tuple' ? makeTuple(v) : v, scope, s.line);
            return null;
          }
          case 'AugAssign': {
            if (s.target.type === 'Name') {
              const cur = this.lookup(s.target.id, scope, s.line);
              const v = yield* this.eval(s.value, scope);
              const res = (s.op === '+' && Array.isArray(cur) && Array.isArray(v)) ? (cur.push(...v), cur) : binop(s.op, cur, v, s.line);
              this.setName(s.target.id, res, scope);
            } else {
              const o = yield* this.eval(s.target.obj, scope);
              const i = yield* this.eval(s.target.idx, scope);
              const cur = getIndex(o, i, s.line);
              const v = yield* this.eval(s.value, scope);
              setIndex(o, i, binop(s.op, cur, v, s.line), s.line);
            }
            return null;
          }
          case 'If': {
            const c = yield* this.eval(s.test, scope);
            if (truthy(c)) return yield* this.execBlock(s.body, scope);
            if (s.orelse) return yield* this.execBlock(s.orelse, scope);
            return null;
          }
          case 'While': {
            let first = true;
            for (;;) {
              if (!first) {
                this.tick(s.line);
                yield { t: 'line', line: s.line, scope };
              }
              first = false;
              const c = yield* this.eval(s.test, scope);
              if (!truthy(c)) break;
              const sig = yield* this.execBlock(s.body, scope);
              if (sig) {
                if (sig.k === 'break') break;
                if (sig.k === 'return') return sig;
              }
            }
            return null;
          }
          case 'For': {
            const it = yield* this.eval(s.iter, scope);
            const seq = seqOf(it, s.line);
            for (let k = 0; k < seq.length; k++) {
              if (k > 0) {
                this.tick(s.line);
                yield { t: 'line', line: s.line, scope };
              }
              const item = seq instanceof PyRange ? seq.get(k) : seq[k];
              yield* this.assign(s.target, item, scope, s.line);
              const sig = yield* this.execBlock(s.body, scope);
              if (sig) {
                if (sig.k === 'break') break;
                if (sig.k === 'return') return sig;
              }
            }
            return null;
          }
          case 'Def': {
            const f = { type: 'func', name: s.name, params: s.params, body: s.body, locals: s.locals, globals: s.globals, line: s.line };
            this.setName(s.name, f, scope);
            return null;
          }
          case 'Return': {
            let v = null;
            if (s.value) {
              v = yield* this.eval(s.value, scope);
              if (s.value.type === 'Tuple') makeTuple(v);
            }
            return { k: 'return', v };
          }
          case 'Break': return { k: 'break' };
          case 'Continue': return { k: 'continue' };
          case 'Pass':
          case 'Global':
            return null;
        }
        throw new PyError('SyntaxError', `unknown statement ${s.type}`, s.line);
      } catch (e) {
        if (e instanceof PyError) {
          if (e.line == null) e.line = s.line;
          throw e;
        }
        if (e instanceof RangeError) {
          throw new PyError('RecursionError', 'the program went too deep (too many calls inside calls). Does your recursion have a base case that stops it?', s.line);
        }
        throw e;
      }
    }

    *eval(e, scope) {
      switch (e.type) {
        case 'Num':
        case 'Str':
        case 'Const':
          return e.v;
        case 'Name':
          return this.lookup(e.id, scope, e.line);
        case 'List': {
          const out = [];
          for (const it of e.items) out.push(yield* this.eval(it, scope));
          return out;
        }
        case 'Tuple': {
          const out = [];
          for (const it of e.items) out.push(yield* this.eval(it, scope));
          return makeTuple(out);
        }
        case 'BinOp': {
          const l = yield* this.eval(e.l, scope);
          const r = yield* this.eval(e.r, scope);
          return binop(e.op, l, r, e.line);
        }
        case 'Unary': {
          const v = yield* this.eval(e.e, scope);
          if (!isNum(v)) throw new PyError('TypeError', `"${e.op}" in front only works on numbers, not ${typeName(v)}.`, e.line);
          return e.op === '-' ? -Number(v) : Number(v);
        }
        case 'Not':
          return !truthy(yield* this.eval(e.e, scope));
        case 'BoolOp': {
          const l = yield* this.eval(e.l, scope);
          if (e.op === 'and') return truthy(l) ? (yield* this.eval(e.r, scope)) : l;
          return truthy(l) ? l : (yield* this.eval(e.r, scope));
        }
        case 'Compare': {
          let l = yield* this.eval(e.l, scope);
          for (let k = 0; k < e.ops.length; k++) {
            const r = yield* this.eval(e.rs[k], scope);
            if (!compare(e.ops[k], l, r, e.line)) return false;
            l = r;
          }
          return true;
        }
        case 'Index': {
          const o = yield* this.eval(e.obj, scope);
          const i = yield* this.eval(e.idx, scope);
          return getIndex(o, i, e.line);
        }
        case 'Call':
          return yield* this.evalCall(e, scope);
        case 'Attr':
          throw new PyError('AttributeError', `".${e.name}" has to be called with brackets, like  things.${e.name}(...)`, e.line);
      }
      throw new PyError('SyntaxError', 'unknown expression', e.line);
    }

    *evalCall(e, scope) {
      if (e.f.type === 'Attr') {
        const obj = yield* this.eval(e.f.obj, scope);
        const args = [];
        for (const a of e.args) args.push(yield* this.eval(a, scope));
        return callMethod(obj, e.f.name, args, e.line);
      }
      const f = yield* this.eval(e.f, scope);
      const args = [];
      for (const a of e.args) args.push(yield* this.eval(a, scope));
      const kw = {};
      for (const k of Object.keys(e.kwargs || {})) kw[k] = yield* this.eval(e.kwargs[k], scope);
      return yield* this.call(f, args, kw, e.line, e.f.type === 'Name' ? e.f.id : null);
    }

    *call(f, args, kw, line, name) {
      const kwNames = Object.keys(kw || {});
      if (f && f.type === 'builtin') {
        if (kwNames.length && !f.kw) throw new PyError('TypeError', `${f.name}() doesn't take named inputs like ${kwNames[0]}=...`, line);
        if (f.gen) return yield* f.fn(args, kw || {}, line);
        return f.fn(args, kw || {}, line);
      }
      if (f && f.type === 'func') {
        if (kwNames.length) throw new PyError('TypeError', `${f.name}() takes its inputs in order, without names like ${kwNames[0]}=...`, line);
        if (args.length !== f.params.length) {
          const n = f.params.length;
          throw new PyError('TypeError', `${f.name}() needs ${n} input${n === 1 ? '' : 's'}${n ? ' (' + f.params.join(', ') + ')' : ''} but was given ${args.length}.`, line);
        }
        if (this.depth >= this.maxDepth) {
          throw new PyError('RecursionError', `${f.name}() called itself too many times in a row (over ${this.maxDepth}). Does your recursion have a base case that stops it?`, line);
        }
        const scope = { vars: new Map(), locals: f.locals, globals: f.globals, fname: f.name };
        f.params.forEach((p, i) => scope.vars.set(p, args[i]));
        this.depth++;
        this.callStack.push({ name: f.name, args, line, scope });
        try {
          const sig = yield* this.execBlock(f.body, scope);
          return sig && sig.k === 'return' ? sig.v : null;
        } finally {
          this.depth--;
          this.callStack.pop();
        }
      }
      throw new PyError('TypeError', `${name ? '"' + name + '"' : 'that'} is ${typeName(f)}, not a spell you can call with ( ).`, line);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers for the game                                                */
  /* ------------------------------------------------------------------ */
  function runSync(gen) {
    let r;
    do { r = gen.next(); } while (!r.done);
    return r.value;
  }

  function walkAst(node, fn) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => walkAst(n, fn)); return; }
    if (node.type) fn(node);
    for (const k of Object.keys(node)) {
      if (k === 'locals' || k === 'globals') continue;
      const v = node[k];
      if (v && typeof v === 'object') walkAst(v, fn);
    }
  }

  function usesRecursion(ast) {
    let found = false;
    walkAst(ast, (n) => {
      if (n.type === 'Def') {
        walkAst(n.body, (m) => {
          if (m.type === 'Call' && m.f.type === 'Name' && m.f.id === n.name) found = true;
        });
      }
    });
    return found;
  }

  function usesNode(ast, type) {
    let found = false;
    walkAst(ast, (n) => { if (n.type === type) found = true; });
    return found;
  }

  function codeLines(src) {
    return normalize(src).split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;
  }

  Object.assign(WYK, {
    PyError, tokenize, parse, Interp, PyRange, runSync, repr, str, pyEq, truthy, typeName,
    usesRecursion, usesNode, codeLines, normalize, KEYWORDS, levenshtein
  });
})(typeof window !== 'undefined' ? window : globalThis);
