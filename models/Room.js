import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema(
  {
    room_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    name: { type: String, required: true },
    order: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Room || mongoose.model("Room", RoomSchema);
