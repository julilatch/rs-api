import { Router } from "express";
import { getStatement } from "../controllers/ai.controller";
const router = Router();

router.post("/", getStatement);

export default router;
