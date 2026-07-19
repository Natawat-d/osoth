import Promotion from "@/models/Promotion";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(Promotion, { idField: "promotion_ID", idPrefix: "PM", branchScoped: true });
export const GET = crud.list;
export const POST = crud.create;
