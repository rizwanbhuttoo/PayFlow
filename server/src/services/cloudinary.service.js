import { cloudinary } from "../config/providers.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const isConfigured = () =>
  Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);

export const uploadProfileImage = async (buffer, userId) => {
  if (!isConfigured()) {
    throw new AppError(
      "Cloudinary is not configured. Add the Cloudinary environment variables first.",
      503,
      "CLOUDINARY_NOT_CONFIGURED"
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: env.cloudinaryFolder,
        public_id: `user-${userId}`,
        overwrite: true,
        resource_type: "image",
        transformation: [
          { width: 512, height: 512, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) {
          reject(new AppError("The profile image could not be uploaded", 502, "ASSET_UPLOAD_FAILED"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
};
