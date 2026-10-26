
const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  AI_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};
 
class ApiError extends Error {
  constructor(code, message = "Something went wrong", stack = "") {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code] ?? 500;
 
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
 
  static validation(message) {
    return new ApiError("VALIDATION_ERROR", message);
  }
 
  static notFound(message) {
    return new ApiError("NOT_FOUND", message);
  }
 
  static conflict(message) {
    return new ApiError("CONFLICT", message);
  }
 
  static aiUnavailable(message = "AI service is unavailable.") {
    return new ApiError("AI_UNAVAILABLE", message);
  }
 
  static internal(message = "Something went wrong.") {
    return new ApiError("INTERNAL_ERROR", message);
  }
}
 
export { ApiError, STATUS_BY_CODE };