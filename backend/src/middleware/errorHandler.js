import { ApiError } from "../lib/Api_error.js";

function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        code: err.code || "INTERNAL_ERROR",
        message: err.message || "Something went wrong",
        path: req.originalUrl
    });
}

export default errorHandler;