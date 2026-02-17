/**
 * @module formula-evaluator
 * A lightweight, extensible formula engine with variable tracking,
 * nested functions, and operator precedence.
 */

import { createFunctionRegistry } from './functions.js';

export { builtinFunctions, createFunctionRegistry } from './functions.js';

/**
 * Evaluates string-based formulas with support for variables, functions,
 * and arithmetic operators.
 *
 * @example
 * const evaluator = new FormulaEvaluator({ tax: 0.2 });
 * evaluator.registerFunction('discount', (price, pct) => price * (1 - pct));
 * evaluator.evaluate('discount(100, tax)'); // 80
 */
class FormulaEvaluator {
  /**
   * Creates a new FormulaEvaluator instance.
   *
   * @param {Record<string, *>} [globalContext={}] - Variables available to every evaluation
   */
  constructor(globalContext = {}) {
    /** @type {Record<string, *>} */
    this.context = globalContext;

    /**
     * Internal function registry.
     * @private
     * @type {import('./functions.js').FunctionRegistry}
     */
    this._functions = createFunctionRegistry();

    /**
     * Token type constants used by the tokenizer.
     * @type {Readonly<Record<string, string>>}
     */
    this.TOKEN_TYPES = {
      NUMBER: 'number',
      STRING: 'string',
      IDENTIFIER: 'identifier',
      OPERATOR: 'operator',
      DELIMITER: 'delimiter',
      WHITESPACE: 'whitespace'
    };
  }

  /**
   * Registers a custom function that can be called in formulas.
   *
   * @param {string} name - The function name (used in formula strings)
   * @param {import('./functions.js').FormulaFunction} fn - The function implementation
   * @param {string} [description=''] - A human-readable description of the function
   * @returns {this} The evaluator instance, for chaining
   * @throws {Error} If name is not a non-empty string or fn is not a function
   *
   * @example
   * evaluator
   *   .registerFunction('double', (x) => x * 2, 'Doubles a number')
   *   .registerFunction('clamp', (val, min, max) => Math.min(Math.max(val, min), max), 'Restricts a number to a range');
   *
   * evaluator.evaluate('double(5)');       // 10
   * evaluator.evaluate('clamp(15, 0, 10)'); // 10
   */
  registerFunction(name, fn, description = '') {
    this._functions.register(name, fn, description);
    return this;
  }

  /**
   * Lists the names of all registered public functions
   * (excludes internal operator mappings).
   *
   * @returns {string[]} Array of function names
   */
  listFunctions() {
    return this._functions.list();
  }

  /**
   * Returns the names and descriptions of all registered public functions
   * (excludes internal operator mappings).
   *
   * @returns {Array<{name: string, description: string}>}
   */
  describeFunctions() {
    return this._functions.describe();
  }

  /**
   * Tokenizes a formula string into an array of tokens.
   *
   * @param {string} str - The formula string to tokenize
   * @returns {Array<{type: string, value: string, start: number, end: number}>} The token array
   * @throws {Error} If an unexpected character is encountered
   */
  tokenize(str) {
    const tokens = [];
    const rules = [
      { type: this.TOKEN_TYPES.STRING,     regex: /"([^"]*)"/g },
      { type: this.TOKEN_TYPES.NUMBER,     regex: /\d*\.?\d+/g },
      { type: this.TOKEN_TYPES.IDENTIFIER, regex: /[a-zA-Z][\w\d]*/g },
      { type: this.TOKEN_TYPES.OPERATOR,   regex: /!=|>=|<=|[+=\-><&|/*!/]/g },
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

  /**
   * Parses an array of tokens into an abstract syntax tree (AST).
   *
   * @param {Array<{type: string, value: string}>} tokens - Tokens produced by {@link tokenize}
   * @returns {*} The root AST node
   */
  parse(tokens) {
    let pos = 0;

    const opMap = { '+': '__add', '-': '__sub', '=': '__eq', '!=': '__neq', '>': '__gt', '>=': '__gte', '<': '__lt', '<=': '__lte', '*': '__mul', '/': '__div', '&': '__and', '|': '__or' };
    const precedence = { '|': 1, '&': 2, '=': 3, '!=': 3, '>': 4, '>=': 4, '<': 4, '<=': 4, '+': 5, '-': 5, '*': 6, '/': 6 };

    const parseExpression = (minPrec = 0) => {
      let node = parseToken();

      while (pos < tokens.length) {
        const currentToken = tokens[pos];
        if (!currentToken || currentToken.type !== this.TOKEN_TYPES.OPERATOR) break;
        const prec = precedence[currentToken.value];
        if (prec === undefined || prec < minPrec) break;
        pos++;
        const right = parseExpression(prec + 1);
        node = { type: 'function', name: opMap[currentToken.value], args: [node, right] };
      }
      return node;
    };

    const parseToken = () => {
      const token = tokens[pos++];
      if (!token) return null;

      if (token.type === this.TOKEN_TYPES.OPERATOR && token.value === '!') {
        const operand = parseToken();
        return { type: 'function', name: '__not', args: [operand] };
      }

      if (token.type === this.TOKEN_TYPES.OPERATOR && token.value === '-') {
        const operand = parseToken();
        return { type: 'function', name: '__neg', args: [operand] };
      }

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
          if (!tokens[pos] || tokens[pos].value !== ')') {
            throw new Error('Missing closing parenthesis');
          }
          pos++; // skip )
          return { type: 'function', name: token.value.toLowerCase(), args };
        }
        return { type: 'variable', name: token.value };
      }

      if (token.value === '(') {
        const node = parseExpression();
        if (!tokens[pos] || tokens[pos].value !== ')') {
          throw new Error('Missing closing parenthesis');
        }
        pos++; // skip )
        return node;
      }
    };

    const result = parseExpression();
    if (pos < tokens.length) {
      throw new Error(`Unexpected token: ${tokens[pos].value}`);
    }
    return result;
  }

  /**
   * Evaluates a formula string and returns the result.
   *
   * @param {string} formula - The formula to evaluate
   * @param {Record<string, *>} [localContext={}] - Variables scoped to this evaluation
   *   (overrides global context for matching keys)
   * @returns {*} The evaluation result
   * @throws {Error} If a referenced variable or function is not found
   *
   * @example
   * evaluator.evaluate('sum(1, 2, 3)');           // 6
   * evaluator.evaluate('x + 1', { x: 10 });       // 11
   */
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
        // iferr requires lazy evaluation: catch errors from the first arg
        if (node.name === 'iferr') {
          try {
            return run(node.args[0]);
          } catch {
            return run(node.args[1]);
          }
        }

        const fn = this._functions.get(node.name);
        if (!fn) throw new Error(`Function "${node.name}" not found`);
        return fn(...node.args.map(run));
      }
    };

    return run(ast);
  }

  /**
   * Returns the variable names referenced in a formula (excludes function names).
   *
   * @param {string} formula - The formula to analyze
   * @returns {string[]} Deduplicated array of variable names
   *
   * @example
   * evaluator.getDependencies('sum(x, y) + z'); // ['x', 'y', 'z']
   */
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
