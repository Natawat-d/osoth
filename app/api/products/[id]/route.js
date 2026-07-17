import Product from "@/models/Product";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(Product, { idField: "product_ID", idPrefix: "PD" });
export const GET = crud.getOne;
export const PUT = crud.update;
export const DELETE = crud.remove;
