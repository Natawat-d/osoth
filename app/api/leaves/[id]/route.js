import LeaveRequest from "@/models/LeaveRequest";
import { apiHandler, getAuth } from "@/lib/api";

const MANAGERS = ["super_admin", "admin"];

// PUT /api/leaves/[id] — admin อนุมัติ/ปฏิเสธ { status, review_note }
export const PUT = apiHandler(async (req, { params }) => {
  const auth = getAuth(req);
  if (!MANAGERS.includes(auth.role))
    throw Object.assign(new Error("เฉพาะ admin อนุมัติได้"), { status: 403 });
  const { id } = await params;
  const body = await req.json();
  if (!["approved", "rejected"].includes(body.status))
    throw Object.assign(new Error("สถานะไม่ถูกต้อง"), { status: 400 });

  const doc = await LeaveRequest.findOneAndUpdate(
    { leave_ID: id, status: "pending" },
    {
      $set: {
        status: body.status,
        review_note: body.review_note || "",
        reviewed_by: auth.user_ID,
        reviewed_at: new Date(),
      },
    },
    { new: true }
  );
  if (!doc) throw Object.assign(new Error("ไม่พบคำขอ หรือถูกดำเนินการไปแล้ว"), { status: 404 });
  return doc;
});
