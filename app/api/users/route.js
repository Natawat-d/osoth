import User from "@/models/User";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(User, {
  idField: "user_ID",
  idPrefix: "US",
  listFilter: (sp) => {
    const f = {};
    if (sp.get("role")) f.role = sp.get("role");
    if (sp.get("active") !== "all") f.active = true;
    return f;
  },
});
export const GET = crud.list;
export const POST = crud.create;
