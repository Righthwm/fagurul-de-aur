import { vi, describe, it, expect, beforeEach } from "vitest";

const {
  authMock,
  findUniqueMock,
  updateMock,
  deleteMock,
  sendShippingEmailMock,
  sendCancellationEmailMock,
  sendConfirmationEmailMock,
  revalidateMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  sendShippingEmailMock: vi.fn(),
  sendCancellationEmailMock: vi.fn(),
  sendConfirmationEmailMock: vi.fn(),
  revalidateMock: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findUnique: findUniqueMock, update: updateMock, delete: deleteMock } },
}));
vi.mock("@/lib/email", () => ({
  sendShippingEmail: sendShippingEmailMock,
  sendCancellationEmail: sendCancellationEmailMock,
  sendConfirmationEmail: sendConfirmationEmailMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));

import { markOrderShipped, confirmOrder, cancelOrder, deleteOrder } from "@/app/admin/comenzi/actions";

const order = { orderNumber: "SB-1", customerEmail: "c@x.ro", customerFirstName: "Ana" };

describe("markOrderShipped", () => {
  beforeEach(() => {
    authMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    sendShippingEmailMock.mockReset();
    revalidateMock.mockReset();
    authMock.mockResolvedValue({ user: { role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(order);
    sendShippingEmailMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue(order);
  });

  it("rejects non-admins", async () => {
    authMock.mockResolvedValue({ user: { role: "CLIENT" } });
    await expect(markOrderShipped("SB-1", "Târgu Jiu", "AWB1")).rejects.toThrow(/unauthorized/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects blank city or AWB without touching the DB", async () => {
    const res = await markOrderShipped("SB-1", "  ", "AWB1");
    expect(res).toEqual({ ok: false, error: expect.any(String) });
    expect(sendShippingEmailMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does NOT update the order when the email fails (all-or-nothing)", async () => {
    sendShippingEmailMock.mockRejectedValue(new Error("smtp down"));
    const res = await markOrderShipped("SB-1", "Târgu Jiu", "AWB1");
    expect(res.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("emails then persists status + awb + city on success", async () => {
    const res = await markOrderShipped("SB-1", "Târgu Jiu", "AWB123");
    expect(res).toEqual({ ok: true });
    expect(sendShippingEmailMock).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalledWith({
      where: { orderNumber: "SB-1" },
      data: { awb: "AWB123", courierCity: "Târgu Jiu", status: "expediat" },
    });
    expect(revalidateMock).toHaveBeenCalledWith("/admin/comenzi");
  });
});

describe("cancelOrder", () => {
  const cancellable = {
    orderNumber: "SB-1",
    customerEmail: "c@x.ro",
    customerFirstName: "Ana",
    status: "noua",
  };

  beforeEach(() => {
    authMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    sendCancellationEmailMock.mockReset();
    revalidateMock.mockReset();
    authMock.mockResolvedValue({ user: { role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(cancellable);
    sendCancellationEmailMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue({});
  });

  it("rejects non-admins", async () => {
    authMock.mockResolvedValue({ user: { role: "CLIENT" } });
    await expect(cancelOrder("SB-1")).rejects.toThrow(/unauthorized/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("refuses an already-shipped order", async () => {
    findUniqueMock.mockResolvedValue({ ...cancellable, status: "expediat" });
    const res = await cancelOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(sendCancellationEmailMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("refuses an already-cancelled order", async () => {
    findUniqueMock.mockResolvedValue({ ...cancellable, status: "anulata" });
    const res = await cancelOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does NOT update when the email fails (all-or-nothing)", async () => {
    sendCancellationEmailMock.mockRejectedValue(new Error("smtp down"));
    const res = await cancelOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("emails then sets status anulata on success", async () => {
    const res = await cancelOrder("SB-1");
    expect(res).toEqual({ ok: true });
    expect(sendCancellationEmailMock).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalledWith({
      where: { orderNumber: "SB-1" },
      data: { status: "anulata" },
    });
    expect(revalidateMock).toHaveBeenCalledWith("/admin/comenzi");
  });
});

describe("deleteOrder", () => {
  beforeEach(() => {
    authMock.mockReset();
    deleteMock.mockReset();
    revalidateMock.mockReset();
    authMock.mockResolvedValue({ user: { role: "ADMIN" } });
    deleteMock.mockResolvedValue({});
  });

  it("rejects non-admins", async () => {
    authMock.mockResolvedValue({ user: { role: "CLIENT" } });
    await expect(deleteOrder("SB-1")).rejects.toThrow(/unauthorized/i);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("deletes the order and revalidates on success", async () => {
    const res = await deleteOrder("SB-1");
    expect(res).toEqual({ ok: true });
    expect(deleteMock).toHaveBeenCalledWith({ where: { orderNumber: "SB-1" } });
    expect(revalidateMock).toHaveBeenCalledWith("/admin/comenzi");
  });

  it("returns an error when the delete throws (missing row)", async () => {
    deleteMock.mockRejectedValue(new Error("P2025"));
    const res = await deleteOrder("SB-1");
    expect(res).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe("confirmOrder", () => {
  const confirmable = {
    orderNumber: "SB-1",
    customerEmail: "c@x.ro",
    customerFirstName: "Ana",
    status: "noua",
  };

  beforeEach(() => {
    authMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    sendConfirmationEmailMock.mockReset();
    revalidateMock.mockReset();
    authMock.mockResolvedValue({ user: { role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(confirmable);
    sendConfirmationEmailMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue({});
  });

  it("rejects non-admins", async () => {
    authMock.mockResolvedValue({ user: { role: "CLIENT" } });
    await expect(confirmOrder("SB-1")).rejects.toThrow(/unauthorized/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("refuses an order that is not new", async () => {
    findUniqueMock.mockResolvedValue({ ...confirmable, status: "in_procesare" });
    const res = await confirmOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(sendConfirmationEmailMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns an error when the order is missing", async () => {
    findUniqueMock.mockResolvedValue(null);
    const res = await confirmOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(sendConfirmationEmailMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does NOT update when the email fails (all-or-nothing)", async () => {
    sendConfirmationEmailMock.mockRejectedValue(new Error("smtp down"));
    const res = await confirmOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("emails then sets status in_procesare on success", async () => {
    const res = await confirmOrder("SB-1");
    expect(res).toEqual({ ok: true });
    expect(sendConfirmationEmailMock).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalledWith({
      where: { orderNumber: "SB-1" },
      data: { status: "in_procesare" },
    });
    expect(revalidateMock).toHaveBeenCalledWith("/admin/comenzi");
  });
});
