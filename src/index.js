/**
 * FormulaEvaluator: A lightweight, extensible formula engine
 * Features: Variable tracking, nested functions, and operator precedence.
 */
class FormulaEvaluator {
  constructor(globalContext = {}) {
    this.context = globalContext;

    // Core Function Library (Easily extensible)
    this.FUNCTIONS = {
      upper: (str) => String(str).toUpperCase(),
      join: (sep, ...args) => args.join(sep),
      sum: (...args) => args.reduce((a, b) => Number(a) + Number(b), 0),
      avg: (...args) => args.reduce((a, b) => a + b, 0) / args.length,
      if: (cond, a, b) => (cond ? a : b),
      // Internal Operator Mappings
      __add: (a, b) => a + b,
      __sub: (a, b) => a - b,
      __eq: (a, b) => a === b,
    };

    this.TOKEN_TYPES = {
      NUMBER: 'number',
      STRING: 'string',
      IDENTIFIER: 'identifier',
      OPERATOR: 'operator',
      DELIMITER: 'delimiter',
      WHITESPACE: 'whitespace'
    };
  }

  tokenize(str) {
    const tokens = [];
    const rules = [
      { type: this.TOKEN_TYPES.STRING,     regex: /"([^"]*)"/g },
      { type: this.TOKEN_TYPES.NUMBER,     regex: /\d*\.?\d+/g },
      { type: this.TOKEN_TYPES.IDENTIFIER, regex: /[a-zA-Z][\w\d]*/g },
      { type: this.TOKEN_TYPES.OPERATOR,   regex: /[+=-]/g },
      { type: this.TOKEN_TYPES.DELIMITER,  regex: /[(),]/g },
      { type: this.TOKEN_TYPES.WHITESPACE, regex: /\s+/g }
    ];

    let pos = 0;
    while (pos < str.length) {
      let found = false;
      for (const { type, regex } of rules) {
        regex.lastIndex = pos;
        const match = regex.exec(str);
        if (match && match.index === pos) {
          if (type !== this.TOKEN_TYPES.WHITESPACE) {
            tokens.push({
              type,
              value: type === this.TOKEN_TYPES.STRING ? match[1] : match[0],
              start: pos,
              end: pos + match[0].length
            });
          }
          pos += match[0].length;
          found = true;
          break;
        }
      }
      if (!found) throw new Error(`Unexpected character at ${pos}: ${str[pos]}`);
    }
    return tokens;
  }

  // --- Parser Logic ---
  parse(tokens) {
    let pos = 0;

    const parseExpression = () => {
      let node = parseToken();

      const currentToken = tokens[pos];
      if (currentToken && currentToken.type === this.TOKEN_TYPES.OPERATOR) {
        const opToken = tokens[pos++];
        const right = parseExpression();
        const opMap = { '+': '__add', '-': '__sub', '=': '__eq' };
        return { type: 'function', name: opMap[opToken.value], args: [node, right] };
      }
      return node;
    };

    const parseToken = () => {
      const token = tokens[pos++];
      if (!token) return null;

      if (token.type === this.TOKEN_TYPES.NUMBER) return parseFloat(token.value);
      if (token.value === 'true') return true;
      if (token.value === 'false') return false;
      if (token.type === this.TOKEN_TYPES.STRING) return token.value;

      if (token.type === this.TOKEN_TYPES.IDENTIFIER) {
        const nextToken = tokens[pos];
        if (nextToken && nextToken.value === '(') {
          pos++; // skip (
          const args = [];
          while (pos < tokens.length && tokens[pos].value !== ')') {
            args.push(parseExpression());
            if (tokens[pos] && tokens[pos].value === ',') pos++;
          }
          pos++; // skip )
          return { type: 'function', name: token.value, args };
        }
        return { type: 'variable', name: token.value };
      }

      if (token.value === '(') {
        const node = parseExpression();
        pos++; // skip )
        return node;
      }
    };

    return parseExpression();
  }

  // --- Execution & Analysis ---
  evaluate(formula, localContext = {}) {
    const ast = this.parse(this.tokenize(formula));
    const ctx = { ...this.context, ...localContext };

    const run = (node) => {
      if (typeof node !== 'object' || node === null) return node;

      if (node.type === 'variable') {
        if (!(node.name in ctx)) throw new Error(`Variable "${node.name}" not found`);
        return ctx[node.name];
      }

      if (node.type === 'function') {
        const fn = this.FUNCTIONS[node.name];
        if (!fn) throw new Error(`Function "${node.name}" not found`);
        return fn(...node.args.map(run));
      }
    };

    return run(ast);
  }

  getDependencies(formula) {
    const ast = this.parse(this.tokenize(formula));
    const deps = new Set();
    const walk = (node) => {
      if (typeof node !== 'object' || node === null) return;
      if (node.type === 'variable') deps.add(node.name);
      else if (node.type === 'function') node.args.forEach(walk);
    };
    walk(ast);
    return Array.from(deps);
  }
}

export default FormulaEvaluator;
