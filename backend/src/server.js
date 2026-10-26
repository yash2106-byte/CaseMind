import web from "./web.js";
import dotenv from "dotenv";

dotenv.config({ path: "./config/.env" });

const PORT = process.env.PORT || 8000;



web.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
