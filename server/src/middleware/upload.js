import multer from "multer";
import { AppError } from "../utils/AppError.js";

export const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new AppError("Use a JPEG, PNG, or WebP image", 422, "INVALID_IMAGE"));
      return;
    }
    callback(null, true);
  },
});
