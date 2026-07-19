import MedicalProcedure from "@/models/MedicalProcedure";
import { makeCrud } from "@/lib/crud";

const crud = makeCrud(MedicalProcedure, {
  idField: "medical_procedure_ID",
  idPrefix: "MP",
  branchScoped: true,
  listFilter: (sp) => (sp.get("type") ? { type: sp.get("type") } : {}),
});
export const GET = crud.list;
export const POST = crud.create;
