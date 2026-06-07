import { Router } from "express";
import { getISSLocation } from "../controllers/issController.js";

const router = Router();

router.get("/", getISSLocation);

export default router;