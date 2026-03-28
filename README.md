# @sourceregistry/node-validator

[![npm version](https://img.shields.io/npm/v/@sourceregistry/node-validator?logo=npm)](https://www.npmjs.com/package/@sourceregistry/node-validator)
[![License](https://img.shields.io/npm/l/@sourceregistry/node-validator)](https://github.com/SourceRegistry/node-validator/blob/main/LICENSE)
[![CI](https://github.com/SourceRegistry/node-validator/actions/workflows/test.yml/badge.svg)](https://github.com/SourceRegistry/node-validator/actions)
[![Codecov](https://img.shields.io/codecov/c/github/SourceRegistry/node-validator)](https://codecov.io/gh/SourceRegistry/node-validator)

A lightweight, dependency-free runtime validation library for TypeScript and JavaScript.

`node-validator` is designed for production use where you want a small validation core, explicit error reporting, and strong TypeScript inference without pulling in a large schema framework.

## Features

- Zero runtime dependencies
- Path-aware validation errors for nested values
- Composable primitives for strings, numbers, booleans, arrays, tuples, objects, records, unions, and custom refinements
- `safeParse()` for result-based control flow and `parse()` for exception-based control flow
- Type inference from validators, object schemas, tuples, transforms, and unions
- Unknown-key handling for objects: `strip`, `allow`, or `error`
- CI-ready package tooling with coverage thresholds and multi-version Node verification

## Requirements

- Node.js `>=18`

## Installation

```bash
npm install @sourceregistry/node-validator
```

## Quick Start

```ts
import { Validator } from "@sourceregistry/node-validator";

const userValidator = Validator.object({
  id: Validator.number({ integer: true, min: 1 }),
  name: Validator.string({ trim: true, non_empty: true, min: 2 }),
  email: Validator.optional(
    Validator.string({ pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ })
  ),
  roles: Validator.array(Validator.enum(["admin", "user"] as const), { min: 1 }),
});

const result = Validator.safeParse(userValidator, {
  id: 1,
  name: " Ada ",
  roles: ["admin"],
});

if (result.success) {
  console.log(result.data.name); // "Ada"
} else {
  console.error(result.errors);
}
```

## Parse Modes

Use `safeParse()` when validation failures are part of normal control flow:

```ts
const result = Validator.safeParse(Validator.number({ min: 1 }), 0);

if (!result.success) {
  console.log(result.errors);
}
```

Use `parse()` when invalid input should fail fast:

```ts
import { SchemaValidationError, Validator } from "@sourceregistry/node-validator";

try {
  const port = Validator.parse(
    Validator.number({ integer: true, min: 1, max: 65535 }),
    3000
  );
  console.log(port);
} catch (error) {
  if (error instanceof SchemaValidationError) {
    console.error(error.errors);
  }
}
```

## Core Validators

### Strings

```ts
const username = Validator.string({
  trim: true,
  non_empty: true,
  min: 3,
  max: 20,
  pattern: /^[a-z0-9_]+$/i,
});
```

### Numbers

```ts
const quantity = Validator.number({
  integer: true,
  min: 0,
  max: 100,
});
```

### Arrays and Tuples

```ts
const tags = Validator.array(
  Validator.string({ trim: true, non_empty: true }),
  { max: 10 }
);

const point = Validator.tuple([
  Validator.number(),
  Validator.number(),
]);
```

### Objects and Records

```ts
const config = Validator.object(
  {
    host: Validator.string({ non_empty: true }),
    port: Validator.number({ integer: true, min: 1, max: 65535 }),
  },
  { unknownKeys: "error" }
);

const envMap = Validator.record(Validator.string(), {
  key: Validator.string({ pattern: /^[A-Z_]+$/ }),
});
```

### Optional, Nullable, and Defaults

```ts
const nickname = Validator.optional(Validator.string());
const archivedAt = Validator.nullable(Validator.string());
const retries = Validator.withDefault(
  Validator.number({ integer: true, min: 0 }),
  3
);
```

### Literals, Enums, Unions, Transforms, and Refinements

```ts
const mode = Validator.enum(["development", "production"] as const);

const id = Validator.union(
  Validator.number({ integer: true, min: 1 }),
  Validator.string({ non_empty: true })
);

const normalizedEmail = Validator.transform(
  Validator.string({ trim: true, non_empty: true }),
  (value) => value.toLowerCase()
);

const evenNumber = Validator.refine(
  Validator.number({ integer: true }),
  (value) => value % 2 === 0,
  "Expected an even number",
  "not_even"
);
```

## Error Shape

Validation failures return a normalized issue array:

```ts
type ValidationIssue = {
  path: string;
  message: string;
  code?: string;
};
```

Example:

```ts
{
  success: false,
  errors: [
    { path: "$.roles[1]", message: "Expected string enum value", code: "invalid_type" }
  ]
}
```

Paths are rooted at `$` and include object keys and array indexes.

## API

| Export | Description |
| --- | --- |
| `Validator.string(options?)` | Validate strings with trimming, length, and regex options. |
| `Validator.number(options?)` | Validate numbers with min, max, integer, and finite checks. |
| `Validator.boolean()` | Validate boolean values. |
| `Validator.literal(value)` | Validate one exact literal value. |
| `Validator.enum(values)` | Validate one value from a string literal set. |
| `Validator.optional(inner)` | Allow `undefined`. |
| `Validator.nullable(inner)` | Allow `null`. |
| `Validator.withDefault(inner, fallback)` | Apply a fallback when the input is `undefined`. |
| `Validator.array(inner, options?)` | Validate arrays and their items. |
| `Validator.tuple(shape)` | Validate a fixed-length tuple. |
| `Validator.object(shape, options?)` | Validate plain objects using a validator shape. |
| `Validator.record(valueValidator, options?)` | Validate object records and optionally validate keys. |
| `Validator.union(...validators)` | Validate against the first matching validator. |
| `Validator.transform(base, mapper, message?, code?)` | Map validated input into a new output type. |
| `Validator.refine(base, predicate, message, code?)` | Add a custom predicate to an existing validator. |
| `Validator.safeParse(validator, value)` | Return `{ success, data | errors }`. |
| `Validator.parse(validator, value)` | Return parsed data or throw `SchemaValidationError`. |
| `ok(data)` | Build a success result manually. |
| `fail(message, path, code?)` | Build a failure result manually. |
| `runValidation(validator, value, path?)` | Execute a validator directly. |
| `isFailure(result)` | Type guard for failed validation results. |

## Quality Gates

The package is verified with:

- Type-checking via `tsc`
- Runtime tests via `vitest`
- Coverage thresholds set to 100%
- Build verification for ESM, CJS, declarations, and sourcemaps
- GitHub Actions CI on Node 18, 20, and 22

## Development

```bash
npm run lint
npm test
npm run test:coverage
npm run build
npm run verify
```

## Contributing

- Add tests for new validators and behavior changes.
- Preserve the error shape and parse semantics unless a breaking change is intended.
- Keep `lint`, `test:coverage`, and `build` green before publishing.

## Style Notes

- Use `unknownKeys` for object unknown-key handling.
- Use `Validator.withDefault()` for fallback values.
- `Validator.tuple()` returns a mutable tuple type in TypeScript for easier downstream use.
