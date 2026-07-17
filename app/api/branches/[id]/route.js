import Branch from "@/models/Branch";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(Branch, { idField: "branch_ID", idPrefix: "BR" });
export const GET = crud.getOne;
export const PUT = crud.update;
export const DELETE = crud.remove;
