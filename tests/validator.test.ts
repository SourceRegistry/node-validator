import {describe, expect, expectTypeOf, it} from "vitest";
import {
    fail,
    isFailure,
    ok,
    runValidation,
    SchemaValidationError,
    v,
    Validator
} from "../src";

describe("validator", () => {
    it("exposes ok, fail, isFailure, and runValidation helpers", () => {
        const success = ok("value");
        const failure = fail("Broken", ["ROOT", 0], "bad");
        const failureWithoutCode = fail("Broken", ["ROOT"]);

        expect(success).toEqual({success: true, data: "value"});
        expect(failure).toEqual({
            success: false,
            errors: [{path: "$.ROOT[0]", message: "Broken", code: "bad"}],
        });
        expect(failureWithoutCode).toEqual({
            success: false,
            errors: [{path: "$.ROOT", message: "Broken"}],
        });
        expect(fail("Nested", ["A", "B"], "nested")).toEqual({
            success: false,
            errors: [{path: "$.A.B", message: "Nested", code: "nested"}],
        });
        expect(isFailure(success)).toBe(false);
        expect(isFailure(failure)).toBe(true);
        expect(runValidation(Validator.literal("value"), "value")).toEqual(success);
        expect(v).toBe(Validator);
    });

    it("validates strings across success and failure branches", () => {
        const validator = Validator.string({
            trim: true,
            non_empty: true,
            min: 2,
            max: 5,
            pattern: /^[a-z]+$/,
        });

        expect(Validator.parse(validator, " ab ")).toBe("ab");
        expect(Validator.safeParse(validator, 123)).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_type"})],
        }));
        expect(Validator.safeParse(validator, " ")).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "too_small"})],
        }));
        expect(Validator.safeParse(validator, "a")).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "too_small"})],
        }));
        expect(Validator.safeParse(validator, "abcdef")).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "too_big"})],
        }));
        expect(Validator.safeParse(validator, "ab1")).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_string"})],
        }));
    });

    it("treats global and sticky regex patterns as stateless during validation", () => {
        const globalValidator = Validator.string({pattern: /^[a-z]+$/g});
        const stickyValidator = Validator.string({pattern: /[a-z]+/y});

        expect(Validator.parse(globalValidator, "alpha")).toBe("alpha");
        expect(Validator.parse(globalValidator, "alpha")).toBe("alpha");
        expect(Validator.parse(stickyValidator, "beta")).toBe("beta");
        expect(Validator.parse(stickyValidator, "beta")).toBe("beta");
    });

    it("validates numbers, booleans, literals, enums, and defaults", () => {
        expect(Validator.parse(Validator.number({min: 1, max: 10, integer: true}), 5)).toBe(5);
        expect(Validator.safeParse(Validator.number(), Number.NaN)).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_type"})],
        }));
        expect(Validator.safeParse(Validator.number(), Number.POSITIVE_INFINITY)).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_number"})],
        }));
        expect(Validator.parse(Validator.number({finite: false}), Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
        expect(Validator.safeParse(Validator.number({integer: true}), 1.5)).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_number"})],
        }));
        expect(Validator.safeParse(Validator.number({min: 3}), 2)).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "too_small"})],
        }));
        expect(Validator.safeParse(Validator.number({max: 3}), 4)).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "too_big"})],
        }));

        expect(Validator.parse(Validator.boolean(), true)).toBe(true);
        expect(Validator.safeParse(Validator.boolean(), "true")).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_type"})],
        }));

        expect(Validator.parse(Validator.literal(null), null)).toBeNull();
        expect(Validator.safeParse(Validator.literal("yes"), "no")).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_literal"})],
        }));

        expect(Validator.parse(Validator.enum(["a", "b"] as const), "a")).toBe("a");
        expect(Validator.safeParse(Validator.enum(["a", "b"] as const), 1)).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_type"})],
        }));
        expect(Validator.safeParse(Validator.enum(["a", "b"] as const), "c")).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_enum"})],
        }));

        expect(Validator.parse(Validator.withDefault(Validator.number({min: 1}), 6), undefined)).toBe(6);
        expect(Validator.safeParse(Validator.withDefault(Validator.number({min: 1}), 6), 0)).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "too_small"})],
        }));
    });

    it("validates optional, nullable, arrays, tuples, objects, and records", () => {
        expect(Validator.parse(Validator.optional(Validator.string()), undefined)).toBeUndefined();
        expect(Validator.parse(Validator.optional(Validator.string()), "value")).toBe("value");
        expect(Validator.parse(Validator.nullable(Validator.string()), null)).toBeNull();
        expect(Validator.parse(Validator.nullable(Validator.string()), "value")).toBe("value");

        expect(Validator.safeParse(
            Validator.array(Validator.number({integer: true}), {min: 1, max: 2}),
            "bad"
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_type"})],
        }));
        expect(Validator.safeParse(
            Validator.array(Validator.number(), {min: 2}),
            [1]
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "too_small"})],
        }));
        expect(Validator.safeParse(
            Validator.array(Validator.number(), {max: 1}),
            [1, 2]
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "too_big"})],
        }));
        expect(Validator.safeParse(
            Validator.array(Validator.number({integer: true})),
            [1, 1.5]
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({path: "$[1]", code: "invalid_number"})],
        }));
        expect(Validator.parse(Validator.array(Validator.number()), [1, 2])).toEqual([1, 2]);

        expect(Validator.parse(
            Validator.tuple([Validator.string(), Validator.number({integer: true})]),
            ["id", 1]
        )).toEqual(["id", 1]);
        expect(Validator.safeParse(
            Validator.tuple([Validator.string(), Validator.number({integer: true})]),
            "bad"
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_type"})],
        }));
        expect(Validator.safeParse(
            Validator.tuple([Validator.string(), Validator.number({integer: true})]),
            ["id"]
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_length"})],
        }));
        expect(Validator.safeParse(
            Validator.tuple([Validator.string(), Validator.number({integer: true})]),
            ["id", 1.5]
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({path: "$[1]", code: "invalid_number"})],
        }));

        expect(Validator.safeParse(Validator.object({A: Validator.string()}), "bad")).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_type"})],
        }));
        expect(Validator.safeParse(
            Validator.object({A: Validator.string()}),
            {A: 1}
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({path: "$.A", code: "invalid_type"})],
        }));

        expect(Validator.parse(
            Validator.object({A: Validator.string()}, {unknownKeys: "allow"}),
            {A: "ok", EXTRA: 1}
        )).toEqual({A: "ok", EXTRA: 1});

        expect(Validator.parse(
            Validator.object({A: Validator.string()}, {unknownKeys: "strip"}),
            {A: "ok", EXTRA: 1}
        )).toEqual({A: "ok"});

        expect(Validator.safeParse(
            Validator.object({A: Validator.string()}, {unknownKeys: "error"}),
            {A: "ok", EXTRA: 1}
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({path: "$.EXTRA", code: "unknown_key"})],
        }));

        expect(Validator.safeParse(
            Validator.object({A: Validator.string()}),
            new Date()
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_type"})],
        }));

        const nullPrototypeObject = Object.create(null) as Record<string, unknown>;
        nullPrototypeObject.A = "ok";
        expect(Validator.parse(
            Validator.object({A: Validator.string()}),
            nullPrototypeObject
        )).toEqual({A: "ok"});

        expect(Validator.parse(
            Validator.record(Validator.number({integer: true}), {
                key: Validator.string({pattern: /^[A-Z_]+$/}),
            }),
            {FOO: 1, BAR: 2}
        )).toEqual({FOO: 1, BAR: 2});
        expect(Validator.safeParse(
            Validator.record(Validator.number()),
            []
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_type"})],
        }));
        expect(Validator.safeParse(
            Validator.record(Validator.number({integer: true}), {
                key: Validator.string({pattern: /^[A-Z_]+$/}),
            }),
            {foo: 1, BAR: 1.5}
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [
                expect.objectContaining({path: "$.foo", code: "invalid_string"}),
                expect.objectContaining({path: "$.BAR", code: "invalid_number"}),
            ],
        }));
    });

    it("validates unions, transforms, refinement safety, and parse errors", () => {
        const unionValidator = Validator.union(
            Validator.literal("yes"),
            Validator.number({min: 1}),
            Validator.boolean()
        );

        expect(Validator.parse(unionValidator, "yes")).toBe("yes");
        expect(Validator.parse(unionValidator, 2)).toBe(2);
        expect(Validator.parse(unionValidator, true)).toBe(true);
        expect(Validator.parse(unionValidator, false)).toBe(false);
        expect(Validator.safeParse(unionValidator, null)).toEqual(expect.objectContaining({
            success: false,
            errors: [
                expect.objectContaining({code: "invalid_literal"}),
                expect.objectContaining({code: "invalid_type"}),
                expect.objectContaining({code: "invalid_type"}),
            ],
        }));

        expect(Validator.safeParse(
            Validator.union(Validator.literal("a"), Validator.literal("b")),
            "c"
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [
                expect.objectContaining({code: "invalid_literal"}),
                expect.objectContaining({code: "invalid_literal"}),
            ],
        }));

        expect(Validator.parse(
            Validator.transform(Validator.string({trim: true}), (value) => value.toUpperCase()),
            " abc "
        )).toBe("ABC");
        expect(Validator.safeParse(
            Validator.transform(Validator.string(), () => {
                throw new Error("boom");
            }),
            "abc"
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "transform_failed"})],
        }));
        expect(Validator.safeParse(
            Validator.transform(Validator.string(), (value) => value.toUpperCase()),
            123
        )).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_type"})],
        }));

        const refined = Validator.refine(
            Validator.string(),
            (value) => value.startsWith("x"),
            "Must start with x",
            "starts_with_x"
        );
        expect(Validator.parse(refined, "xyz")).toBe("xyz");
        expect(Validator.safeParse(refined, "abc")).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "starts_with_x"})],
        }));
        expect(Validator.safeParse(refined, 123)).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "invalid_type"})],
        }));

        const throwingRefine = Validator.refine(
            Validator.string(),
            () => {
                throw new Error("boom");
            },
            "Refine failed safely",
            "refine_failed"
        );
        expect(Validator.safeParse(throwingRefine, "abc")).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({code: "refine_failed"})],
        }));

        try {
            Validator.parse(Validator.number(), "nope");
            throw new Error("Expected validation error");
        } catch (error) {
            expect(error).toBeInstanceOf(SchemaValidationError);
            expect((error as SchemaValidationError).errors).toEqual([
                expect.objectContaining({path: "$", code: "invalid_type"}),
            ]);
        }
    });

    it("parses FormData payloads through object validators", () => {
        const formData = new FormData();
        formData.set("name", " Ada ");
        formData.append("roles", "admin");
        formData.append("roles", "user");
        formData.append("roles", "admin");

        const validator = Validator.object({
            name: Validator.string({trim: true, non_empty: true}),
            roles: Validator.array(Validator.enum(["admin", "user"] as const), {min: 1}),
        });

        expect(Validator.safeParseFormData(validator, formData)).toEqual({
            success: true,
            data: {
                name: "Ada",
                roles: ["admin", "user", "admin"],
            },
        });
        expect(Validator.parseFormData(validator, formData)).toEqual({
            name: "Ada",
            roles: ["admin", "user", "admin"],
        });
    });

    it("preserves single FormData entries and blobs while reporting validation failures", async () => {
        const avatar = new Blob(["avatar"], {type: "text/plain"});
        const formData = new FormData();
        formData.set("name", "Ada");
        formData.set("avatar", avatar);
        formData.append("roles", "admin");
        formData.append("roles", "guest");

        const validator = Validator.object({
            name: Validator.string(),
            roles: Validator.array(Validator.enum(["admin", "user"] as const), {min: 1}),
        }, {unknownKeys: "allow"});

        expect(Validator.safeParseFormData(validator, formData)).toEqual(expect.objectContaining({
            success: false,
            errors: [expect.objectContaining({path: "$.roles[1]", code: "invalid_enum"})],
        }));

        const parsed = Validator.parseFormData(Validator.object(
            {name: Validator.string()},
            {unknownKeys: "allow"}
        ), formData);
        const avatarValue = parsed.avatar as Blob;

        expect(parsed).toEqual(expect.objectContaining({
            name: "Ada",
            roles: ["admin", "guest"],
        }));
        expect(avatarValue).toBeInstanceOf(Blob);
        expect(avatarValue.type).toBe("text/plain");
        await expect(avatarValue.text()).resolves.toBe("avatar");
    });

    it("throws SchemaValidationError when parseFormData validation fails", () => {
        const formData = new FormData();
        formData.set("name", "Ada");
        formData.append("roles", "guest");

        const validator = Validator.object({
            name: Validator.string(),
            roles: Validator.array(Validator.enum(["admin", "user"] as const), {min: 1}),
        });

        expect(() => Validator.parseFormData(validator, formData)).toThrowError(SchemaValidationError);

        try {
            Validator.parseFormData(validator, formData);
            throw new Error("Expected validation error");
        } catch (error) {
            expect(error).toBeInstanceOf(SchemaValidationError);
            expect((error as SchemaValidationError).errors).toEqual([
                expect.objectContaining({path: "$.roles", code: "invalid_type"}),
            ]);
        }
    });

    it("exposes stable TypeScript inference for core validators", () => {
        const objectValidator = Validator.object({
            id: Validator.number({integer: true}),
            name: Validator.string(),
            nickname: Validator.optional(Validator.string()),
        });
        const allowedObjectValidator = Validator.object(
            {id: Validator.number({integer: true})},
            {unknownKeys: "allow"}
        );
        const tupleValidator = Validator.tuple([Validator.string(), Validator.number()]);
        const unionValidator = Validator.union(Validator.string(), Validator.number());
        const transformedValidator = Validator.transform(Validator.string(), (value) => value.length);
        const aliasObjectValidator = v.object({
            active: v.boolean(),
        });
        const parsedObject = Validator.parse(objectValidator, {id: 1, name: "Ada"});
        const parsedAllowedObject = Validator.parse(allowedObjectValidator, {id: 1, extra: true});
        const parsedTuple = Validator.parse(tupleValidator, ["a", 1] as [string, number]);
        const parsedUnion = Validator.parse(unionValidator, "a" as unknown);
        const parsedTransformed = Validator.parse(transformedValidator, "abcd");
        const parsedAliasObject = v.parse(aliasObjectValidator, {active: true});
        const tupleCheck: [string, number] = parsedTuple;
        const unionCheck: string | number = parsedUnion;
        const transformedCheck: number = parsedTransformed;
        const aliasObjectCheck: {active: boolean} = parsedAliasObject;
        const objectCheck: {
            id: number;
            name: string;
            nickname?: string | undefined;
        } = parsedObject;
        const allowedObjectCheck: {
            id: number;
        } & Record<string, unknown> = parsedAllowedObject;
        void aliasObjectCheck;
        void objectCheck;
        void allowedObjectCheck;
        void tupleCheck;
        void unionCheck;
        void transformedCheck;

        expect(parsedAliasObject).toEqual({active: true});
        expectTypeOf(parsedUnion).toEqualTypeOf<string | number>();
        expectTypeOf(parsedTransformed).toEqualTypeOf<number>();
    });
});
