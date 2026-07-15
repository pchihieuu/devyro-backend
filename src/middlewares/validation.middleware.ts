// validation.middleware.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError, ZodIssue } from "zod";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";

interface ValidateData {
  body?: any;
  query?: any;
  params?: any;
}

export const validate =
  (schema: ZodSchema) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as ValidateData;

      // req.body vẫn là property ghi được bình thường ở cả Express 4 và 5
      if (validated.body !== undefined) {
        req.body = validated.body;
      }

      // req.query là getter-only từ Express 5 -> KHÔNG được gán lại.
      // Lưu kết quả đã validate/transform vào property riêng, tách khỏi req.query gốc.
      req.validatedQuery = validated.query;
      req.validatedParams = validated.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err: ZodIssue) => ({
          field: err.path.join("."),
          message: err.message,
        }));

        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
          success: false,
          message: HTTP_MESSAGE.VALIDATION_ERROR,
          errors,
        });
        return;
      }

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: HTTP_MESSAGE.VALIDATION_ERROR,
      });
    }
  };