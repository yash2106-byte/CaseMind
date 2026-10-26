import { Router } from "express"
import { healthcheck } from "../controllers/healthcheck_controller.js"

const healthcheckrouter = Router()
healthcheckrouter.route("/health").get(healthcheck)

export default healthcheckrouter