import Product from "@/models/Product";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(Product, { idField: "product_ID", idPrefix: "PD" });
export const GET = crud.list;
export const POST = crud.create;
