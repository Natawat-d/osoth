import { apiHandler, requireRole, getAuth } from "@/lib/api";
import { genId } from "@/services/ids";

// สร้าง GET(list)/POST(create) และ GET/PUT/DELETE(byId) มาตรฐานให้ collection ทั่วไป
// options: { idField, idPrefix, idDigits, listFilter(searchParams), perms, branchScoped }
// branchScoped=true: catalog แยกต่อสาขา — owner (super_admin) เห็นทุกสาขา, คนอื่นเห็นเฉพาะสาขาตัว
export function makeCrud(Model, options) {
  const {
    idField,
    idPrefix,
    idDigits = 3,
    listFilter = () => ({}),
    perms = ["crud"],
    readPerms = null,             // จำกัดสิทธิ์ "อ่าน" (list/getOne) — ไม่ตั้ง = แค่ login (apiHandler บังคับอยู่แล้ว)
    branchScoped = false,
    beforeWrite = (body) => body, // sanitize/แปลง body ก่อน create/update
    select = null,                // projection ตอน list (เช่น "-password_hash")
  } = options;

  const list = apiHandler(async (req) => {
    if (readPerms) requireRole(req, readPerms);
    const sp = new URL(req.url).searchParams;
    const filter = listFilter(sp);
    if (branchScoped) {
      const auth = getAuth(req);
      // scope ตามสาขาที่เลือก (header/query); owner เลือก "ทุกสาขา" (branch ว่าง) = เห็นทั้งหมด
      const wantBranch = sp.get("branch_ID") || auth.branch_ID;
      if (wantBranch) filter.branch_ID = wantBranch;
    } else if (sp.get("branch_ID")) {
      filter.branch_ID = sp.get("branch_ID");
    }
    const q = Model.find(filter).sort({ created_at: -1 });
    if (select) q.select(select);
    return q.lean();
  });

  const create = apiHandler(async (req) => {
    const auth = requireRole(req, perms);
    const body = beforeWrite(await req.json(), { auth, mode: "create" });
    if (!body[idField]) body[idField] = await genId(idPrefix, idDigits);
    if (branchScoped && !body.branch_ID) body.branch_ID = auth.branch_ID;
    return Model.create(body);
  });

  const getOne = apiHandler(async (req, { params }) => {
    if (readPerms) requireRole(req, readPerms);
    const { id } = await params;
    const doc = await Model.findOne({ [idField]: id }).lean();
    if (!doc) throw Object.assign(new Error("ไม่พบข้อมูล"), { status: 404 });
    return doc;
  });

  const update = apiHandler(async (req, { params }) => {
    const auth = requireRole(req, perms);
    const { id } = await params;
    const body = beforeWrite(await req.json(), { auth, mode: "update" });
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
