import { Router } from "express";
import { login, logout, getCurrentUser, getCsrfToken, changePassword, updateProfile } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { loginLimiter, changePasswordLimiter } from "../middleware/rate-limit.middleware";
import { validate } from "../middleware/validate";
import { changePasswordSchema, loginSchema, updateProfileSchema } from "../validators/password.validator";

const router = Router();

router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/logout", logout);
router.get("/csrf", getCsrfToken);
router.get("/me", requireAuth, getCurrentUser);
router.post("/change-password", requireAuth, changePasswordLimiter, validate(changePasswordSchema), changePassword);
router.patch("/profile", requireAuth, validate(updateProfileSchema), updateProfile);

export default router;