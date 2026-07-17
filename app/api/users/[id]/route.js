import User from "@/models/User";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(User, { idField: "user_ID", idPrefix: "US" });
export const GET = crud.getOne;
export const PUT = crud.update;
export const DELETE = crud.remove;
