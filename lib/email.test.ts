import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock Resend so no real email is sent. vi.hoisted lets the factory see the spy.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock("resend", () => ({
  // Regular function so `new Resend()` works (arrow functions aren't constructors).
  Resend: vi.fn(function () {
    return { emails: { send: sendMock } };
  }),
}));

import { sendShippingEmail, sendCancellationEmail, sendConfirmationEmail } from "@/lib/email";

describe("sendShippingEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ error: null });
  });

  it("sends to the customer, replying to the shop inbox, with city + AWB", async () => {
    await sendShippingEmail({
      orderId: "SB-1",
      customerEmail: "client@example.com",
      customerFirstName: "Ana",
      courierCity: "Târgu Jiu",
      awb: "AWB123456",
    });
    expect(sendMock).toHaveBeenCalledOnce();
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("client@example.com");
    expect(arg.replyTo).toBe("faguruldeaur@gmail.com");
    expect(arg.subject).toContain("SB-1");
    expect(arg.text).toContain("Târgu Jiu");
    expect(arg.text).toContain("AWB123456");
    expect(arg.html).toContain("AWB123456");
    expect(arg.html).toContain("www.faguruldeaur.ro");
    expect(arg.text).toContain("www.faguruldeaur.ro");
  });

  it("escapes HTML in customer-controlled fields", async () => {
    await sendShippingEmail({
      orderId: "SB-2",
      customerEmail: "x@y.z",
      customerFirstName: "<b>x</b>",
      courierCity: "A&B",
      awb: "1",
    });
    const arg = sendMock.mock.calls[0][0];
    expect(arg.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(arg.html).toContain("A&amp;B");
  });

  it("throws when Resend returns an error", async () => {
    sendMock.mockResolvedValue({ error: { name: "bad", message: "nope" } });
    await expect(
      sendShippingEmail({
        orderId: "SB-3",
        customerEmail: "x@y.z",
        customerFirstName: "A",
        courierCity: "B",
        awb: "1",
      })
    ).rejects.toThrow(/nope/);
  });
});

describe("sendCancellationEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ error: null });
  });

  it("sends to the customer, replying to the shop inbox, with the cancellation message", async () => {
    await sendCancellationEmail({
      orderId: "SB-9",
      customerEmail: "client@example.com",
      customerFirstName: "Ana",
    });
    expect(sendMock).toHaveBeenCalledOnce();
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("client@example.com");
    expect(arg.replyTo).toBe("faguruldeaur@gmail.com");
    expect(arg.subject).toContain("SB-9");
    expect(arg.text).toContain("a fost anulată");
    expect(arg.html).toContain("a fost anulată");
    expect(arg.html).toContain("www.faguruldeaur.ro");
    expect(arg.text).toContain("www.faguruldeaur.ro");
  });

  it("escapes HTML in the customer name", async () => {
    await sendCancellationEmail({
      orderId: "SB-10",
      customerEmail: "x@y.z",
      customerFirstName: "<b>x</b>",
    });
    const arg = sendMock.mock.calls[0][0];
    expect(arg.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("throws when Resend returns an error", async () => {
    sendMock.mockResolvedValue({ error: { name: "bad", message: "nope" } });
    await expect(
      sendCancellationEmail({ orderId: "SB-11", customerEmail: "x@y.z", customerFirstName: "A" })
    ).rejects.toThrow(/nope/);
  });
});

describe("sendConfirmationEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ error: null });
  });

  it("sends to the customer, replying to the shop inbox, with the processing message", async () => {
    await sendConfirmationEmail({
      orderId: "SB-7",
      customerEmail: "client@example.com",
      customerFirstName: "Ana",
    });
    expect(sendMock).toHaveBeenCalledOnce();
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("client@example.com");
    expect(arg.replyTo).toBe("faguruldeaur@gmail.com");
    expect(arg.subject).toContain("SB-7");
    expect(arg.text).toContain("în curs de procesare");
    expect(arg.html).toContain("în curs de procesare");
    expect(arg.html).toContain("www.faguruldeaur.ro");
    expect(arg.text).toContain("www.faguruldeaur.ro");
  });

  it("escapes HTML in the customer name", async () => {
    await sendConfirmationEmail({
      orderId: "SB-8",
      customerEmail: "x@y.z",
      customerFirstName: "<b>x</b>",
    });
    const arg = sendMock.mock.calls[0][0];
    expect(arg.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("throws when Resend returns an error", async () => {
    sendMock.mockResolvedValue({ error: { name: "bad", message: "nope" } });
    await expect(
      sendConfirmationEmail({ orderId: "SB-9", customerEmail: "x@y.z", customerFirstName: "A" })
    ).rejects.toThrow(/nope/);
  });
});
