import web from "./web.js";
import dotenv from "dotenv";
import healthcheckrouter from "./routes/healthcheck.js";
dotenv.config({ path: "./config/.env" });

const PORT = process.env.PORT || 8000;



web.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

web.use("/api/v1",healthcheckrouter)
