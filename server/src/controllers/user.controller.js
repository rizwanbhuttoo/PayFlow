import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { uploadProfileImage } from "../services/cloudinary.service.js";

export const updateProfile = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, req.body, {
    new: true,
    runValidators: true,
  });
  res.json({ success: true, message: "Profile updated", data: { user } });
};

export const changePassword = async (req, res) => {
  const user = await User.findById(req.user.id).select("+passwordHash");
  if (!(await user.verifyPassword(req.body.currentPassword))) {
    throw new AppError("Current password is incorrect", 400, "INVALID_PASSWORD");
  }
  user.passwordHash = await User.hashPassword(req.body.newPassword);
  await user.save();
  res.json({ success: true, message: "Password changed" });
};

export const uploadAvatar = async (req, res) => {
  if (!req.file) throw new AppError("Choose an image to upload", 422, "IMAGE_REQUIRED");
  const asset = await uploadProfileImage(req.file.buffer, req.user.id);
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { profileImageUrl: asset.url, profileImagePublicId: asset.publicId },
    { new: true, runValidators: true }
  );
  res.json({ success: true, message: "Profile image updated", data: { user } });
};
