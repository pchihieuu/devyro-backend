import { Request, Response, NextFunction } from "express";

type AsyncFunction<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Wrapper for async route handlers to catch errors
 * Eliminates need for try-catch in every controller
 *
 * Generic <Req> cho phép controller khai báo type cụ thể hơn Request gốc
 * (VD: ValidatedRequest<TParams, TQuery, TBody> sau khi qua middleware validate())
 * mà không cần cast `as` thủ công trong từng controller.
 */
export const asyncHandler = <Req extends Request = Request>(
  fn: AsyncFunction<Req>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as Req, res, next)).catch(next);
  };
};
