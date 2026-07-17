import Room from "@/models/Room";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(Room, { idField: "room_ID", idPrefix: "RM" });
export const GET = crud.list;
export const POST = crud.create;
