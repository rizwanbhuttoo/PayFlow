import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { profileImageUpload } from "../middleware/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { changePasswordSchema, profileSchema } from "../validation/schemas.js";
import { changePassword, updateProfile, uploadAvatar } from "../controllers/user.controller.js";

const router = Router();
router.use(requireAuth);
router.patch("/profile", validate(profileSchema), asyncHandler(updateProfile));
router.patch("/password", validate(changePasswordSchema), asyncHandler(changePassword));
router.post("/profile-image", profileImageUpload.single("image"), asyncHandler(uploadAvatar));
export default router;
