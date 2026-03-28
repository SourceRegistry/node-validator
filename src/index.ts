/**
 * A single validation issue produced by a validator.
 */
export type ValidationIssue = {
    path: string;
    message: string;
    code?: string;
};

/**
 * Successful validation result.
 */
export type ValidationSuccess<T> = {
    success: true;
    data: T;
};

/**
 * Failed validation result.
 */
export type ValidationFailure = {
    success: false;
    errors: ValidationIssue[];
};

/**
 * The result returned by all validators.
 */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Internal path representation used while walking nested values.
 */
export type ValidationPath = Array<string | number>;

/**
 * Runtime validator function.
 */
export type Validator<T> = (value: unknown, path?: ValidationPath) => ValidationResult<T>;
/**
 * Infers the validated type from a validator.
 */
export type InferValidator<V> = V extends Validator<infer T> ? T : never;
/**
 * Generic object schema shape.
 */
export type SchemaShape = Record<string, Validator<any>>;
/**
 * Infers the validated output from an object schema shape.
 */
export type InferSchemaShape<S extends SchemaShape> = {
    [K in keyof S]: InferValidator<S[K]>;
};
/**
 * Tuple validator schema.
 */
export type TupleShape = readonly Validator<any>[];
/**
 * Infers the validated output from a tuple schema.
 */
export type InferTupleShape<T extends TupleShape> = {
    -readonly [K in keyof T]: T[K] extends Validator<infer U> ? U : never;
};
/**
 * Object validator unknown-key behavior.
 */
export type UnknownKeyBehavior = "strip" | "allow" | "error";
/**
 * Object validator options.
 */
export type ObjectOptions<U extends UnknownKeyBehavior = "strip"> = {
    unknownKeys?: U;
};
/**
 * Infers the validated output for an object schema and unknown-key mode.
 */
export type InferObjectShape<
    S extends SchemaShape,
    U extends UnknownKeyBehavior | undefined
> = U extends "allow"
    ? InferSchemaShape<S> & Record<string, unknown>
    : InferSchemaShape<S>;

/**
 * Error thrown by `validation.parse()` when validation fails.
 */
export class SchemaValidationError extends Error {
    public readonly errors: ValidationIssue[];

    constructor(errors: ValidationIssue[], message: string = "Schema validation failed") {
        super(message);
        this.name = "SchemaValidationError";
        this.errors = errors;
    }
}

const toPathString = (path: ValidationPath) => {
    if (path.length === 0) return "$";
    return path.reduce<string>((acc, part) => {
        if (typeof part === "number") return `${acc}[${part}]`;
        if (acc === "$") return `${acc}.${part}`;
        return `${acc}.${part}`;
    }, "$");
};

/**
 * Creates a successful validation result.
 */
export const ok = <T>(data: T): ValidationSuccess<T> => ({
    success: true,
    data
});

/**
 * Creates a failed validation result for the given path.
 */
export const fail = (message: string, path: ValidationPath, code?: string): ValidationFailure => ({
    success: false,
    errors: [{
        path: toPathString(path),
        message,
        ...(code !== undefined ? {code} : {})
    }]
});

const mergeErrors = (...results: ValidationFailure[]): ValidationFailure => ({
    success: false,
    errors: results.flatMap((r) => r.errors)
});

/**
 * Returns `true` when a validation result represents a failure.
 */
export const isFailure = <T>(result: ValidationResult<T>): result is ValidationFailure =>
    !result.success;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const testPattern = (pattern: RegExp, value: string) => {
    const flags = pattern.flags.replace(/[gy]/g, "");
    return new RegExp(pattern.source, flags).test(value);
};

/**
 * Runs a validator against a value.
 */
export const runValidation = <T>(validator: Validator<T>, value: unknown, path: ValidationPath = []): ValidationResult<T> =>
    validator(value, path);

/**
 * Generic validation primitives that work on plain runtime values.
 */
export const Validator = {
    /**
     * Validates a string value.
     */
    string: (options?: {
        trim?: boolean;
        min?: number;
        max?: number;
        non_empty?: boolean;
        pattern?: RegExp;
    }): Validator<string> =>
        (value, path = []) => {
            if (typeof value !== "string") {
                return fail("Expected string", path, "invalid_type");
            }
            const next = options?.trim ? value.trim() : value;
            if (options?.non_empty && next.length === 0) {
                return fail("String cannot be empty", path, "too_small");
            }
            if (options?.min !== undefined && next.length < options.min) {
                return fail(`String must have length >= ${options.min}`, path, "too_small");
            }
            if (options?.max !== undefined && next.length > options.max) {
                return fail(`String must have length <= ${options.max}`, path, "too_big");
            }
            if (options?.pattern && !testPattern(options.pattern, next)) {
                return fail("String does not match required pattern", path, "invalid_string");
            }
            return ok(next);
        },

    /**
     * Validates a number value.
     */
    number: (options?: {
        min?: number;
        max?: number;
        integer?: boolean;
        finite?: boolean;
    }): Validator<number> =>
        (value, path = []) => {
            if (typeof value !== "number" || Number.isNaN(value)) {
                return fail("Expected number", path, "invalid_type");
            }
            if (options?.finite !== false && !Number.isFinite(value)) {
                return fail("Expected finite number", path, "invalid_number");
            }
            if (options?.integer && !Number.isInteger(value)) {
                return fail("Expected integer", path, "invalid_number");
            }
            if (options?.min !== undefined && value < options.min) {
                return fail(`Number must be >= ${options.min}`, path, "too_small");
            }
            if (options?.max !== undefined && value > options.max) {
                return fail(`Number must be <= ${options.max}`, path, "too_big");
            }
            return ok(value);
        },

    /**
     * Validates a boolean value.
     */
    boolean: (): Validator<boolean> =>
        (value, path = []) =>
            typeof value === "boolean"
                ? ok(value)
                : fail("Expected boolean", path, "invalid_type"),

    /**
     * Validates a literal value.
     */
    literal: <T extends string | number | boolean | null>(expected: T): Validator<T> =>
        (value, path = []) =>
            value === expected
                ? ok(expected)
                : fail(`Expected literal '${String(expected)}'`, path, "invalid_literal"),

    /**
     * Validates one of the provided string literal values.
     */
    enum: <const T extends readonly string[]>(values: T): Validator<T[number]> =>
        (value, path = []) => {
            if (typeof value !== "string") {
                return fail("Expected string enum value", path, "invalid_type");
            }
            return (values as readonly string[]).includes(value)
                ? ok(value as T[number])
                : fail(`Expected one of: ${values.join(", ")}`, path, "invalid_enum");
        },

    /**
     * Makes another validator optional.
     */
    optional: <T>(inner: Validator<T>): Validator<T | undefined> =>
        (value, path = []) =>
            value === undefined ? ok(undefined) : runValidation(inner, value, path),

    /**
     * Makes another validator nullable.
     */
    nullable: <T>(inner: Validator<T>): Validator<T | null> =>
        (value, path = []) =>
            value === null ? ok(null) : runValidation(inner, value, path),

    /**
     * Validates an array and each of its items.
     */
    array: <T>(
        inner: Validator<T>,
        options?: {
            min?: number;
            max?: number;
        }
    ): Validator<T[]> =>
        (value, path = []) => {
            if (!Array.isArray(value)) {
                return fail("Expected array", path, "invalid_type");
            }
            if (options?.min !== undefined && value.length < options.min) {
                return fail(`Array length must be >= ${options.min}`, path, "too_small");
            }
            if (options?.max !== undefined && value.length > options.max) {
                return fail(`Array length must be <= ${options.max}`, path, "too_big");
            }
            const out: T[] = [];
            const errors: ValidationFailure[] = [];
            for (let i = 0; i < value.length; i++) {
                const result = runValidation(inner, value[i], [...path, i]);
                if (isFailure(result)) errors.push(result);
                else out.push(result.data);
            }
            return errors.length > 0 ? mergeErrors(...errors) : ok(out);
        },

    /**
     * Validates a tuple with a fixed number of items and validators.
     */
    tuple: <const T extends readonly [Validator<any>, ...Validator<any>[]]>(
        shape: T
    ): Validator<InferTupleShape<T>> =>
        (value, path = []) => {
            if (!Array.isArray(value)) {
                return fail("Expected array", path, "invalid_type");
            }
            if (value.length !== shape.length) {
                return fail(`Expected tuple length ${shape.length}`, path, "invalid_length");
            }

            const output: unknown[] = [];
            const errors: ValidationFailure[] = [];

            for (const [i, validator] of shape.entries()) {
                const result = runValidation(validator, value[i], [...path, i]);
                if (isFailure(result)) {
                    errors.push(result);
                } else {
                    output[i] = result.data;
                }
            }

            return errors.length > 0 ? mergeErrors(...errors) : ok(output as InferTupleShape<T>);
        },

    /**
     * Validates an object against a schema shape.
     */
    object: <S extends SchemaShape, U extends UnknownKeyBehavior = "strip">(
        schema: S,
        options?: ObjectOptions<U>
    ): Validator<InferObjectShape<S, U>> =>
        (value, path = []) => {
            if (!isPlainObject(value)) {
                return fail("Expected object", path, "invalid_type");
            }

            const unknownKeys = options?.unknownKeys ?? "strip";
            const errors: ValidationFailure[] = [];
            const output: Record<string, unknown> = {};

            for (const [key, validator] of Object.entries(schema)) {
                const result = runValidation(validator, value[key], [...path, key]);
                if (isFailure(result)) {
                    errors.push(result);
                } else if (result.data !== undefined) {
                    output[key] = result.data;
                }
            }

            for (const key of Object.keys(value)) {
                if (key in schema) continue;
                if (unknownKeys === "allow") output[key] = value[key];
                if (unknownKeys === "error") {
                    errors.push(fail(`Unknown key '${key}'`, [...path, key], "unknown_key"));
                }
            }

            return errors.length > 0 ? mergeErrors(...errors) : ok(output as InferObjectShape<S, U>);
        },

    /**
     * Validates a plain object record.
     */
    record: <T>(
        valueValidator: Validator<T>,
        options?: {
            key?: Validator<string>;
        }
    ): Validator<Record<string, T>> =>
        (value, path = []) => {
            if (!isPlainObject(value)) {
                return fail("Expected object", path, "invalid_type");
            }

            const output: Record<string, T> = {};
            const errors: ValidationFailure[] = [];

            for (const [key, entry] of Object.entries(value)) {
                if (options?.key) {
                    const keyResult = runValidation(options.key, key, [...path, key]);
                    if (isFailure(keyResult)) {
                        errors.push(keyResult);
                        continue;
                    }
                }

                const valueResult = runValidation(valueValidator, entry, [...path, key]);
                if (isFailure(valueResult)) {
                    errors.push(valueResult);
                } else {
                    output[key] = valueResult.data;
                }
            }

            return errors.length > 0 ? mergeErrors(...errors) : ok(output);
        },

    /**
     * Validates a value against either of two validators.
     */
    union: <const T extends readonly [Validator<any>, Validator<any>, ...Validator<any>[]]>(...validators: T): Validator<InferValidator<T[number]>> =>
        (value, path = []) => {
            const failures: ValidationFailure[] = [];
            for (const validator of validators) {
                const result = runValidation(validator, value, path);
                if (!isFailure(result)) return result;
                failures.push(result);
            }
            return mergeErrors(...failures);
        },

    /**
     * Maps a validated value into a new output type.
     */
    transform: <T, U>(
        base: Validator<T>,
        mapper: (value: T) => U,
        message: string = "Transform failed",
        code: string = "transform_failed"
    ): Validator<U> =>
        (value, path = []) => {
            const result = runValidation(base, value, path);
            if (isFailure(result)) return result;
            try {
                return ok(mapper(result.data));
            } catch {
                return fail(message, path, code);
            }
        },

    /**
     * Applies a fallback value when the input is undefined.
     */
    withDefault: <T>(inner: Validator<T>, fallback: T): Validator<T> =>
        (value, path = []) =>
            value === undefined ? ok(fallback) : runValidation(inner, value, path),

    /**
     * Adds a custom predicate to an existing validator.
     */
    refine: <T>(
        base: Validator<T>,
        predicate: (value: T) => boolean,
        message: string,
        code: string = "custom"
    ): Validator<T> =>
        (value, path = []) => {
            const result = runValidation(base, value, path);
            if (isFailure(result)) return result;
            try {
                if (!predicate(result.data)) return fail(message, path, code);
            } catch {
                return fail(message, path, code);
            }
            return result;
        },

    /**
     * Runs a validator and returns a result object instead of throwing.
     */
    safeParse: <T>(validator: Validator<T>, value: unknown): ValidationResult<T> =>
        runValidation(validator, value, []),

    /**
     * Runs a validator and throws `SchemaValidationError` on failure.
     */
    parse: <T>(validator: Validator<T>, value: unknown): T => {
        const result = runValidation(validator, value, []);
        if (isFailure(result)) {
            throw new SchemaValidationError(result.errors);
        }
        return result.data;
    }
};
