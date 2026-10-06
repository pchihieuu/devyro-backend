import { AppError } from "./errors";
import { HTTP_STATUS } from "../constants/httpStatus";

export class ExternalTimeoutError extends AppError {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`, HTTP_STATUS.BAD_GATEWAY);
  }
}

/**
 * Giới hạn thời gian chờ cho external call (Cloudinary, SMTP...) mà SDK không
 * có timeout đáng tin. Lưu ý: chỉ ngừng CHỜ — request bên dưới có thể vẫn chạy
 * tiếp, nên dùng kèm timeout native của SDK khi có.
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> => {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ExternalTimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};
