import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError, ZodIssue } from "zod";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";

export const validate =
  (schema: ZodSchema) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
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
