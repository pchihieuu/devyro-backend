// validation.middleware.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError, ZodIssue } from "zod";
import { ValidationError, FieldError } from "../utils/errors";

/**
 * Gắn schema vào handler để OpenAPI generator (src/openapi/introspect.ts) đọc
 * ngược lại được params/query/body từ chính router — tài liệu không thể lệch
 * khỏi validator thật.
 */
export const VALIDATION_SCHEMA = Symbol.for("jobportal.validationSchema");

interface ValidateData {
  body?: any;
  query?: any;
  params?: any;
}

export const validate = (schema: ZodSchema) => {
  const handler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const validated = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as ValidateData;

      if (validated.body !== undefined) {
        req.body = validated.body;
      }

      req.validatedQuery = validated.query;
      req.validatedParams = validated.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: FieldError[] = error.issues.map((err: ZodIssue) => ({
          // Bỏ prefix "body."/"query."/"params." — chỉ giữ tên field thật
          // (vd "hourlyRateMax" thay vì "body.hourlyRateMax") để khớp với
          // tên field trên form FE, tránh nhầm lẫn khi hiển thị/mapping lỗi.
          field: err.path.length > 1 ? err.path.slice(1).join(".") : null,
          message: err.message,
        }));

        // KHÔNG tự res.json() nữa — next(err) để đi qua CHUNG 1 errorHandler.middleware.ts
        // với mọi lỗi khác (BadRequestError từ service, v.v.), đảm bảo response
        // shape luôn giống nhau: { success, message, errors: [{field, message}] }
        next(new ValidationError(errors));
        return;
      }

      next(error);
    }
  };
  return Object.assign(handler, { [VALIDATION_SCHEMA]: schema });
};
