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

| Function | Description | Example |
|----------|-------------|---------|
| `sum(...args)` | Sum all arguments | `sum(1, 2, 3)` → `6` |
| `avg(...args)` | Average of all arguments | `avg(2, 4, 6)` → `4` |
| `upper(str)` | Convert to uppercase | `upper("hi")` → `"HI"` |
| `join(sep, ...args)` | Join arguments with separator | `join("-", "a", "b")` → `"a-b"` |
| `if(cond, a, b)` | Conditional: returns `a` if truthy, `b` otherwise | `if(true, "yes", "no")` → `"yes"` |

## Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `1 + 2` → `3` |
| `-` | Subtraction | `5 - 3` → `2` |
| `=` | Equality check | `5 = 5` → `true` |

## Supported Types

- **Numbers**: `42`, `3.14`, `0.5`
- **Strings**: `"hello world"`
- **Booleans**: `true`, `false`

## Adding Custom Functions

You can extend the evaluator by adding functions directly to the `FUNCTIONS` object:

```js
const evaluator = new FormulaEvaluator();

evaluator.FUNCTIONS.double = (x) => x * 2;
evaluator.FUNCTIONS.min = (...args) => Math.min(...args);

evaluator.evaluate('double(5)');     // 10
evaluator.evaluate('min(3, 1, 2)');  // 1
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
