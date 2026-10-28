
import { ApiError } from "../lib/Api_error.js";
function jsonErrorHandler(err, req, res, next) {
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    "body" in err
  ) {
    return next(
      ApiError.validation("Request body contains invalid JSON.")
    );
  }

  next(err);
}

export default jsonErrorHandler;
