import { Router } from "express";
import { login, getCurrentUser, getCsrfToken } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", login);
router.get("/csrf", getCsrfToken);
router.get("/me", requireAuth, getCurrentUser);

export default router;