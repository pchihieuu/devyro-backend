import { AsyncLocalStorage } from "async_hooks";

/**
 * Store theo từng HTTP request. Tách riêng khỏi request-context.ts (file đó
 * import logger) để logger đọc được requestId/traceId mà không tạo vòng import.
 */
export interface RequestStore {
  requestId?: string;
  traceId?: string;
  queryCount: number;
  fingerprints: Map<string, number>;
}

export const requestStore = new AsyncLocalStorage<RequestStore>();

export const getRequestId = (): string | undefined =>
  requestStore.getStore()?.requestId;
