import Course from "@/models/Course";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(Course, { idField: "course_ID", idPrefix: "CS" });
export const GET = crud.list;
export const POST = crud.create;
