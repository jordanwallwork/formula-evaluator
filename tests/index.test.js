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
      expect(() => evaluator.tokenize('1 @ 2')).toThrow('Unexpected character');
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

    it('checks inequality (true)', () => {
      expect(evaluator.evaluate('5 != 3')).toBe(true);
    });

    it('checks inequality (false)', () => {
      expect(evaluator.evaluate('5 != 5')).toBe(false);
    });

    it('chains operators with left associativity', () => {
      // 1 + 2 + 3 parses as (1 + 2) + 3 = 6
      expect(evaluator.evaluate('1 + 2 + 3')).toBe(6);
    });

    it('respects multiplication precedence over addition', () => {
      expect(evaluator.evaluate('2 + 3 * 4')).toBe(14);
      expect(evaluator.evaluate('3 * 4 + 2')).toBe(14);
    });

    it('respects division precedence over subtraction', () => {
      expect(evaluator.evaluate('10 - 6 / 2')).toBe(7);
      expect(evaluator.evaluate('6 / 2 - 1')).toBe(2);
    });

    it('left-associative subtraction', () => {
      // 10 - 3 - 2 should be (10 - 3) - 2 = 5, not 10 - (3 - 2) = 9
      expect(evaluator.evaluate('10 - 3 - 2')).toBe(5);
    });

    it('left-associative division', () => {
      // 24 / 4 / 2 should be (24 / 4) / 2 = 3, not 24 / (4 / 2) = 12
      expect(evaluator.evaluate('24 / 4 / 2')).toBe(3);
    });

    it('mixed precedence with multiple operators', () => {
      // 1 + 2 * 3 + 4 = 1 + 6 + 4 = 11
      expect(evaluator.evaluate('1 + 2 * 3 + 4')).toBe(11);
    });

    it('greater than (true)', () => {
      expect(evaluator.evaluate('5 > 3')).toBe(true);
    });

    it('greater than (false)', () => {
      expect(evaluator.evaluate('3 > 5')).toBe(false);
    });

    it('greater than or equal (true - greater)', () => {
      expect(evaluator.evaluate('5 >= 3')).toBe(true);
    });

    it('greater than or equal (true - equal)', () => {
      expect(evaluator.evaluate('5 >= 5')).toBe(true);
    });

    it('greater than or equal (false)', () => {
      expect(evaluator.evaluate('3 >= 5')).toBe(false);
    });

    it('less than (true)', () => {
      expect(evaluator.evaluate('3 < 5')).toBe(true);
    });

    it('less than (false)', () => {
      expect(evaluator.evaluate('5 < 3')).toBe(false);
    });

    it('less than or equal (true - less)', () => {
      expect(evaluator.evaluate('3 <= 5')).toBe(true);
    });

    it('less than or equal (true - equal)', () => {
      expect(evaluator.evaluate('5 <= 5')).toBe(true);
    });

    it('less than or equal (false)', () => {
      expect(evaluator.evaluate('5 <= 3')).toBe(false);
    });

    it('comparison operators work with variables', () => {
      expect(evaluator.evaluate('x > 10', { x: 15 })).toBe(true);
      expect(evaluator.evaluate('x <= 10', { x: 10 })).toBe(true);
    });

    it('comparison operators work inside if()', () => {
      expect(evaluator.evaluate('if(x > 100, "high", "low")', { x: 150 })).toBe('high');
      expect(evaluator.evaluate('if(x < 100, "low", "high")', { x: 50 })).toBe('low');
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

    it('if() does not evaluate the falsy branch when condition is truthy', () => {
      // undefined_var would throw if evaluated; truthy branch should short-circuit
      expect(evaluator.evaluate('if(true, "yes", undefined_var)')).toBe('yes');
    });

    it('if() does not evaluate the truthy branch when condition is falsy', () => {
      // undefined_var would throw if evaluated; falsy branch should short-circuit
      expect(evaluator.evaluate('if(false, undefined_var, "no")')).toBe('no');
    });

    it('if() lazily skips error-producing branches', () => {
      // iferr in the unused branch should never run
      expect(evaluator.evaluate('if(x > 0, x, nonexistent(x))', { x: 5 })).toBe(5);
    });

    it('throws for unknown functions', () => {
      expect(() => evaluator.evaluate('unknown(1)')).toThrow('Function "unknown" not found');
    });
  });

  // --- Evaluate: Utility Functions ---
  describe('evaluate - coalesce', () => {
    it('returns first non-null value', () => {
      expect(evaluator.evaluate('coalesce("hello", "world")')).toBe('hello');
    });

    it('skips null values from context', () => {
      expect(evaluator.evaluate('coalesce(a, "Guest")', { a: null })).toBe('Guest');
    });

    it('skips undefined values from context', () => {
      expect(evaluator.evaluate('coalesce(a, "Guest")', { a: undefined })).toBe('Guest');
    });

    it('returns 0 (not skipped as null)', () => {
      expect(evaluator.evaluate('coalesce(a, 99)', { a: 0 })).toBe(0);
    });

    it('returns false (not skipped as null)', () => {
      expect(evaluator.evaluate('coalesce(a, 99)', { a: false })).toBe(false);
    });

    it('returns empty string (not skipped as null)', () => {
      expect(evaluator.evaluate('coalesce(a, "fallback")', { a: '' })).toBe('');
    });
  });

  describe('evaluate - isblank', () => {
    it('returns true for empty string', () => {
      expect(evaluator.evaluate('isblank("")')).toBe(true);
    });

    it('returns true for null', () => {
      expect(evaluator.evaluate('isblank(a)', { a: null })).toBe(true);
    });

    it('returns true for undefined', () => {
      expect(evaluator.evaluate('isblank(a)', { a: undefined })).toBe(true);
    });

    it('returns false for non-empty string', () => {
      expect(evaluator.evaluate('isblank("hello")')).toBe(false);
    });

    it('returns false for zero', () => {
      expect(evaluator.evaluate('isblank(0)', { })).toBe(false);
    });

    it('returns false for false', () => {
      expect(evaluator.evaluate('isblank(false)')).toBe(false);
    });
  });

  describe('evaluate - and / or', () => {
    it('and() returns true when all truthy', () => {
      expect(evaluator.evaluate('and(true, true, true)')).toBe(true);
    });

    it('and() returns false when one is falsy', () => {
      expect(evaluator.evaluate('and(true, false, true)')).toBe(false);
    });

    it('and() works with expressions', () => {
      expect(evaluator.evaluate('and(x = 1, y = 2)', { x: 1, y: 2 })).toBe(true);
      expect(evaluator.evaluate('and(x = 1, y = 2)', { x: 1, y: 3 })).toBe(false);
    });

    it('or() returns true when any is truthy', () => {
      expect(evaluator.evaluate('or(false, true, false)')).toBe(true);
    });

    it('or() returns false when all falsy', () => {
      expect(evaluator.evaluate('or(false, false, false)')).toBe(false);
    });

    it('or() works with expressions', () => {
      expect(evaluator.evaluate('or(x = 1, x = 2)', { x: 2 })).toBe(true);
      expect(evaluator.evaluate('or(x = 1, x = 2)', { x: 3 })).toBe(false);
    });
  });

  describe('evaluate - iferr', () => {
    it('returns value when no error', () => {
      expect(evaluator.evaluate('iferr(sum(1, 2), 0)')).toBe(3);
    });

    it('returns fallback when first arg throws (undefined variable)', () => {
      expect(evaluator.evaluate('iferr(undefined_var, "fallback")')).toBe('fallback');
    });

    it('returns fallback when first arg throws (unknown function)', () => {
      expect(evaluator.evaluate('iferr(nonexistent(1), 0)')).toBe(0);
    });

    it('returns fallback as expression result', () => {
      expect(evaluator.evaluate('iferr(missing, 1 + 2)')).toBe(3);
    });
  });

  describe('evaluate - round', () => {
    it('rounds to specified decimal places', () => {
      expect(evaluator.evaluate('round(3.14159, 2)')).toBeCloseTo(3.14);
    });

    it('rounds to zero decimal places', () => {
      expect(evaluator.evaluate('round(3.7, 0)')).toBe(4);
    });

    it('rounds half up', () => {
      expect(evaluator.evaluate('round(2.5, 0)')).toBe(3);
    });

    it('rounds negative numbers', () => {
      expect(evaluator.evaluate('round(-2.567, 2)')).toBeCloseTo(-2.57);
    });
  });

  describe('evaluate - clamp', () => {
    it('returns value when within range', () => {
      expect(evaluator.evaluate('clamp(50, 0, 100)')).toBe(50);
    });

    it('clamps to min when below', () => {
      expect(evaluator.evaluate('clamp(-10, 0, 100)')).toBe(0);
    });

    it('clamps to max when above', () => {
      expect(evaluator.evaluate('clamp(150, 0, 100)')).toBe(100);
    });

    it('works with variables', () => {
      expect(evaluator.evaluate('clamp(Score, 0, 100)', { Score: 120 })).toBe(100);
    });
  });

  describe('evaluate - abs', () => {
    it('returns positive number unchanged', () => {
      expect(evaluator.evaluate('abs(5)')).toBe(5);
    });

    it('converts negative to positive', () => {
      expect(evaluator.evaluate('abs(-5)')).toBe(5);
    });

    it('returns zero for zero', () => {
      expect(evaluator.evaluate('abs(0)')).toBe(0);
    });
  });

  describe('evaluate - concat', () => {
    it('concatenates strings', () => {
      expect(evaluator.evaluate('concat("hello", " ", "world")')).toBe('hello world');
    });

    it('concatenates without separator', () => {
      expect(evaluator.evaluate('concat("a", "b", "c")')).toBe('abc');
    });

    it('coerces non-strings', () => {
      expect(evaluator.evaluate('concat("score", 100)')).toBe('score100');
    });

    it('works with variables', () => {
      expect(evaluator.evaluate('concat(first, last)', { first: 'John', last: 'Doe' })).toBe('JohnDoe');
    });
  });

  // --- Evaluate: New Math Functions ---
  describe('evaluate - mean', () => {
    it('returns mean of numbers', () => {
      expect(evaluator.evaluate('mean(2, 4, 6)')).toBe(4);
    });

    it('returns mean of single value', () => {
      expect(evaluator.evaluate('mean(10)')).toBe(10);
    });

    it('avg is alias of mean', () => {
      expect(evaluator.evaluate('avg(2, 4, 6)')).toBe(4);
    });
  });

  describe('evaluate - median', () => {
    it('returns middle value for odd count', () => {
      expect(evaluator.evaluate('median(3, 1, 2)')).toBe(2);
    });

    it('returns average of two middles for even count', () => {
      expect(evaluator.evaluate('median(1, 2, 3, 4)')).toBe(2.5);
    });

    it('returns single value', () => {
      expect(evaluator.evaluate('median(5)')).toBe(5);
    });
  });

  describe('evaluate - mode', () => {
    it('returns most frequent value', () => {
      expect(evaluator.evaluate('mode(1, 2, 2, 3)')).toBe(2);
    });

    it('returns first mode when tied', () => {
      expect(evaluator.evaluate('mode(1, 1, 2, 2, 3)')).toBe(1);
    });
  });

  describe('evaluate - max', () => {
    it('returns largest value', () => {
      expect(evaluator.evaluate('max(1, 5, 3)')).toBe(5);
    });

    it('works with negative numbers', () => {
      expect(evaluator.evaluate('max(-5, -1, -3)')).toBe(-1);
    });
  });

  describe('evaluate - min', () => {
    it('returns smallest value', () => {
      expect(evaluator.evaluate('min(1, 5, 3)')).toBe(1);
    });

    it('works with negative numbers', () => {
      expect(evaluator.evaluate('min(-5, -1, -3)')).toBe(-5);
    });
  });

  describe('evaluate - isnan', () => {
    it('returns true for NaN value', () => {
      expect(evaluator.evaluate('isnan(x)', { x: NaN })).toBe(true);
    });

    it('returns false for number', () => {
      expect(evaluator.evaluate('isnan(5)')).toBe(false);
    });

    it('returns true for non-numeric string', () => {
      expect(evaluator.evaluate('isnan("hello")')).toBe(true);
    });

    it('returns false for numeric string', () => {
      expect(evaluator.evaluate('isnan("42")')).toBe(false);
    });
  });

  // --- Evaluate: New String Functions ---
  describe('evaluate - lower', () => {
    it('converts string to lowercase', () => {
      expect(evaluator.evaluate('lower("HELLO")')).toBe('hello');
    });

    it('coerces non-strings', () => {
      expect(evaluator.evaluate('lower(123)')).toBe('123');
    });
  });

  describe('evaluate - istext', () => {
    it('returns true for string', () => {
      expect(evaluator.evaluate('istext("hello")')).toBe(true);
    });

    it('returns false for number', () => {
      expect(evaluator.evaluate('istext(42)')).toBe(false);
    });

    it('returns false for boolean', () => {
      expect(evaluator.evaluate('istext(true)')).toBe(false);
    });
  });

  describe('evaluate - contains', () => {
    it('returns true when string contains search', () => {
      expect(evaluator.evaluate('contains("hello world", "world")')).toBe(true);
    });

    it('returns false when string does not contain search', () => {
      expect(evaluator.evaluate('contains("hello world", "foo")')).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(evaluator.evaluate('contains("Hello", "hello")')).toBe(false);
    });
  });

  describe('evaluate - replace', () => {
    it('replaces all occurrences', () => {
      expect(evaluator.evaluate('replace("hello world", "o", "0")')).toBe('hell0 w0rld');
    });

    it('replaces substring', () => {
      expect(evaluator.evaluate('replace("foo bar", "foo", "baz")')).toBe('baz bar');
    });
  });

  // --- Evaluate: New Logic Functions ---
  describe('evaluate - not', () => {
    it('negates true', () => {
      expect(evaluator.evaluate('not(true)')).toBe(false);
    });

    it('negates false', () => {
      expect(evaluator.evaluate('not(false)')).toBe(true);
    });

    it('negates truthy value', () => {
      expect(evaluator.evaluate('not(1)')).toBe(false);
    });

    it('negates falsy value', () => {
      expect(evaluator.evaluate('not(0)')).toBe(true);
    });
  });

  // --- Evaluate: New Operators ---
  describe('evaluate - new operators', () => {
    it('multiplication with *', () => {
      expect(evaluator.evaluate('3 * 4')).toBe(12);
    });

    it('division with /', () => {
      expect(evaluator.evaluate('10 / 2')).toBe(5);
    });

    it('logical AND with &', () => {
      expect(evaluator.evaluate('true & true')).toBe(true);
      expect(evaluator.evaluate('true & false')).toBe(false);
    });

    it('logical OR with |', () => {
      expect(evaluator.evaluate('false | true')).toBe(true);
      expect(evaluator.evaluate('false | false')).toBe(false);
    });

    it('logical NOT with !', () => {
      expect(evaluator.evaluate('!true')).toBe(false);
      expect(evaluator.evaluate('!false')).toBe(true);
    });

    it('! works with parenthesized expression', () => {
      expect(evaluator.evaluate('!(1 > 2)')).toBe(true);
    });

    it('unary negation of a number', () => {
      expect(evaluator.evaluate('-5')).toBe(-5);
    });

    it('unary negation of a parenthesized expression', () => {
      expect(evaluator.evaluate('-(3 + 2)')).toBe(-5);
    });

    it('double negation', () => {
      expect(evaluator.evaluate('--5')).toBe(5);
    });

    it('unary negation with a variable', () => {
      expect(evaluator.evaluate('-x', { x: 7 })).toBe(-7);
    });

    it('* and / with variables', () => {
      expect(evaluator.evaluate('x * y', { x: 3, y: 7 })).toBe(21);
      expect(evaluator.evaluate('x / y', { x: 20, y: 4 })).toBe(5);
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

  // --- Evaluate: Parentheses ---
  describe('evaluate - parentheses', () => {
    it('simple grouping', () => {
      expect(evaluator.evaluate('(1 + 2)')).toBe(3);
    });

    it('grouping changes evaluation order', () => {
      // Without parens: 5 - 3 - 1 = (5 - 3) - 1 = 1 (left-associative)
      // With parens: 5 - (3 - 1) = 3
      expect(evaluator.evaluate('5 - (3 - 1)')).toBe(3);
    });

    it('double-nested parentheses', () => {
      expect(evaluator.evaluate('((1 + 2))')).toBe(3);
    });

    it('deep nesting', () => {
      expect(evaluator.evaluate('(((5)))')).toBe(5);
    });

    it('multiple groups', () => {
      expect(evaluator.evaluate('(1 + 2) + (3 + 4)')).toBe(10);
    });

    it('left-nested groups', () => {
      expect(evaluator.evaluate('((1 + 2) + 3) + 4')).toBe(10);
    });

    it('parentheses inside function args', () => {
      expect(evaluator.evaluate('sum((1 + 2), (3 + 4))')).toBe(10);
    });

    it('nested parens with variables', () => {
      expect(evaluator.evaluate('(x + 1) + (y + 2)', { x: 3, y: 4 })).toBe(10);
    });

    it('throws on missing closing parenthesis', () => {
      expect(() => evaluator.evaluate('(1 + 2')).toThrow('Missing closing parenthesis');
    });

    it('throws on extra closing parenthesis', () => {
      expect(() => evaluator.evaluate('1 + 2)')).toThrow('Unexpected token');
    });

    it('throws on empty parentheses', () => {
      expect(() => evaluator.evaluate('()')).toThrow();
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

    it('accepts an optional description', () => {
      evaluator.registerFunction('double', (x) => x * 2, 'Doubles a number');
      const described = evaluator.describeFunctions();
      const entry = described.find(d => d.name === 'double');
      expect(entry).toEqual({ name: 'double', description: 'Doubles a number' });
    });

    it('defaults description to empty string', () => {
      evaluator.registerFunction('double', (x) => x * 2);
      const described = evaluator.describeFunctions();
      const entry = described.find(d => d.name === 'double');
      expect(entry).toEqual({ name: 'double', description: '' });
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
      expect(fns).toContain('coalesce');
      expect(fns).toContain('isblank');
      expect(fns).toContain('and');
      expect(fns).toContain('or');
      expect(fns).toContain('iferr');
      expect(fns).toContain('round');
      expect(fns).toContain('clamp');
      expect(fns).toContain('abs');
      expect(fns).toContain('concat');
    });

    it('excludes internal operator functions', () => {
      const fns = evaluator.listFunctions();
      expect(fns).not.toContain('__add');
      expect(fns).not.toContain('__sub');
      expect(fns).not.toContain('__eq');
      expect(fns).not.toContain('__gt');
      expect(fns).not.toContain('__gte');
      expect(fns).not.toContain('__lt');
      expect(fns).not.toContain('__lte');
    });

    it('includes custom registered functions', () => {
      evaluator.registerFunction('double', (x) => x * 2);
      expect(evaluator.listFunctions()).toContain('double');
    });
  });

  // --- describeFunctions ---
  describe('describeFunctions', () => {
    it('returns names and descriptions for built-in functions', () => {
      const described = evaluator.describeFunctions();
      const sumEntry = described.find(d => d.name === 'sum');
      expect(sumEntry).toEqual({ name: 'sum', description: 'Sums all arguments numerically' });
    });

    it('excludes internal operator functions', () => {
      const described = evaluator.describeFunctions();
      const names = described.map(d => d.name);
      expect(names).not.toContain('__add');
      expect(names).not.toContain('__sub');
      expect(names).not.toContain('__eq');
      expect(names).not.toContain('__gt');
    });

    it('includes custom functions with descriptions', () => {
      evaluator.registerFunction('double', (x) => x * 2, 'Doubles a number');
      const described = evaluator.describeFunctions();
      const entry = described.find(d => d.name === 'double');
      expect(entry).toEqual({ name: 'double', description: 'Doubles a number' });
    });

    it('includes all public built-in functions', () => {
      const described = evaluator.describeFunctions();
      const names = described.map(d => d.name);
      expect(names).toContain('upper');
      expect(names).toContain('join');
      expect(names).toContain('sum');
      expect(names).toContain('avg');
      expect(names).toContain('if');
      expect(names).toContain('coalesce');
      expect(names).toContain('isblank');
      expect(names).toContain('and');
      expect(names).toContain('or');
      expect(names).toContain('iferr');
      expect(names).toContain('round');
      expect(names).toContain('clamp');
      expect(names).toContain('abs');
      expect(names).toContain('concat');
    });

    it('every entry has a non-empty description for built-ins', () => {
      const described = evaluator.describeFunctions();
      for (const { name, description } of described) {
        // Only check built-in functions (not custom ones)
        if (['upper', 'join', 'sum', 'avg', 'if'].includes(name)) {
          expect(description).toBeTruthy();
        }
      }
    });
  });
});

// --- Functions module ---
describe('functions module', () => {
  describe('builtinFunctions', () => {
    it('exports all built-in function definitions', () => {
      const names = [
        'upper', 'join', 'sum', 'avg', 'if', 'coalesce', 'isblank',
        'and', 'or', 'iferr', 'round', 'clamp', 'abs', 'concat',
        '__add', '__sub', '__eq', '__neq', '__gt', '__gte', '__lt', '__lte',
      ];
      for (const name of names) {
        expect(builtinFunctions).toHaveProperty(name);
      }
    });

    it('each entry has fn and description properties', () => {
      for (const [name, def] of Object.entries(builtinFunctions)) {
        expect(typeof def.fn).toBe('function');
        expect(typeof def.description).toBe('string');
      }
    });

    it('public functions have non-empty descriptions', () => {
      for (const [name, def] of Object.entries(builtinFunctions)) {
        if (!name.startsWith('__')) {
          expect(def.description.length).toBeGreaterThan(0);
        }
      }
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

    it('accepts initial extra functions (plain functions)', () => {
      const registry = createFunctionRegistry({ double: (x) => x * 2 });
      expect(registry.has('double')).toBe(true);
      expect(registry.get('double')(5)).toBe(10);
    });

    it('register adds a new function', () => {
      const registry = createFunctionRegistry();
      registry.register('triple', (x) => x * 3);
      expect(registry.get('triple')(4)).toBe(12);
    });

    it('register accepts a description', () => {
      const registry = createFunctionRegistry();
      registry.register('triple', (x) => x * 3, 'Triples a number');
      const entry = registry.describe().find(d => d.name === 'triple');
      expect(entry).toEqual({ name: 'triple', description: 'Triples a number' });
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

    it('describe returns names and descriptions for public functions', () => {
      const registry = createFunctionRegistry();
      const described = registry.describe();
      const sumEntry = described.find(d => d.name === 'sum');
      expect(sumEntry).toEqual({ name: 'sum', description: 'Sums all arguments numerically' });
      // Should not include operators
      const names = described.map(d => d.name);
      expect(names).not.toContain('__add');
    });

    it('describe includes custom functions', () => {
      const registry = createFunctionRegistry();
      registry.register('double', (x) => x * 2, 'Doubles a number');
      const described = registry.describe();
      const entry = described.find(d => d.name === 'double');
      expect(entry).toEqual({ name: 'double', description: 'Doubles a number' });
    });

    it('getAll returns a snapshot of all function definitions', () => {
      const registry = createFunctionRegistry();
      const all = registry.getAll();
      expect(all).toHaveProperty('sum');
      expect(all.sum).toHaveProperty('fn');
      expect(all.sum).toHaveProperty('description');
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
