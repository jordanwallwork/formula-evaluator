import { createFunctionRegistry, FunctionRegistry } from './functions.js';

export { builtinFunctions, createFunctionRegistry } from './functions.js';
export type { FormulaFunction, FunctionDef, FunctionRegistry } from './functions.js';

const TOKEN_TYPES = Object.freeze({
  NUMBER: 'number',
  STRING: 'string',
  IDENTIFIER: 'identifier',
  OPERATOR: 'operator',
  DELIMITER: 'delimiter',
  WHITESPACE: 'whitespace',
} as const);

type TokenType = typeof TOKEN_TYPES[keyof typeof TOKEN_TYPES];

interface TokenRule {
  type: TokenType;
  regex: RegExp;
}

const TOKEN_RULES: TokenRule[] = [
  { type: TOKEN_TYPES.STRING,     regex: /"([^"]*)"/g },
  { type: TOKEN_TYPES.NUMBER,     regex: /\d*\.?\d+/g },
  { type: TOKEN_TYPES.IDENTIFIER, regex: /[a-zA-Z][\w\d]*/g },
  { type: TOKEN_TYPES.OPERATOR,   regex: /!=|>=|<=|[+=\-><&|/*!/]/g },
  { type: TOKEN_TYPES.DELIMITER,  regex: /[(),]/g },
  { type: TOKEN_TYPES.WHITESPACE, regex: /\s+/g },
];

interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

interface FunctionNode {
  type: 'function';
  name: string;
  args: ASTNode[];
}

interface VariableNode {
  type: 'variable';
  name: string;
}

type ASTNode = FunctionNode | VariableNode | number | string | boolean | null;

const OP_MAP: Record<string, string> = { '+': '__add', '-': '__sub', '=': '__eq', '!=': '__neq', '>': '__gt', '>=': '__gte', '<': '__lt', '<=': '__lte', '*': '__mul', '/': '__div', '&': '__and', '|': '__or' };
const OP_PRECEDENCE: Record<string, number> = { '|': 1, '&': 2, '=': 3, '!=': 3, '>': 4, '>=': 4, '<': 4, '<=': 4, '+': 5, '-': 5, '*': 6, '/': 6 };

class FormulaEvaluator {
  static TOKEN_TYPES = TOKEN_TYPES;

  context: Record<string, any>;
  private _functions: FunctionRegistry;

  constructor(globalContext: Record<string, any> = {}) {
    this.context = globalContext;
    this._functions = createFunctionRegistry();
  }

  registerFunction(name: string, fn: (...args: any[]) => any, description = ''): this {
    this._functions.register(name, fn, description);
    return this;
  }

  listFunctions(): string[] {
    return this._functions.list();
  }

  describeFunctions(): Array<{ name: string; description: string }> {
    return this._functions.describe();
  }

  tokenize(str: string): Token[] {
    if (typeof str !== 'string') {
      throw new TypeError(`Expected a string, got ${str === null ? 'null' : typeof str}`);
    }
    const tokens: Token[] = [];

    let pos = 0;
    while (pos < str.length) {
      let found = false;
      for (const { type, regex } of TOKEN_RULES) {
        regex.lastIndex = pos;
        const match = regex.exec(str);
        if (match && match.index === pos) {
          if (type !== TOKEN_TYPES.WHITESPACE) {
            tokens.push({
              type,
              value: type === TOKEN_TYPES.STRING ? match[1] : match[0],
              start: pos,
              end: pos + match[0].length,
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

  parse(tokens: Token[]): ASTNode {
    let pos = 0;

    const parseExpression = (minPrec = 0): ASTNode => {
      let node = parseToken();

      while (pos < tokens.length) {
        const currentToken = tokens[pos];
        if (!currentToken || currentToken.type !== TOKEN_TYPES.OPERATOR) break;
        const prec = OP_PRECEDENCE[currentToken.value];
        if (prec === undefined || prec < minPrec) break;
        pos++;
        const right = parseExpression(prec + 1);
        node = { type: 'function', name: OP_MAP[currentToken.value], args: [node, right] };
      }
      return node;
    };

    const parseToken = (): ASTNode => {
      const token = tokens[pos++];
      if (!token) return null;

      if (token.type === TOKEN_TYPES.OPERATOR && token.value === '!') {
        const operand = parseToken();
        return { type: 'function', name: '__not', args: [operand] };
      }

      if (token.type === TOKEN_TYPES.OPERATOR && token.value === '-') {
        const operand = parseToken();
        return { type: 'function', name: '__neg', args: [operand] };
      }

      if (token.type === TOKEN_TYPES.NUMBER) return parseFloat(token.value);
      if (token.value === 'true') return true;
      if (token.value === 'false') return false;
      if (token.type === TOKEN_TYPES.STRING) return token.value;

      if (token.type === TOKEN_TYPES.IDENTIFIER) {
        const nextToken = tokens[pos];
        if (nextToken && nextToken.value === '(') {
          pos++; // skip (
          const args: ASTNode[] = [];
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

      return null;
    };

    const result = parseExpression();
    if (pos < tokens.length) {
      throw new Error(`Unexpected token: ${tokens[pos].value}`);
    }
    return result;
  }

  evaluate(formula: string, localContext: Record<string, any> = {}): any {
    const ast = this.parse(this.tokenize(formula));
    const ctx = Object.assign(Object.create(this.context), localContext);

    const run = (node: ASTNode): any => {
      if (typeof node !== 'object' || node === null) return node;

      if (node.type === 'variable') {
        if (!(node.name in ctx)) throw new Error(`Variable "${node.name}" not found`);
        return ctx[node.name];
      }

      if (node.type === 'function') {
        // if() requires lazy evaluation: only evaluate the chosen branch
        if (node.name === 'if') {
          const cond = run(node.args[0]);
          return cond ? run(node.args[1]) : run(node.args[2]);
        }

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

  getDependencies(formula: string): string[] {
    const ast = this.parse(this.tokenize(formula));
    const deps = new Set<string>();
    const walk = (node: ASTNode): void => {
      if (typeof node !== 'object' || node === null) return;
      if (node.type === 'variable') deps.add(node.name);
      else if (node.type === 'function') node.args.forEach(walk);
    };
    walk(ast);
    return Array.from(deps);
  }
}

export default FormulaEvaluator;
