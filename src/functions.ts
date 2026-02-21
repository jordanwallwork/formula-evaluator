export type FormulaFunction = (...args: any[]) => any;

export interface FunctionDef {
  fn: FormulaFunction;
  description: string;
}

export interface FunctionRegistry {
  register(name: string, fn: FormulaFunction, description?: string): void;
  get(name: string): FormulaFunction | undefined;
  has(name: string): boolean;
  unregister(name: string): boolean;
  list(): string[];
  describe(): Array<{ name: string; description: string }>;
  getAll(): Record<string, FunctionDef>;
}

export const builtinFunctions: Readonly<Record<string, FunctionDef>> = Object.freeze({
  upper: {
    fn: (str: any) => String(str).toUpperCase(),
    description: 'Converts a value to an uppercase string',
  },

  join: {
    fn: (sep: any, ...args: any[]) => args.join(sep),
    description: 'Joins arguments with a separator',
  },

  sum: {
    fn: (...args: any[]) => args.reduce((a, b) => Number(a) + Number(b), 0),
    description: 'Sums all arguments numerically',
  },

  avg: {
    get fn(): FormulaFunction { return builtinFunctions.mean.fn; },
    description: 'Alias for mean. Returns the arithmetic mean of all arguments',
  },

  if: {
    fn: (cond: any, a: any, b: any) => (cond ? a : b),
    description: 'Returns the second argument if the condition is truthy, otherwise the third',
  },

  coalesce: {
    fn: (...args: any[]) => args.find(a => a != null),
    description: 'Returns the first non-null/non-undefined value',
  },

  isblank: {
    fn: (val: any) => val === '' || val == null,
    description: 'Returns true if a value is an empty string or null/undefined',
  },

  and: {
    fn: (...args: any[]) => args.every(Boolean),
    description: 'Returns true if all arguments are truthy',
  },

  or: {
    fn: (...args: any[]) => args.some(Boolean),
    description: 'Returns true if any argument is truthy',
  },

  iferr: {
    fn: (val: any) => val,
    description: 'Returns the first argument, or the second if the first throws an error',
  },

  round: {
    fn: (n: any, d: any) => Number(Math.round(Number(n + 'e' + d)) + 'e-' + d),
    description: 'Rounds a number to a specific decimal precision',
  },

  clamp: {
    fn: (val: number, min: number, max: number) => Math.min(Math.max(val, min), max),
    description: 'Restricts a number to a given range',
  },

  abs: {
    fn: (n: number) => Math.abs(n),
    description: 'Returns the absolute value of a number',
  },

  mean: {
    fn: (...args: any[]) => args.reduce((a, b) => Number(a) + Number(b), 0) / args.length,
    description: 'Returns the arithmetic mean of all arguments',
  },

  median: {
    fn: (...args: number[]) => {
      const sorted = [...args].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },
    description: 'Returns the median of all arguments',
  },

  mode: {
    fn: (...args: any[]) => {
      const freq: Record<string, number> = {};
      for (const v of args) freq[v] = (freq[v] || 0) + 1;
      let maxCount = 0, result: string | undefined;
      for (const [val, count] of Object.entries(freq)) {
        if (count > maxCount) { maxCount = count; result = val; }
      }
      return Number(result);
    },
    description: 'Returns the most frequently occurring value',
  },

  max: {
    fn: (...args: number[]) => args.reduce((a, b) => a > b ? a : b, -Infinity),
    description: 'Returns the largest of all arguments',
  },

  min: {
    fn: (...args: number[]) => args.reduce((a, b) => a < b ? a : b, Infinity),
    description: 'Returns the smallest of all arguments',
  },

  isnan: {
    fn: (val: any) => Number.isNaN(Number(val)),
    description: 'Returns true if the value is NaN',
  },

  lower: {
    fn: (str: any) => String(str).toLowerCase(),
    description: 'Converts a value to a lowercase string',
  },

  istext: {
    fn: (val: any) => typeof val === 'string',
    description: 'Returns true if the value is a string',
  },

  contains: {
    fn: (str: any, search: any) => String(str).includes(String(search)),
    description: 'Returns true if the string contains the search value',
  },

  replace: {
    fn: (str: any, search: any, replacement: any) => String(str).replaceAll(String(search), String(replacement)),
    description: 'Replaces all occurrences of a search value with a replacement',
  },

  not: {
    get fn(): FormulaFunction { return builtinFunctions.__not.fn; },
    description: 'Returns the logical negation of a value',
  },

  concat: {
    fn: (...args: any[]) => args.join(''),
    description: 'Concatenates all arguments without a separator',
  },

  __add: {
    fn: (a: any, b: any) => a + b,
    description: 'Addition operator',
  },

  __sub: {
    fn: (a: number, b: number) => a - b,
    description: 'Subtraction operator',
  },

  __eq: {
    fn: (a: any, b: any) => a === b,
    description: 'Equality operator',
  },

  __neq: {
    fn: (a: any, b: any) => a !== b,
    description: 'Not-equal operator',
  },

  __gt: {
    fn: (a: any, b: any) => a > b,
    description: 'Greater-than operator',
  },

  __gte: {
    fn: (a: any, b: any) => a >= b,
    description: 'Greater-than-or-equal operator',
  },

  __lt: {
    fn: (a: any, b: any) => a < b,
    description: 'Less-than operator',
  },

  __lte: {
    fn: (a: any, b: any) => a <= b,
    description: 'Less-than-or-equal operator',
  },

  __mul: {
    fn: (a: number, b: number) => a * b,
    description: 'Multiplication operator',
  },

  __div: {
    fn: (a: number, b: number) => a / b,
    description: 'Division operator',
  },

  __and: {
    fn: (a: any, b: any) => a && b,
    description: 'Logical AND operator',
  },

  __or: {
    fn: (a: any, b: any) => a || b,
    description: 'Logical OR operator',
  },

  __not: {
    fn: (a: any) => !a,
    description: 'Logical NOT operator',
  },

  __neg: {
    fn: (a: number) => -a,
    description: 'Unary negation operator',
  },
});

export function createFunctionRegistry(initialFunctions: Record<string, FormulaFunction | FunctionDef> = {}): FunctionRegistry {
  const functions: Record<string, FunctionDef> = { ...builtinFunctions };

  for (const [name, val] of Object.entries(initialFunctions)) {
    functions[name.toLowerCase()] = typeof val === 'function'
      ? { fn: val, description: '' }
      : { ...val };
  }

  return {
    register(name: string, fn: FormulaFunction, description = '') {
      if (typeof name !== 'string' || !name) {
        throw new Error('Function name must be a non-empty string');
      }
      if (typeof fn !== 'function') {
        throw new Error('Function implementation must be a function');
      }
      functions[name.toLowerCase()] = { fn, description };
    },

    get(name: string) {
      return functions[name.toLowerCase()]?.fn;
    },

    has(name: string) {
      return name.toLowerCase() in functions;
    },

    unregister(name: string) {
      const lower = name.toLowerCase();
      if (lower in builtinFunctions) {
        throw new Error(`Cannot unregister built-in function "${name}"`);
      }
      return delete functions[lower];
    },

    list() {
      return Object.keys(functions).filter(name => !name.startsWith('__'));
    },

    describe() {
      return Object.entries(functions)
        .filter(([name]) => !name.startsWith('__'))
        .map(([name, { description }]) => ({ name, description }));
    },

    getAll() {
      return { ...functions };
    },
  };
}
