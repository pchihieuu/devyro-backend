export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const HTTP_MESSAGE = {
  // Success
  SUCCESS: "Request successful",
  CREATED: "Resource created successfully",
  UPDATED: "Resource updated successfully",
  DELETED: "Resource deleted successfully",

  // Auth
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "Access denied",
  INVALID_CREDENTIALS: "Invalid email or password",
  TOKEN_EXPIRED: "Token has expired",

  // Validation
  VALIDATION_ERROR: "Validation failed",
  REQUIRED_FIELD: "Required field missing",

  // General
  NOT_FOUND: "Resource not found",
  INTERNAL_ERROR: "Internal server error",
  TOO_MANY_REQUESTS: "Too many requests, please try again later",
} as const;
