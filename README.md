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

`Validator` is also exported as `v` for shorter schema definitions.

## Quick Start

```ts
import { v } from "@sourceregistry/node-validator";

const userValidator = v.object({
  id: v.number({ integer: true, min: 1 }),
  name: v.string({ trim: true, non_empty: true, min: 2 }),
  email: v.optional(
    v.string({ pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ })
  ),
  roles: v.array(v.enum(["admin", "user"] as const), { min: 1 }),
});

const result = v.safeParse(userValidator, {
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
import { v } from "@sourceregistry/node-validator";

const result = v.safeParse(v.number({ min: 1 }), 0);

if (!result.success) {
  console.log(result.errors);
}
```

Use `parse()` when invalid input should fail fast:

```ts
import { SchemaValidationError, v } from "@sourceregistry/node-validator";

try {
  const port = v.parse(
    v.number({ integer: true, min: 1, max: 65535 }),
    3000
  );
  console.log(port);
} catch (error) {
  if (error instanceof SchemaValidationError) {
    console.error(error.errors);
  }
}
```

Use `safeParseFormData()` or `parseFormData()` when the payload starts as `FormData`:

```ts
const formData = new FormData();
formData.set("name", " Ada ");
formData.append("roles", "admin");
formData.append("roles", "user");

const result = v.safeParseFormData(
  v.object({
    name: v.string({ trim: true, non_empty: true }),
    roles: v.array(v.enum(["admin", "user"] as const), { min: 1 }),
  }),
  formData
);
```

Repeated `FormData` keys are exposed to validators as arrays in insertion order. Single entries remain single values.

## Core Validators

### Strings

```ts
const username = v.string({
  trim: true,
  non_empty: true,
  min: 3,
  max: 20,
  pattern: /^[a-z0-9_]+$/i,
});
```

### Numbers

```ts
const quantity = v.number({
  integer: true,
  min: 0,
  max: 100,
});
```

### Arrays and Tuples

```ts
const tags = v.array(
  v.string({ trim: true, non_empty: true }),
  { max: 10 }
);

const point = v.tuple([
  v.number(),
  v.number(),
]);
```

### Objects and Records

```ts
const config = v.object(
  {
    host: v.string({ non_empty: true }),
    port: v.number({ integer: true, min: 1, max: 65535 }),
  },
  { unknownKeys: "error" }
);

const envMap = v.record(v.string(), {
  key: v.string({ pattern: /^[A-Z_]+$/ }),
});
```

### Optional, Nullable, and Defaults

```ts
const nickname = v.optional(v.string());
const archivedAt = v.nullable(v.string());
const retries = v.withDefault(
  v.number({ integer: true, min: 0 }),
  3
);
```

### Literals, Enums, Unions, Transforms, and Refinements

```ts
const mode = v.enum(["development", "production"] as const);

const id = v.union(
  v.number({ integer: true, min: 1 }),
  v.string({ non_empty: true })
);

const idAlt = v.union([
  v.number({ integer: true, min: 1 }),
  v.string({ non_empty: true }),
]);

const normalizedEmail = v.transform(
  v.string({ trim: true, non_empty: true }),
  (value) => value.toLowerCase()
);

const evenNumber = v.refine(
  v.number({ integer: true }),
  (value) => value % 2 === 0,
  "Expected an even number",
  "not_even"
);

const upload = v.custom<File>(
  (value): value is File => value instanceof File,
  "Expected uploaded file",
  "invalid_type"
);

const passthroughPayload = v.any();
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
| `v` | Shorthand alias for `Validator`. |
| `Validator.string(options?)` | Validate strings with trimming, length, and regex options. |
| `Validator.number(options?)` | Validate numbers with min, max, integer, and finite checks. |
| `Validator.boolean()` | Validate boolean values. |
| `Validator.any()` | Accept any input value without validation. |
| `Validator.custom(predicate, message?, code?)` | Validate via a custom predicate and return typed output. |
| `Validator.literal(value)` | Validate one exact literal value. |
| `Validator.enum(values)` | Validate one value from a string literal set. |
| `Validator.optional(inner)` | Allow `undefined`. |
| `Validator.nullable(inner)` | Allow `null`. |
| `Validator.withDefault(inner, fallback)` | Apply a fallback when the input is `undefined`. |
| `Validator.array(inner, options?)` | Validate arrays and their items. |
| `Validator.tuple(shape)` | Validate a fixed-length tuple. |
| `Validator.object(shape, options?)` | Validate plain objects using a validator shape. |
| `Validator.record(valueValidator, options?)` | Validate object records and optionally validate keys. |
| `Validator.union(...validators)` / `Validator.union([validators...])` | Validate against the first matching validator. |
| `Validator.transform(base, mapper, message?, code?)` | Map validated input into a new output type. |
| `Validator.refine(base, predicate, message, code?)` | Add a custom predicate to an existing validator. |
| `Validator.safeParse(validator, value)` | Return `{ success, data | errors }`. |
| `Validator.safeParseFormData(validator, value)` | Convert `FormData` to an object and return `{ success, data | errors }`. |
| `Validator.parse(validator, value)` | Return parsed data or throw `SchemaValidationError`. |
| `Validator.parseFormData(validator, value)` | Convert `FormData` to an object and return parsed data or throw. |
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
