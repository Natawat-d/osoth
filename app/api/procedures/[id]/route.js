import MedicalProcedure from "@/models/MedicalProcedure";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(MedicalProcedure, {
  idField: "medical_procedure_ID",
  idPrefix: "MP",
});
export const GET = crud.getOne;
export const PUT = crud.update;
export const DELETE = crud.remove;
