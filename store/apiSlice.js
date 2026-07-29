import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// ── RTK Query — data layer กลางของ V2 ──
// ทุก component เรียกข้อมูลผ่าน hook (useGetXQuery / useXMutation) ตรงจุดที่ใช้
// ไม่ fetch ใน parent แล้วส่ง props ต่อ · cache แชร์กันอัตโนมัติ (เรียกซ้ำไม่ยิง network ซ้ำ)
// mutation ประกาศ invalidatesTags → รายการที่เกี่ยวรีเฟรชเองทั้งแอป

const baseQuery = fetchBaseQuery({
  baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api`,
  credentials: "include", // cookie สำรอง
  prepareHeaders: (headers) => {
    // JWT Bearer จาก localStorage — ทำงานได้ทุก deploy (HTTP ที่ Secure cookie ไม่ถูกเก็บ)
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("osoth_token");
      if (token) headers.set("authorization", `Bearer ${token}`);
      const branch = localStorage.getItem("osoth_branch");
      if (branch !== null) headers.set("x-branch-id", branch);
    }
    return headers;
  },
});

// แกะ envelope { ok, data, error } ของ API เดิม → คืน data ตรงๆ ให้ component
const unwrapQuery = async (args, api, extra) => {
  const res = await baseQuery(args, api, extra);
  if (res.error) {
    const msg = res.error.data?.error || `HTTP ${res.error.status}`;
    return { error: { status: res.error.status, message: msg } };
  }
  if (res.data && res.data.ok === false)
    return { error: { status: 400, message: res.data.error || "error" } };
  return { data: res.data?.data ?? res.data };
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: unwrapQuery,
  tagTypes: [
    "SetupState", "Users", "Dashboard", "Company", "Notifications",
    "Reserves", "Opds", "Stock", "Products", "Courses", "Procedures", "Promotions",
    "PO", "Suppliers", "GlAccounts", "Journal", "ApBills", "Budgets", "FinReports", "Payroll",
  ],
  endpoints: (b) => ({
    // ---- setup / company ----
    getSetupState: b.query({
      query: () => "/setup/state",
      providesTags: ["SetupState"],
    }),
    registerOwner: b.mutation({
      query: (body) => ({ url: "/auth/register-owner", method: "POST", body }),
      invalidatesTags: ["SetupState", "Users"],
    }),

    // ---- auth ----
    loginUser: b.mutation({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
    }),
    logoutUser: b.mutation({
      query: () => ({ url: "/auth/logout", method: "POST" }),
    }),
    changePassword: b.mutation({
      query: (body) => ({ url: "/auth/change-password", method: "POST", body }),
    }),

    // ---- users (HR) ----
    getUsers: b.query({
      query: (params = "") => `/users${params}`,
      providesTags: ["Users"],
    }),
    createUser: b.mutation({
      query: (body) => ({ url: "/users", method: "POST", body }),
      invalidatesTags: ["Users"],
    }),
    updateUser: b.mutation({
      query: ({ user_ID, ...body }) => ({ url: `/users/${user_ID}`, method: "PUT", body }),
      invalidatesTags: ["Users"],
    }),
    setUserLogin: b.mutation({
      query: ({ user_ID, ...body }) => ({ url: `/users/${user_ID}/login`, method: "POST", body }),
      invalidatesTags: ["Users"],
    }),

    // ---- dashboard (owner) ----
    getExecSummary: b.query({
      query: (qs = "") => `/executive/summary${qs}`,
      providesTags: ["Dashboard"],
    }),

    // ---- public (about_me) ----
    getPublicStorefront: b.query({
      query: () => "/public/storefront",
    }),
    getPublicCalendar: b.query({
      query: ({ branch_ID, date }) => `/public/calendar?branch_ID=${branch_ID}&date=${date}`,
    }),
    getPublicMonth: b.query({
      query: ({ branch_ID, month }) => `/public/month?branch_ID=${branch_ID}&month=${month}`,
    }),

    // ---- notifications (กระดิ่ง) ----
    getNotifications: b.query({
      query: () => "/notifications",
      providesTags: ["Notifications"],
    }),
    readNotifications: b.mutation({
      query: () => ({ url: "/notifications", method: "PUT" }),
      invalidatesTags: ["Notifications"],
    }),

    // ---- company (Setup) ----
    getCompany: b.query({
      query: () => "/company",
      providesTags: ["Company"],
    }),
    updateCompany: b.mutation({
      query: (body) => ({ url: "/company", method: "PUT", body }),
      invalidatesTags: ["Company", "SetupState"],
    }),

    // ---- catalogs (Setup: บริการ/สินค้า/คอร์ส) — generic CRUD ต่อ resource ----
    getList: b.query({
      // ใช้กับ resource ทั่วไป: {res:"products"} → GET /products
      query: ({ res, qs = "" }) => `/${res}${qs}`,
      providesTags: (r, e, { tag }) => (tag ? [tag] : []),
    }),
    createItem: b.mutation({
      query: ({ res, body }) => ({ url: `/${res}`, method: "POST", body }),
      invalidatesTags: (r, e, { tag }) => (tag ? [tag, "Dashboard"] : ["Dashboard"]),
    }),
    updateItem: b.mutation({
      query: ({ res, id, body }) => ({ url: `/${res}/${id}`, method: "PUT", body }),
      invalidatesTags: (r, e, { tag }) => (tag ? [tag, "Dashboard"] : ["Dashboard"]),
    }),
    deleteItem: b.mutation({
      query: ({ res, id }) => ({ url: `/${res}/${id}`, method: "DELETE" }),
      invalidatesTags: (r, e, { tag }) => (tag ? [tag, "Dashboard"] : ["Dashboard"]),
    }),

    // ---- inventory ----
    getStockSummary: b.query({
      query: () => "/stock/summary",
      providesTags: ["Stock"],
    }),
    receiveStock: b.mutation({
      query: (body) => ({ url: "/stock/receive", method: "POST", body }),
      invalidatesTags: ["Stock", "PO"],
    }),
    adjustStock: b.mutation({
      query: (body) => ({ url: "/stock/adjust", method: "POST", body }),
      invalidatesTags: ["Stock", "Journal", "FinReports"],
    }),
    getPOs: b.query({
      query: (qs = "") => `/purchase-orders${qs}`,
      providesTags: ["PO"],
    }),
    createPO: b.mutation({
      query: (body) => ({ url: "/purchase-orders", method: "POST", body }),
      invalidatesTags: ["PO"],
    }),
    receivePO: b.mutation({
      query: (po_ID) => ({ url: `/purchase-orders/${po_ID}/receive`, method: "POST" }),
      invalidatesTags: ["PO", "Stock", "ApBills", "Journal", "FinReports"],
    }),

    // ---- finance (GL บัญชีคู่) ----
    getGlAccounts: b.query({
      query: () => "/gl/accounts",
      providesTags: ["GlAccounts"],
    }),
    saveGlAccount: b.mutation({
      query: (body) => ({ url: "/gl/accounts", method: "POST", body }),
      invalidatesTags: ["GlAccounts", "FinReports"],
    }),
    getJournal: b.query({
      query: (qs = "") => `/gl/journal${qs}`,
      providesTags: ["Journal"],
    }),
    postJournal: b.mutation({
      query: (body) => ({ url: "/gl/journal", method: "POST", body }),
      invalidatesTags: ["Journal", "FinReports"],
    }),
    rebuildJournal: b.mutation({
      query: () => ({ url: "/gl/journal/rebuild", method: "POST" }),
      invalidatesTags: ["Journal", "FinReports"],
    }),
    getFinReport: b.query({
      // kind: trial-balance | pnl | ar | budget-vs-actual
      query: ({ kind, qs = "" }) => `/gl/reports/${kind}${qs}`,
      providesTags: ["FinReports"],
    }),
    getSuppliers: b.query({
      query: () => "/suppliers",
      providesTags: ["Suppliers"],
    }),
    saveSupplier: b.mutation({
      query: (body) => ({ url: "/suppliers", method: "POST", body }),
      invalidatesTags: ["Suppliers"],
    }),
    getApBills: b.query({
      query: (qs = "") => `/ap/bills${qs}`,
      providesTags: ["ApBills"],
    }),
    createApBill: b.mutation({
      query: (body) => ({ url: "/ap/bills", method: "POST", body }),
      invalidatesTags: ["ApBills", "Journal", "FinReports"],
    }),
    payApBill: b.mutation({
      query: ({ bill_ID, ...body }) => ({ url: `/ap/bills/${bill_ID}/pay`, method: "POST", body }),
      invalidatesTags: ["ApBills", "Journal", "FinReports"],
    }),
    getPayroll: b.query({
      query: (period) => `/payroll?period=${period}`,
      providesTags: ["Payroll"],
    }),
    savePayroll: b.mutation({
      query: (body) => ({ url: "/payroll", method: "POST", body }),
      invalidatesTags: ["Payroll", "Journal", "FinReports", "Dashboard"],
    }),
    uploadPayrollSlip: b.mutation({
      query: (body) => ({ url: "/payroll/slip", method: "POST", body }),
      invalidatesTags: ["Payroll"],
    }),
    getMyPayslip: b.query({
      query: (period) => `/payroll/slip?period=${period}`,
      providesTags: ["Payroll"],
    }),
    getBudgets: b.query({
      query: (qs = "") => `/budgets${qs}`,
      providesTags: ["Budgets"],
    }),
    saveBudget: b.mutation({
      query: (body) => ({ url: "/budgets", method: "POST", body }),
      invalidatesTags: ["Budgets", "FinReports"],
    }),
  }),
});

export const {
  useGetSetupStateQuery,
  useRegisterOwnerMutation,
  useLoginUserMutation,
  useLogoutUserMutation,
  useChangePasswordMutation,
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useSetUserLoginMutation,
  useGetExecSummaryQuery,
  useGetPublicStorefrontQuery,
  useGetPublicCalendarQuery,
  useGetPublicMonthQuery,
  useGetNotificationsQuery,
  useReadNotificationsMutation,
  useGetCompanyQuery,
  useUpdateCompanyMutation,
  useGetListQuery,
  useCreateItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
  useGetStockSummaryQuery,
  useReceiveStockMutation,
  useAdjustStockMutation,
  useGetPOsQuery,
  useCreatePOMutation,
  useReceivePOMutation,
  useGetGlAccountsQuery,
  useSaveGlAccountMutation,
  useGetJournalQuery,
  usePostJournalMutation,
  useRebuildJournalMutation,
  useGetFinReportQuery,
  useGetSuppliersQuery,
  useSaveSupplierMutation,
  useGetApBillsQuery,
  useCreateApBillMutation,
  usePayApBillMutation,
  useGetPayrollQuery,
  useSavePayrollMutation,
  useUploadPayrollSlipMutation,
  useGetMyPayslipQuery,
  useGetBudgetsQuery,
  useSaveBudgetMutation,
} = apiSlice;
