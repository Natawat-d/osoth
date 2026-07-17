import SystemConfig from "@/models/SystemConfig";
import { apiHandler, requireRole } from "@/lib/api";

export const GET = apiHandler(async () => {
  let config = await SystemConfig.findOne({ branch_ID: null }).lean();
  if (!config) config = await SystemConfig.create({ branch_ID: null });
  return config;
});

export const PUT = apiHandler(async (req) => {
  requireRole(req, ["crud"]);
  const body = await req.json();
  delete body._id;
  return SystemConfig.findOneAndUpdate(
    { branch_ID: null },
    { $set: body },
    { new: true, upsert: true }
  );
});
