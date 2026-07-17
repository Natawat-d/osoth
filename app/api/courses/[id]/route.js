import Course from "@/models/Course";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(Course, { idField: "course_ID", idPrefix: "CS" });
export const GET = crud.getOne;
export const PUT = crud.update;
export const DELETE = crud.remove;
