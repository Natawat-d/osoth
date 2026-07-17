import { apiHandler, requireRole } from "@/lib/api";
import { genId } from "@/services/ids";

// สร้าง GET(list)/POST(create) และ GET/PUT/DELETE(byId) มาตรฐานให้ collection ทั่วไป
// options: { idField, idPrefix, idDigits, listFilter(searchParams), perms }
export function makeCrud(Model, options) {
  const {
    idField,
    idPrefix,
    idDigits = 3,
    listFilter = () => ({}),
    perms = ["crud"],
  } = options;

  const list = apiHandler(async (req) => {
    const sp = new URL(req.url).searchParams;
    const filter = listFilter(sp);
    if (sp.get("branch_ID")) filter.branch_ID = sp.get("branch_ID");
    return Model.find(filter).sort({ created_at: -1 }).lean();
  });

  const create = apiHandler(async (req) => {
    requireRole(req, perms);
    const body = await req.json();
    if (!body[idField]) body[idField] = await genId(idPrefix, idDigits);
    return Model.create(body);
  });

  const getOne = apiHandler(async (req, { params }) => {
    const { id } = await params;
    const doc = await Model.findOne({ [idField]: id }).lean();
    if (!doc) throw Object.assign(new Error("ไม่พบข้อมูล"), { status: 404 });
    return doc;
  });

  const update = apiHandler(async (req, { params }) => {
    requireRole(req, perms);
    const { id } = await params;
    const body = await req.json();
    delete body[idField];
    delete body._id;
    const doc = await Model.findOneAndUpdate(
      { [idField]: id },
      { $set: body },
      { new: true }
    );
    if (!doc) throw Object.assign(new Error("ไม่พบข้อมูล"), { status: 404 });
    return doc;
  });

  // soft delete: set active=false (ข้อมูล operation ต้องไม่หาย)
  const remove = apiHandler(async (req, { params }) => {
    requireRole(req, perms);
    const { id } = await params;
    const doc = await Model.findOneAndUpdate(
      { [idField]: id },
      { $set: { active: false } },
      { new: true }
    );
    if (!doc) throw Object.assign(new Error("ไม่พบข้อมูล"), { status: 404 });
    return doc;
  });

  return { list, create, getOne, update, remove };
}
