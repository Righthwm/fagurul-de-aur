import { vi, describe, it, expect, beforeEach } from "vitest";

const { authMock, findUniqueMock, updateMock, sendShippingEmailMock, revalidateMock } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    findUniqueMock: vi.fn(),
    updateMock: vi.fn(),
    sendShippingEmailMock: vi.fn(),
    revalidateMock: vi.fn(),
  })
);
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findUnique: findUniqueMock, update: updateMock } },
}));
vi.mock("@/lib/email", () => ({ sendShippingEmail: sendShippingEmailMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));

import { markOrderShipped } from "@/app/admin/comenzi/actions";

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
