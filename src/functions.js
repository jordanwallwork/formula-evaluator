/**
 * @module functions
 * Built-in function library and registry for the formula evaluator.
 */

/**
 * A function that can be called during formula evaluation.
 * @callback FormulaFunction
 * @param {...*} args - Evaluated arguments from the formula
 * @returns {*} The computed result
 */

/**
 * A function definition containing the implementation and a human-readable description.
 * @typedef {Object} FunctionDef
 * @property {FormulaFunction} fn - The function implementation
 * @property {string} description - A human-readable description of what the function does
 */

/**
 * Built-in functions included in every new evaluator instance.
 * Each entry contains a `fn` implementation and a human-readable `description`.
 * @type {Readonly<Record<string, FunctionDef>>}
 */
export const builtinFunctions = Object.freeze({
  upper: {
    fn: (str) => String(str).toUpperCase(),
    description: 'Converts a value to an uppercase string',
  },

  join: {
    fn: (sep, ...args) => args.join(sep),
    description: 'Joins arguments with a separator',
  },

  sum: {
    fn: (...args) => args.reduce((a, b) => Number(a) + Number(b), 0),
    description: 'Sums all arguments numerically',
  },

  avg: {
    fn: (...args) => args.reduce((a, b) => a + b, 0) / args.length,
    description: 'Returns the arithmetic mean of all arguments',
  },

  if: {
    fn: (cond, a, b) => (cond ? a : b),
    description: 'Returns the second argument if the condition is truthy, otherwise the third',
  },

  coalesce: {
    fn: (...args) => args.find(a => a != null),
    description: 'Returns the first non-null/non-undefined value',
  },

  isblank: {
    fn: (val) => val === '' || val == null,
    description: 'Returns true if a value is an empty string or null/undefined',
  },

  and: {
    fn: (...args) => args.every(Boolean),
    description: 'Returns true if all arguments are truthy',
  },

  or: {
    fn: (...args) => args.some(Boolean),
    description: 'Returns true if any argument is truthy',
  },

  iferr: {
    fn: (val) => val,
    description: 'Returns the first argument, or the second if the first throws an error',
  },

  round: {
    fn: (n, d) => Number(Math.round(n + 'e' + d) + 'e-' + d),
    description: 'Rounds a number to a specific decimal precision',
  },

  clamp: {
    fn: (val, min, max) => Math.min(Math.max(val, min), max),
    description: 'Restricts a number to a given range',
  },

  abs: {
    fn: (n) => Math.abs(n),
    description: 'Returns the absolute value of a number',
  },

  concat: {
    fn: (...args) => args.join(''),
    description: 'Concatenates all arguments without a separator',
  },

  /** @private */
  __add: {
    fn: (a, b) => a + b,
    description: 'Addition operator',
  },

  /** @private */
  __sub: {
    fn: (a, b) => a - b,
    description: 'Subtraction operator',
  },

  /** @private */
  __eq: {
    fn: (a, b) => a === b,
    description: 'Equality operator',
  },

  /** @private */
  __gt: {
    fn: (a, b) => a > b,
    description: 'Greater-than operator',
  },

  /** @private */
  __gte: {
    fn: (a, b) => a >= b,
    description: 'Greater-than-or-equal operator',
  },

  /** @private */
  __lt: {
    fn: (a, b) => a < b,
    description: 'Less-than operator',
  },

  /** @private */
  __lte: {
    fn: (a, b) => a <= b,
    description: 'Less-than-or-equal operator',
  },
});

/**
 * @typedef {Object} FunctionRegistry
 * @property {(name: string, fn: FormulaFunction, description?: string) => void} register - Register a new function
 * @property {(name: string) => FormulaFunction|undefined} get - Retrieve a function by name
 * @property {(name: string) => boolean} has - Check whether a function is registered
 * @property {(name: string) => boolean} unregister - Remove a custom (non-built-in) function
 * @property {() => string[]} list - List public function names (excludes internal __ operators)
 * @property {() => Array<{name: string, description: string}>} describe - List public function names and descriptions
 * @property {() => Record<string, FunctionDef>} getAll - Get a snapshot of all registered function definitions
 */

/**
 * Creates a function registry pre-loaded with the built-in functions.
 *
 * Use this to build a standalone registry, or let {@link FormulaEvaluator}
 * create one automatically via its constructor.
 *
 * @param {Record<string, FormulaFunction>} [initialFunctions={}] - Extra functions to register on creation
 * @returns {FunctionRegistry} A new registry instance
 *
 * @example
 * import { createFunctionRegistry } from 'formula-evaluator/functions';
 *
 * const registry = createFunctionRegistry({
 *   double: (x) => x * 2,
 * });
 * registry.register('triple', (x) => x * 3, 'Triples a number');
 * registry.get('double')(5); // 10
 * registry.list(); // ['upper', 'join', 'sum', 'avg', 'if', 'double', 'triple']
 * registry.describe(); // [{ name: 'upper', description: 'Converts a value to an uppercase string' }, ...]
 */
export function createFunctionRegistry(initialFunctions = {}) {
  /** @type {Record<string, FunctionDef>} */
  const functions = { ...builtinFunctions };

  for (const [name, val] of Object.entries(initialFunctions)) {
    functions[name.toLowerCase()] = typeof val === 'function'
      ? { fn: val, description: '' }
      : { ...val };
  }

  return {
    /**
     * Registers a function under the given name.
     * @param {string} name - Function name (used in formula strings)
     * @param {FormulaFunction} fn - The implementation
     * @param {string} [description=''] - A human-readable description of the function
     * @throws {Error} If name is not a non-empty string or fn is not a function
     */
    register(name, fn, description = '') {
      if (typeof name !== 'string' || !name) {
        throw new Error('Function name must be a non-empty string');
      }
      if (typeof fn !== 'function') {
        throw new Error('Function implementation must be a function');
      }
      functions[name.toLowerCase()] = { fn, description };
    },

    /**
     * Retrieves a function implementation by name.
     * @param {string} name
     * @returns {FormulaFunction|undefined}
     */
    get(name) {
      return functions[name.toLowerCase()]?.fn;
    },

    /**
     * Checks whether a function is registered.
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
      return name.toLowerCase() in functions;
    },

    /**
     * Removes a custom function. Built-in functions cannot be unregistered.
     * @param {string} name
     * @returns {boolean} `true` if the function was removed
     * @throws {Error} If attempting to unregister a built-in function
     */
    unregister(name) {
      const lower = name.toLowerCase();
      if (lower in builtinFunctions) {
        throw new Error(`Cannot unregister built-in function "${name}"`);
      }
      return delete functions[lower];
    },

    /**
     * Lists all public function names (excludes internal `__` operators).
     * @returns {string[]}
     */
    list() {
      return Object.keys(functions).filter(name => !name.startsWith('__'));
    },

    /**
     * Returns names and descriptions of all public functions
     * (excludes internal `__` operators).
     * @returns {Array<{name: string, description: string}>}
     */
    describe() {
      return Object.entries(functions)
        .filter(([name]) => !name.startsWith('__'))
        .map(([name, { description }]) => ({ name, description }));
    },

    /**
     * Returns a shallow copy of all registered function definitions.
     * @returns {Record<string, FunctionDef>}
     */
    getAll() {
      return { ...functions };
    },
  };
}
