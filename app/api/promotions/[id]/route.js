import Promotion from "@/models/Promotion";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(Promotion, { idField: "promotion_ID", idPrefix: "PM" });
export const GET = crud.getOne;
export const PUT = crud.update;
export const DELETE = crud.remove;
