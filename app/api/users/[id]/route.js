import User from "@/models/User";
import { makeCrud } from "@/lib/crud";

const stripAuth = (body) => {
  const b = { ...body };
  for (const k of ["password", "password_hash", "must_change_password", "failed_attempts", "locked_until"]) delete b[k];
  return b;
};

const crud = makeCrud(User, { idField: "user_ID", idPrefix: "US", beforeWrite: stripAuth });
export const GET = crud.getOne;
export const PUT = crud.update;
export const DELETE = crud.remove;
