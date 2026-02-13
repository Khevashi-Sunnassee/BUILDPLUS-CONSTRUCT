import { describe, it, expect, beforeAll } from "vitest";
import {
  loginAdmin,
  adminGet,
  adminPost,
  adminPatch,
  adminDelete,
  uniqueName,
  isAdminLoggedIn,
} from "./e2e-helpers";

let jobId = "";
let employeeId = "";
let supplierId = "";
let bookingId = "";
let createdSupplierId = "";

beforeAll(async () => {
  await loginAdmin();

  const jobsRes = await adminGet("/api/jobs");
  const jobs = await jobsRes.json();
  jobId = jobs[0]?.id;
  expect(jobId).toBeTruthy();

  const empRes = await adminGet("/api/employees");
  const employees = await empRes.json();
  employeeId = employees[0]?.id;
  expect(employeeId).toBeTruthy();

  const supRes = await adminGet("/api/procurement/suppliers");
  const suppliers = await supRes.json();
  if (suppliers.length > 0) {
    supplierId = suppliers[0]?.id;
  } else {
    const createRes = await adminPost("/api/procurement/suppliers", {
      companyId: "1",
      name: uniqueName("SUP"),
      contactName: "E2E Test",
      email: "e2e@test.com",
      phone: "0400000000",
      isActive: true,
    });
    if (createRes.status === 200 || createRes.status === 201) {
      const created = await createRes.json();
      supplierId = created.id;
      createdSupplierId = created.id;
    }
  }
  expect(supplierId).toBeTruthy();
});

describe.skipIf(!isAdminLoggedIn())("E2E: Hire Booking Workflow", () => {
  it("should create a new hire booking in DRAFT status", async () => {
    const res = await adminPost("/api/hire-bookings", {
      hireSource: "external",
      equipmentDescription: "E2E Test Excavator",
      assetCategoryIndex: 0,
      supplierId,
      jobId,
      requestedByUserId: employeeId,
      responsiblePersonUserId: employeeId,
      hireStartDate: new Date().toISOString().split("T")[0],
      hireEndDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      rateType: "day",
      rateAmount: "250.00",
      chargeRule: "calendar_days",
      quantity: 1,
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    bookingId = data.id;
    expect(data.status).toBe("DRAFT");
    expect(data.equipmentDescription).toBe("E2E Test Excavator");
  });

  it("should update booking details while in DRAFT", async () => {
    if (!bookingId) return;
    const res = await adminPatch(`/api/hire-bookings/${bookingId}`, {
      notes: "E2E updated notes",
      rateAmount: "300.00",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notes).toBe("E2E updated notes");
  });

  it("should submit booking (DRAFT → REQUESTED)", async () => {
    if (!bookingId) return;
    const res = await adminPost(`/api/hire-bookings/${bookingId}/submit`, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("REQUESTED");
  });

  it("should approve booking (REQUESTED → APPROVED)", async () => {
    if (!bookingId) return;
    const res = await adminPost(`/api/hire-bookings/${bookingId}/approve`, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("APPROVED");
  });

  it("should book the equipment (APPROVED → BOOKED)", async () => {
    if (!bookingId) return;
    const res = await adminPost(`/api/hire-bookings/${bookingId}/book`, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("BOOKED");
  });

  it("should mark as picked up (BOOKED → PICKED_UP)", async () => {
    if (!bookingId) return;
    const res = await adminPost(`/api/hire-bookings/${bookingId}/pickup`, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("PICKED_UP");
  });

  it("should mark as on hire (PICKED_UP → ON_HIRE)", async () => {
    if (!bookingId) return;
    const res = await adminPost(`/api/hire-bookings/${bookingId}/on-hire`, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ON_HIRE");
  });

  it("should return equipment (ON_HIRE → RETURNED)", async () => {
    if (!bookingId) return;
    const res = await adminPost(`/api/hire-bookings/${bookingId}/return`, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("RETURNED");
  });

  it("should close booking (RETURNED → CLOSED)", async () => {
    if (!bookingId) return;
    const res = await adminPost(`/api/hire-bookings/${bookingId}/close`, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("CLOSED");
  });

  it("should list hire bookings and find the completed one", async () => {
    if (!bookingId) return;
    const res = await adminGet("/api/hire-bookings");
    expect(res.status).toBe(200);
    const data = await res.json();
    const bookings = Array.isArray(data) ? data : data.bookings || [];
    const found = bookings.find((b: { id: string }) => String(b.id) === String(bookingId));
    expect(found).toBeDefined();
    expect(found.status).toBe("CLOSED");
  });

  it("should not allow deleting a non-DRAFT booking", async () => {
    if (!bookingId) return;
    const res = await adminDelete(`/api/hire-bookings/${bookingId}`);
    expect(res.status).toBe(400);
  });
});

describe.skipIf(!isAdminLoggedIn())("E2E: Hire Booking - Cancel Flow", () => {
  let cancelBookingId = "";

  it("should create and cancel a booking from DRAFT", async () => {
    const createRes = await adminPost("/api/hire-bookings", {
      hireSource: "external",
      equipmentDescription: "E2E Cancel Test",
      assetCategoryIndex: 1,
      supplierId,
      jobId,
      requestedByUserId: employeeId,
      responsiblePersonUserId: employeeId,
      hireStartDate: new Date().toISOString().split("T")[0],
      hireEndDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
      rateType: "day",
      rateAmount: "100.00",
      chargeRule: "calendar_days",
      quantity: 1,
    });
    expect(createRes.status).toBe(201);
    const booking = await createRes.json();
    cancelBookingId = booking.id;

    const cancelRes = await adminPost(`/api/hire-bookings/${cancelBookingId}/cancel`, {});
    expect(cancelRes.status).toBe(200);
    const cancelled = await cancelRes.json();
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("should not allow deleting a cancelled booking", async () => {
    if (!cancelBookingId) return;
    const res = await adminDelete(`/api/hire-bookings/${cancelBookingId}`);
    expect(res.status).toBe(400);
  });
});

describe.skipIf(!isAdminLoggedIn())("E2E: Hire Booking - Rejection Flow", () => {
  let rejectBookingId = "";

  it("should create, submit, and reject a booking (transitions to CANCELLED)", async () => {
    const createRes = await adminPost("/api/hire-bookings", {
      hireSource: "external",
      equipmentDescription: "E2E Rejection Test",
      assetCategoryIndex: 2,
      supplierId,
      jobId,
      requestedByUserId: employeeId,
      responsiblePersonUserId: employeeId,
      hireStartDate: new Date().toISOString().split("T")[0],
      hireEndDate: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
      rateType: "week",
      rateAmount: "1500.00",
      chargeRule: "calendar_days",
      quantity: 1,
    });
    expect(createRes.status).toBe(201);
    const booking = await createRes.json();
    rejectBookingId = booking.id;

    await adminPost(`/api/hire-bookings/${rejectBookingId}/submit`, {});

    const rejectRes = await adminPost(`/api/hire-bookings/${rejectBookingId}/reject`, {});
    expect(rejectRes.status).toBe(200);
    const rejected = await rejectRes.json();
    expect(rejected.status).toBe("CANCELLED");
  });

  it("should not allow deleting a rejected/cancelled booking", async () => {
    if (!rejectBookingId) return;
    const res = await adminDelete(`/api/hire-bookings/${rejectBookingId}`);
    expect(res.status).toBe(400);
  });
});
