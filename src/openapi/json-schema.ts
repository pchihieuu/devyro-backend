import { z, ZodType } from "zod";

type Json = Record<string, any>;

/**
 * Zod 4 → JSON Schema (OpenAPI 3.0) + dọn nhiễu:
 *  - bỏ `additionalProperties:false` (Zod strip key lạ chứ không từ chối);
 *  - bỏ `pattern` regex dài của uuid/date-time (format đã đủ);
 *  - bỏ `maximum: MAX_SAFE_INTEGER` do `.int()` tự thêm.
 * `definitions` (schema có `.meta({id})`) được gom về `components.schemas`.
 */
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

const clean = (node: unknown): void => {
  if (Array.isArray(node)) return node.forEach(clean);
  if (!node || typeof node !== "object") return;
  const n = node as Json;

  if (n.additionalProperties === false) delete n.additionalProperties;
  if (n.format === "uuid" || n.format === "date-time" || n.format === "email") delete n.pattern;
  if (n.maximum === MAX_SAFE) delete n.maximum;
  if (n.minimum === -MAX_SAFE) delete n.minimum;
  if (typeof n.id === "string" && n.type) delete n.id;

  Object.values(n).forEach(clean);
};

const rewriteRefs = (node: unknown): unknown => {
  const text = JSON.stringify(node)
    .split("#/definitions/")
    .join("#/components/schemas/");
  return JSON.parse(text);
};

export interface Converted {
  schema: Json;
  definitions: Record<string, Json>;
}

export const toOpenApi = (
  schema: ZodType,
  io: "input" | "output"
): Converted => {
  const raw = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io,
    unrepresentable: "any",
    reused: "inline",
  }) as Json;

  const { definitions = {}, ...rest } = raw;
  const converted = rewriteRefs({ schema: rest, definitions }) as Converted;
  clean(converted.schema);
  clean(converted.definitions);
  return converted;
};
