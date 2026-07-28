import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDatabase = async ({
  autoIndex = env.nodeEnv !== "production",
} = {}) => {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri, { autoIndex });
  console.log("MongoDB connected");
};
