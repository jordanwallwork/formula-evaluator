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
 * Built-in functions included in every new evaluator instance.
 * @type {Readonly<Record<string, FormulaFunction>>}
 */
export const builtinFunctions = Object.freeze({
  /** Converts a value to an uppercase string. */
  upper: (str) => String(str).toUpperCase(),

  /** Joins arguments with a separator. */
  join: (sep, ...args) => args.join(sep),

  /** Sums all arguments numerically. */
  sum: (...args) => args.reduce((a, b) => Number(a) + Number(b), 0),

  /** Returns the arithmetic mean of all arguments. */
  avg: (...args) => args.reduce((a, b) => a + b, 0) / args.length,

  /** Returns `a` if `cond` is truthy, otherwise `b`. */
  if: (cond, a, b) => (cond ? a : b),

  /** Returns the first non-null/non-undefined value. */
  coalesce: (...args) => args.find(a => a != null),

  /** Returns true if a value is an empty string or null/undefined. */
  isblank: (val) => val === '' || val == null,

  /** Returns true if all arguments are truthy. */
  and: (...args) => args.every(Boolean),

  /** Returns true if any argument is truthy. */
  or: (...args) => args.some(Boolean),

  /** Returns val; actual error-catching is handled in the evaluator. */
  iferr: (val) => val,

  /** Rounds a number to a specific decimal precision. */
  round: (n, d) => Number(Math.round(n + 'e' + d) + 'e-' + d),

  /** Restricts a number to a range. */
  clamp: (val, min, max) => Math.min(Math.max(val, min), max),

  /** Returns the absolute value of a number. */
  abs: (n) => Math.abs(n),

  /** Concatenates all arguments without a separator. */
  concat: (...args) => args.join(''),

  /** @private Addition operator. */
  __add: (a, b) => a + b,

  /** @private Subtraction operator. */
  __sub: (a, b) => a - b,

  /** @private Equality operator. */
  __eq: (a, b) => a === b,
});

/**
 * @typedef {Object} FunctionRegistry
 * @property {(name: string, fn: FormulaFunction) => void} register - Register a new function
 * @property {(name: string) => FormulaFunction|undefined} get - Retrieve a function by name
 * @property {(name: string) => boolean} has - Check whether a function is registered
 * @property {(name: string) => boolean} unregister - Remove a custom (non-built-in) function
 * @property {() => string[]} list - List public function names (excludes internal __ operators)
 * @property {() => Record<string, FormulaFunction>} getAll - Get a snapshot of all registered functions
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
 * registry.register('triple', (x) => x * 3);
 * registry.get('double')(5); // 10
 * registry.list(); // ['upper', 'join', 'sum', 'avg', 'if', 'double', 'triple']
 */
export function createFunctionRegistry(initialFunctions = {}) {
  /** @type {Record<string, FormulaFunction>} */
  const functions = { ...builtinFunctions, ...initialFunctions };

  return {
    /**
     * Registers a function under the given name.
     * @param {string} name - Function name (used in formula strings)
     * @param {FormulaFunction} fn - The implementation
     * @throws {Error} If name is not a non-empty string or fn is not a function
     */
    register(name, fn) {
      if (typeof name !== 'string' || !name) {
        throw new Error('Function name must be a non-empty string');
      }
      if (typeof fn !== 'function') {
        throw new Error('Function implementation must be a function');
      }
      functions[name] = fn;
    },

    /**
     * Retrieves a function by name.
     * @param {string} name
     * @returns {FormulaFunction|undefined}
     */
    get(name) {
      return functions[name];
    },

    /**
     * Checks whether a function is registered.
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
      return name in functions;
    },

    /**
     * Removes a custom function. Built-in functions cannot be unregistered.
     * @param {string} name
     * @returns {boolean} `true` if the function was removed
     * @throws {Error} If attempting to unregister a built-in function
     */
    unregister(name) {
      if (name in builtinFunctions) {
        throw new Error(`Cannot unregister built-in function "${name}"`);
      }
      return delete functions[name];
    },

    /**
     * Lists all public function names (excludes internal `__` operators).
     * @returns {string[]}
     */
    list() {
      return Object.keys(functions).filter(name => !name.startsWith('__'));
    },

    /**
     * Returns a shallow copy of all registered functions.
     * @returns {Record<string, FormulaFunction>}
     */
    getAll() {
      return { ...functions };
    },
  };
}
