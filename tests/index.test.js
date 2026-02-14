import { describe, it, expect, beforeEach } from 'vitest';
import FormulaEvaluator, { builtinFunctions, createFunctionRegistry } from '../src/index.js';

describe('FormulaEvaluator', () => {
  let evaluator;

  beforeEach(() => {
    evaluator = new FormulaEvaluator();
  });

  // --- Tokenizer ---
  describe('tokenize', () => {
    it('tokenizes numbers', () => {
      const tokens = evaluator.tokenize('42');
      expect(tokens).toEqual([
        { type: 'number', value: '42', start: 0, end: 2 },
      ]);
    });

    it('tokenizes decimal numbers', () => {
      const tokens = evaluator.tokenize('3.14');
      expect(tokens).toEqual([
        { type: 'number', value: '3.14', start: 0, end: 4 },
      ]);
    });

    it('tokenizes strings', () => {
      const tokens = evaluator.tokenize('"hello"');
      expect(tokens).toEqual([
        { type: 'string', value: 'hello', start: 0, end: 7 },
      ]);
    });

    it('tokenizes identifiers', () => {
      const tokens = evaluator.tokenize('foo');
      expect(tokens).toEqual([
        { type: 'identifier', value: 'foo', start: 0, end: 3 },
      ]);
    });

    it('tokenizes operators', () => {
      const tokens = evaluator.tokenize('1 + 2');
      expect(tokens).toHaveLength(3);
      expect(tokens[1]).toMatchObject({ type: 'operator', value: '+' });
    });

    it('tokenizes delimiters', () => {
      const tokens = evaluator.tokenize('sum(1, 2)');
      expect(tokens.filter(t => t.type === 'delimiter')).toHaveLength(3); // ( , )
    });

    it('skips whitespace', () => {
      const tokens = evaluator.tokenize('  42  ');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].value).toBe('42');
    });

    it('tokenizes a complex expression', () => {
      const tokens = evaluator.tokenize('sum(x, 10) + 5');
      const types = tokens.map(t => t.type);
      expect(types).toEqual([
        'identifier', 'delimiter', 'identifier', 'delimiter',
        'number', 'delimiter', 'operator', 'number',
      ]);
    });

    it('throws on unexpected characters', () => {
      expect(() => evaluator.tokenize('1 & 2')).toThrow('Unexpected character');
    });
  });

  // --- Parser ---
  describe('parse', () => {
    it('parses a number literal', () => {
      const ast = evaluator.parse(evaluator.tokenize('42'));
      expect(ast).toBe(42);
    });

    it('parses a decimal number', () => {
      const ast = evaluator.parse(evaluator.tokenize('3.14'));
      expect(ast).toBeCloseTo(3.14);
    });

    it('parses a string literal', () => {
      const ast = evaluator.parse(evaluator.tokenize('"hello"'));
      expect(ast).toBe('hello');
    });

    it('parses boolean true', () => {
      const ast = evaluator.parse(evaluator.tokenize('true'));
      expect(ast).toBe(true);
    });

    it('parses boolean false', () => {
      const ast = evaluator.parse(evaluator.tokenize('false'));
      expect(ast).toBe(false);
    });

    it('parses a variable reference', () => {
      const ast = evaluator.parse(evaluator.tokenize('x'));
      expect(ast).toEqual({ type: 'variable', name: 'x' });
    });

    it('parses a function call', () => {
      const ast = evaluator.parse(evaluator.tokenize('sum(1, 2)'));
      expect(ast).toEqual({ type: 'function', name: 'sum', args: [1, 2] });
    });

    it('parses an operator as a function node', () => {
      const ast = evaluator.parse(evaluator.tokenize('1 + 2'));
      expect(ast).toEqual({ type: 'function', name: '__add', args: [1, 2] });
    });

    it('parses nested function calls', () => {
      const ast = evaluator.parse(evaluator.tokenize('sum(sum(1, 2), 3)'));
      expect(ast).toEqual({
        type: 'function',
        name: 'sum',
        args: [
          { type: 'function', name: 'sum', args: [1, 2] },
          3,
        ],
      });
    });

    it('parses parenthesized expressions', () => {
      const ast = evaluator.parse(evaluator.tokenize('(1 + 2)'));
      expect(ast).toEqual({ type: 'function', name: '__add', args: [1, 2] });
    });
  });

  // --- Evaluate: Literals ---
  describe('evaluate - literals', () => {
    it('evaluates a number', () => {
      expect(evaluator.evaluate('42')).toBe(42);
    });

    it('evaluates a decimal number', () => {
      expect(evaluator.evaluate('0.5')).toBeCloseTo(0.5);
    });

    it('evaluates a string', () => {
      expect(evaluator.evaluate('"hello"')).toBe('hello');
    });

    it('evaluates boolean true', () => {
      expect(evaluator.evaluate('true')).toBe(true);
    });

    it('evaluates boolean false', () => {
      expect(evaluator.evaluate('false')).toBe(false);
    });
  });

  // --- Evaluate: Operators ---
  describe('evaluate - operators', () => {
    it('adds two numbers', () => {
      expect(evaluator.evaluate('1 + 2')).toBe(3);
    });

    it('subtracts two numbers', () => {
      expect(evaluator.evaluate('5 - 3')).toBe(2);
    });

    it('checks equality (true)', () => {
      expect(evaluator.evaluate('5 = 5')).toBe(true);
    });

    it('checks equality (false)', () => {
      expect(evaluator.evaluate('5 = 3')).toBe(false);
    });

    it('chains operators with right associativity', () => {
      // 1 + 2 + 3 parses as 1 + (2 + 3) = 6
      expect(evaluator.evaluate('1 + 2 + 3')).toBe(6);
    });
  });

  // --- Evaluate: Variables ---
  describe('evaluate - variables', () => {
    it('resolves a variable from global context', () => {
      const ev = new FormulaEvaluator({ x: 10 });
      expect(ev.evaluate('x')).toBe(10);
    });

    it('resolves a variable from local context', () => {
      expect(evaluator.evaluate('x', { x: 7 })).toBe(7);
    });

    it('local context overrides global context', () => {
      const ev = new FormulaEvaluator({ x: 1 });
      expect(ev.evaluate('x', { x: 99 })).toBe(99);
    });

    it('throws for undefined variables', () => {
      expect(() => evaluator.evaluate('unknown')).toThrow('Variable "unknown" not found');
    });

    it('uses variables inside expressions', () => {
      expect(evaluator.evaluate('x + 1', { x: 10 })).toBe(11);
    });
  });

  // --- Evaluate: Built-in Functions ---
  describe('evaluate - functions', () => {
    it('upper() converts string to uppercase', () => {
      expect(evaluator.evaluate('upper("hello")')).toBe('HELLO');
    });

    it('upper() coerces non-strings', () => {
      expect(evaluator.evaluate('upper(123)')).toBe('123');
    });

    it('join() joins arguments with separator', () => {
      expect(evaluator.evaluate('join("-", "a", "b", "c")')).toBe('a-b-c');
    });

    it('sum() adds numbers', () => {
      expect(evaluator.evaluate('sum(1, 2, 3)')).toBe(6);
    });

    it('sum() with single argument', () => {
      expect(evaluator.evaluate('sum(5)')).toBe(5);
    });

    it('avg() computes average', () => {
      expect(evaluator.evaluate('avg(2, 4, 6)')).toBe(4);
    });

    it('if() returns truthy branch', () => {
      expect(evaluator.evaluate('if(true, "yes", "no")')).toBe('yes');
    });

    it('if() returns falsy branch', () => {
      expect(evaluator.evaluate('if(false, "yes", "no")')).toBe('no');
    });

    it('throws for unknown functions', () => {
      expect(() => evaluator.evaluate('unknown(1)')).toThrow('Function "unknown" not found');
    });
  });

  // --- Evaluate: Nested / Complex ---
  describe('evaluate - nested and complex expressions', () => {
    it('nested function calls', () => {
      expect(evaluator.evaluate('sum(sum(1, 2), sum(3, 4))')).toBe(10);
    });

    it('function with operator arguments', () => {
      expect(evaluator.evaluate('sum(1 + 2, 3 + 4)')).toBe(10);
    });

    it('operator with function arguments', () => {
      expect(evaluator.evaluate('sum(1, 2) + sum(3, 4)')).toBe(10);
    });

    it('if with equality check', () => {
      expect(evaluator.evaluate('if(x = 1, "one", "other")', { x: 1 })).toBe('one');
      expect(evaluator.evaluate('if(x = 1, "one", "other")', { x: 2 })).toBe('other');
    });

    it('upper with join', () => {
      expect(evaluator.evaluate('upper(join(" ", "hello", "world"))')).toBe('HELLO WORLD');
    });

    it('variables inside function arguments', () => {
      expect(evaluator.evaluate('sum(x, y)', { x: 3, y: 7 })).toBe(10);
    });

    it('parenthesized sub-expression', () => {
      expect(evaluator.evaluate('(1 + 2) + 3')).toBe(6);
    });
  });

  // --- getDependencies ---
  describe('getDependencies', () => {
    it('returns empty array for literals', () => {
      expect(evaluator.getDependencies('42')).toEqual([]);
    });

    it('returns a single variable', () => {
      expect(evaluator.getDependencies('x')).toEqual(['x']);
    });

    it('returns variables from an expression', () => {
      const deps = evaluator.getDependencies('x + y');
      expect(deps).toContain('x');
      expect(deps).toContain('y');
      expect(deps).toHaveLength(2);
    });

    it('returns variables from function arguments', () => {
      const deps = evaluator.getDependencies('sum(a, b, c)');
      expect(deps).toEqual(expect.arrayContaining(['a', 'b', 'c']));
      expect(deps).toHaveLength(3);
    });

    it('deduplicates repeated variables', () => {
      const deps = evaluator.getDependencies('x + x');
      expect(deps).toEqual(['x']);
    });

    it('returns variables from nested functions', () => {
      const deps = evaluator.getDependencies('sum(x, avg(y, z))');
      expect(deps).toEqual(expect.arrayContaining(['x', 'y', 'z']));
      expect(deps).toHaveLength(3);
    });

    it('does not include function names as dependencies', () => {
      const deps = evaluator.getDependencies('sum(1, 2)');
      expect(deps).toEqual([]);
    });
  });

  // --- registerFunction ---
  describe('registerFunction', () => {
    it('registers and evaluates a custom function', () => {
      evaluator.registerFunction('double', (x) => x * 2);
      expect(evaluator.evaluate('double(5)')).toBe(10);
    });

    it('supports chaining', () => {
      evaluator
        .registerFunction('double', (x) => x * 2)
        .registerFunction('inc', (x) => x + 1);
      expect(evaluator.evaluate('inc(double(3))')).toBe(7);
    });

    it('custom functions work with variables', () => {
      evaluator.registerFunction('double', (x) => x * 2);
      expect(evaluator.evaluate('double(n)', { n: 4 })).toBe(8);
    });

    it('custom functions work with operators', () => {
      evaluator.registerFunction('double', (x) => x * 2);
      expect(evaluator.evaluate('double(3) + 1')).toBe(7);
    });

    it('can override a built-in function', () => {
      evaluator.registerFunction('sum', (a, b) => a + b + 100);
      expect(evaluator.evaluate('sum(1, 2)')).toBe(103);
    });

    it('throws if name is not a string', () => {
      expect(() => evaluator.registerFunction(123, () => {})).toThrow(
        'Function name must be a non-empty string'
      );
    });

    it('throws if name is empty', () => {
      expect(() => evaluator.registerFunction('', () => {})).toThrow(
        'Function name must be a non-empty string'
      );
    });

    it('throws if fn is not a function', () => {
      expect(() => evaluator.registerFunction('bad', 'not a fn')).toThrow(
        'Function implementation must be a function'
      );
    });

    it('does not affect other evaluator instances', () => {
      evaluator.registerFunction('double', (x) => x * 2);
      const other = new FormulaEvaluator();
      expect(() => other.evaluate('double(5)')).toThrow('Function "double" not found');
    });
  });

  // --- listFunctions ---
  describe('listFunctions', () => {
    it('includes built-in public functions', () => {
      const fns = evaluator.listFunctions();
      expect(fns).toContain('upper');
      expect(fns).toContain('join');
      expect(fns).toContain('sum');
      expect(fns).toContain('avg');
      expect(fns).toContain('if');
    });

    it('excludes internal operator functions', () => {
      const fns = evaluator.listFunctions();
      expect(fns).not.toContain('__add');
      expect(fns).not.toContain('__sub');
      expect(fns).not.toContain('__eq');
    });

    it('includes custom registered functions', () => {
      evaluator.registerFunction('double', (x) => x * 2);
      expect(evaluator.listFunctions()).toContain('double');
    });
  });
});

// --- Functions module ---
describe('functions module', () => {
  describe('builtinFunctions', () => {
    it('exports all built-in functions', () => {
      expect(builtinFunctions).toHaveProperty('upper');
      expect(builtinFunctions).toHaveProperty('join');
      expect(builtinFunctions).toHaveProperty('sum');
      expect(builtinFunctions).toHaveProperty('avg');
      expect(builtinFunctions).toHaveProperty('if');
      expect(builtinFunctions).toHaveProperty('__add');
      expect(builtinFunctions).toHaveProperty('__sub');
      expect(builtinFunctions).toHaveProperty('__eq');
    });

    it('is frozen (immutable)', () => {
      expect(Object.isFrozen(builtinFunctions)).toBe(true);
    });
  });

  describe('createFunctionRegistry', () => {
    it('creates a registry with built-in functions', () => {
      const registry = createFunctionRegistry();
      expect(registry.has('sum')).toBe(true);
      expect(registry.get('sum')(1, 2, 3)).toBe(6);
    });

    it('accepts initial extra functions', () => {
      const registry = createFunctionRegistry({ double: (x) => x * 2 });
      expect(registry.has('double')).toBe(true);
      expect(registry.get('double')(5)).toBe(10);
    });

    it('register adds a new function', () => {
      const registry = createFunctionRegistry();
      registry.register('triple', (x) => x * 3);
      expect(registry.get('triple')(4)).toBe(12);
    });

    it('has returns false for unknown functions', () => {
      const registry = createFunctionRegistry();
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('get returns undefined for unknown functions', () => {
      const registry = createFunctionRegistry();
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('unregister removes a custom function', () => {
      const registry = createFunctionRegistry({ custom: () => 1 });
      registry.unregister('custom');
      expect(registry.has('custom')).toBe(false);
    });

    it('unregister throws for built-in functions', () => {
      const registry = createFunctionRegistry();
      expect(() => registry.unregister('sum')).toThrow(
        'Cannot unregister built-in function "sum"'
      );
    });

    it('list returns public function names', () => {
      const registry = createFunctionRegistry({ double: (x) => x * 2 });
      const names = registry.list();
      expect(names).toContain('upper');
      expect(names).toContain('double');
      expect(names).not.toContain('__add');
    });

    it('getAll returns a snapshot of all functions', () => {
      const registry = createFunctionRegistry();
      const all = registry.getAll();
      expect(all).toHaveProperty('sum');
      expect(all).toHaveProperty('__add');
      // Modifying snapshot does not affect registry
      delete all.sum;
      expect(registry.has('sum')).toBe(true);
    });

    it('each registry instance is independent', () => {
      const a = createFunctionRegistry();
      const b = createFunctionRegistry();
      a.register('only_in_a', () => 'a');
      expect(a.has('only_in_a')).toBe(true);
      expect(b.has('only_in_a')).toBe(false);
    });
  });
});
