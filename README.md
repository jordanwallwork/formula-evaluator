# formula-evaluator

A lightweight, extensible formula engine with variable tracking, nested functions, and operator precedence.

## Installation

```bash
npm install formula-evaluator
```

## Quick Start

```js
import FormulaEvaluator from 'formula-evaluator';

const evaluator = new FormulaEvaluator();

evaluator.evaluate('1 + 2');          // 3
evaluator.evaluate('sum(1, 2, 3)');   // 6
evaluator.evaluate('upper("hello")'); // "HELLO"
```

## Usage

### Constructor

Create an evaluator with an optional global context of variables:

```js
const evaluator = new FormulaEvaluator({ tax: 0.2, basePrice: 100 });
```

### `evaluate(formula, localContext?)`

Evaluate a formula string and return the result. An optional local context can be passed to provide or override variables for a single evaluation.

```js
const evaluator = new FormulaEvaluator({ x: 10 });

evaluator.evaluate('x + 1');              // 11
evaluator.evaluate('x + y', { y: 5 });    // 15
evaluator.evaluate('x', { x: 99 });       // 99  (local overrides global)
```

### `getDependencies(formula)`

Return an array of variable names referenced in a formula. Useful for building dependency graphs or determining which values a formula needs.

```js
evaluator.getDependencies('x + y');              // ['x', 'y']
evaluator.getDependencies('sum(a, b, c)');       // ['a', 'b', 'c']
evaluator.getDependencies('sum(1, 2)');          // []
evaluator.getDependencies('x + x');              // ['x']  (deduplicated)
```

### `tokenize(formula)` / `parse(tokens)`

Lower-level methods for accessing the tokenizer and parser directly:

```js
const tokens = evaluator.tokenize('sum(x, 1)');
const ast = evaluator.parse(tokens);
```

## Built-in Functions

### Math

| Function | Description | Example |
|----------|-------------|---------|
| `sum(...args)` | Sum all arguments | `sum(1, 2, 3)` → `6` |
| `avg(...args)` | Average of all arguments | `avg(2, 4, 6)` → `4` |
| `round(n, d)` | Round to `d` decimal places | `round(3.456, 2)` → `3.46` |
| `clamp(val, min, max)` | Restrict a number to a range | `clamp(15, 0, 10)` → `10` |
| `abs(n)` | Absolute value | `abs(-5)` → `5` |

### String

| Function | Description | Example |
|----------|-------------|---------|
| `upper(str)` | Convert to uppercase | `upper("hi")` → `"HI"` |
| `join(sep, ...args)` | Join arguments with separator | `join("-", "a", "b")` → `"a-b"` |
| `concat(...args)` | Concatenate all arguments | `concat("a", "b", "c")` → `"abc"` |

### Logic

| Function | Description | Example |
|----------|-------------|---------|
| `if(cond, a, b)` | Conditional: returns `a` if truthy, `b` otherwise | `if(true, "yes", "no")` → `"yes"` |
| `and(...args)` | Returns `true` if all arguments are truthy | `and(true, true)` → `true` |
| `or(...args)` | Returns `true` if any argument is truthy | `or(false, true)` → `true` |
| `coalesce(...args)` | Returns the first non-null/non-undefined value | `coalesce(null, 5)` → `5` |
| `isblank(val)` | Returns `true` if value is empty string or null/undefined | `isblank("")` → `true` |
| `iferr(val, fallback)` | Returns `val`, or `fallback` if `val` throws an error | `iferr(1/0, 0)` → `0` |

## Operators

### Arithmetic

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `1 + 2` → `3` |
| `-` | Subtraction | `5 - 3` → `2` |
| `-` | Unary negation | `-5` → `-5`, `-(3 + 2)` → `-5` |
| `*` | Multiplication | `3 * 4` → `12` |
| `/` | Division | `10 / 2` → `5` |

### Comparison

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equality | `5 = 5` → `true` |
| `!=` | Inequality | `5 != 3` → `true` |
| `>` | Greater than | `5 > 3` → `true` |
| `>=` | Greater than or equal | `5 >= 5` → `true` |
| `<` | Less than | `3 < 5` → `true` |
| `<=` | Less than or equal | `5 <= 5` → `true` |

### Logical

| Operator | Description | Example |
|----------|-------------|---------|
| `&` | Logical AND | `true & true` → `true` |
| `\|` | Logical OR | `false \| true` → `true` |
| `!` | Logical NOT | `!false` → `true` |

## Supported Types

- **Numbers**: `42`, `3.14`, `0.5`
- **Strings**: `"hello world"`
- **Booleans**: `true`, `false`

### `registerFunction(name, fn)`

Register a custom function that can be called in formulas. Returns the evaluator instance so calls can be chained.

```js
const evaluator = new FormulaEvaluator();

evaluator
  .registerFunction('double', (x) => x * 2)
  .registerFunction('clamp', (val, min, max) => Math.min(Math.max(val, min), max));

evaluator.evaluate('double(5)');        // 10
evaluator.evaluate('clamp(15, 0, 10)'); // 10
```

Custom functions receive their arguments already evaluated, so they work naturally with variables, operators, and nested calls:

```js
evaluator.registerFunction('double', (x) => x * 2);

evaluator.evaluate('double(n)', { n: 4 });   // 8
evaluator.evaluate('double(3) + 1');          // 7
evaluator.evaluate('double(sum(1, 2))');      // 6
```

You can also override built-in functions:

```js
evaluator.registerFunction('sum', (...args) => args.reduce((a, b) => a + b, 0));
```

### `listFunctions()`

Returns the names of all registered public functions (excludes internal operator mappings):

```js
evaluator.listFunctions(); // ['upper', 'join', 'sum', 'avg', 'if', 'coalesce', 'isblank', 'and', 'or', 'iferr', 'round', 'clamp', 'abs', 'concat']

evaluator.registerFunction('double', (x) => x * 2);
evaluator.listFunctions(); // ['upper', 'join', 'sum', 'avg', 'if', 'coalesce', 'isblank', 'and', 'or', 'iferr', 'round', 'clamp', 'abs', 'concat', 'double']
```

## Function Registry

For advanced use cases you can work with the function registry directly. The `createFunctionRegistry` factory and the `builtinFunctions` map are available as named exports:

```js
import { createFunctionRegistry, builtinFunctions } from 'formula-evaluator';
```

### `createFunctionRegistry(initialFunctions?)`

Creates a standalone registry pre-loaded with the built-in functions. Useful when you want to prepare a set of functions before constructing an evaluator, or share a registry definition across modules.

```js
import { createFunctionRegistry } from 'formula-evaluator';

const registry = createFunctionRegistry({
  double: (x) => x * 2,
});

registry.register('triple', (x) => x * 3);
registry.has('sum');          // true  (built-in)
registry.has('double');       // true  (initial)
registry.has('triple');       // true  (registered)
registry.get('double')(5);    // 10
registry.list();              // ['upper', 'join', 'sum', 'avg', 'if', 'coalesce', 'isblank', 'and', 'or', 'iferr', 'round', 'clamp', 'abs', 'concat', 'double', 'triple']
registry.unregister('triple');
registry.has('triple');       // false
```

Built-in functions are protected and cannot be unregistered:

```js
registry.unregister('sum'); // throws Error: Cannot unregister built-in function "sum"
```

### `builtinFunctions`

A frozen object containing the default function implementations. Useful for inspection or when building a custom registry from scratch:

```js
import { builtinFunctions } from 'formula-evaluator';

Object.keys(builtinFunctions); // ['upper', 'join', 'sum', 'avg', 'if', 'coalesce', 'isblank', 'and', 'or', 'iferr', 'round', 'clamp', 'abs', 'concat', '__add', '__sub', '__eq', '__gt', '__gte', '__lt', '__lte']
```

## Development

```bash
npm install
npm test
```

To run tests in watch mode:

```bash
npm run test:watch
```

## License

MIT
