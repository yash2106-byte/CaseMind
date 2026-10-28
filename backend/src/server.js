import dotenv from "dotenv";
import web from "./web.js";
import healthcheckrouter from "./routes/healthcheck.js";
import { ApiError } from "./lib/Api_error.js";
import errorHandler from "./middleware/errorHandler.js";
import jsonErrorHandler from "./middleware/jsonErrorHandler.js";


dotenv.config({ path: "./config/.env" });

const PORT = process.env.PORT || 8000;

// Register routes first
web.use("/api/v1", healthcheckrouter);

// Check for any Invalid json
web.use(jsonErrorHandler)

// Catch unknown routes
web.use((req, res, next) => {
    next(ApiError.notFound(`Route ${req.originalUrl} not found`));
});

// Handle errors centrally
web.use(errorHandler);

// Start server
web.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});