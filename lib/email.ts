import { Resend } from "resend";
import { formatPrice } from "./utils";
import { NEWSLETTER_DISCOUNT_CODE } from "./constants";

export interface OrderItem {
  productId: string;
  name: string;
  variant?: string;
  unitPrice: number;
  quantity: number;
}

/**
 * Notification emails via Resend (HTTP API). Configured entirely from the
 * environment so no credentials live in the repo.
 *
 * MAIL_FROM must be an address on a Resend-verified domain. For initial testing
 * Resend's shared sender "onboarding@resend.dev" works, but it only delivers to
 * the email you registered the Resend account with — so register Resend with
 * the same address as MAIL_TO.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const MAIL_FROM = process.env.MAIL_FROM ?? "Fagurul de Aur <onboarding@resend.dev>";
const MAIL_TO = process.env.MAIL_TO ?? "faguruldeaur@gmail.com";
// Where customer-facing emails route replies — the business inbox. Kept separate
// from MAIL_TO (the shop's internal notification inbox, which may differ).
const SHOP_REPLY_TO = process.env.SHOP_REPLY_TO ?? "faguruldeaur@gmail.com";

let client: Resend | null = null;

function getClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!client) {
    client = new Resend(RESEND_API_KEY);
  }
  return client;
}

interface OutgoingEmail {
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}

/** Send via Resend and throw on failure so the caller surfaces an error. */
async function send({ replyTo, subject, html, text }: OutgoingEmail): Promise<void> {
  const { error } = await getClient().emails.send({
    from: MAIL_FROM,
    to: MAIL_TO,
    replyTo,
    subject,
    html,
    text,
  });
  if (error) {
    throw new Error(`Resend error: ${error.name} — ${error.message}`);
  }
}

/** Escape user-supplied text before interpolating it into the HTML body. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Signature footer for every customer-facing email (shipping, cancellation,
// confirmation, newsletter welcome). Shop-facing notifications don't carry it.
// Inserted before the closing </div> of the HTML body; the text lines are
// spread after a blank separator line.
const CUSTOMER_FOOTER_HTML = `
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
      <p style="color:#888;font-size:13px;margin:0">
        <strong style="color:#B5700A">Fagurul de Aur</strong><br>
        <a href="https://faguruldeaur.ro" style="color:#B5700A">www.faguruldeaur.ro</a>
      </p>`;

const CUSTOMER_FOOTER_TEXT = ["—", "Fagurul de Aur", "www.faguruldeaur.ro"];

export interface OrderEmailData {
  orderId: string;
  customer: { firstName: string; lastName: string; email: string; phone: string };
  shippingAddress: { county: string; city: string; address: string; postalCode: string };
  paymentMethod: "card" | "ramburs";
  notes?: string;
  couponCode?: string | null;
  items: OrderItem[];
  totals: { subtotal: number; shipping: number; discount: number; total: number };
}

export async function sendOrderEmail(data: OrderEmailData): Promise<void> {
  const { customer, shippingAddress: addr, totals } = data;
  const payment = data.paymentMethod === "card" ? "Card" : "Ramburs (plata la livrare)";

  const rows = data.items
    .map(
      (i) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(i.name)}${
            i.variant ? ` <span style="color:#888">(${esc(i.variant)})</span>` : ""
          }</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${formatPrice(i.unitPrice)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${formatPrice(i.unitPrice * i.quantity)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:640px">
      <h2 style="color:#B5700A">Comandă nouă — ${esc(data.orderId)}</h2>
      <h3>Client</h3>
      <p>
        ${esc(customer.firstName)} ${esc(customer.lastName)}<br>
        Email: <a href="mailto:${esc(customer.email)}">${esc(customer.email)}</a><br>
        Telefon: ${esc(customer.phone)}
      </p>
      <h3>Adresă de livrare</h3>
      <p>
        ${esc(addr.address)}<br>
        ${esc(addr.city)}, jud. ${esc(addr.county)}, ${esc(addr.postalCode)}
      </p>
      <h3>Produse</h3>
      <table style="border-collapse:collapse;width:100%">
        <thead>
          <tr style="background:#f7f1e3">
            <th style="padding:6px 10px;text-align:left">Produs</th>
            <th style="padding:6px 10px;text-align:center">Cant.</th>
            <th style="padding:6px 10px;text-align:right">Preț unitar</th>
            <th style="padding:6px 10px;text-align:right">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px">
        Subtotal: ${formatPrice(totals.subtotal)}<br>
        ${
          totals.discount > 0
            ? `Reducere${data.couponCode ? ` (${esc(data.couponCode)})` : ""}: -${formatPrice(totals.discount)}<br>`
            : ""
        }Transport: ${formatPrice(totals.shipping)}<br>
        <strong style="font-size:16px">Total: ${formatPrice(totals.total)}</strong>
      </p>
      <p>Plată: <strong>${payment}</strong></p>
      ${data.notes ? `<h3>Observații</h3><p>${esc(data.notes)}</p>` : ""}
    </div>`;

  const text = [
    `Comandă nouă — ${data.orderId}`,
    ``,
    `Client: ${customer.firstName} ${customer.lastName}`,
    `Email: ${customer.email}`,
    `Telefon: ${customer.phone}`,
    ``,
    `Adresă: ${addr.address}, ${addr.city}, jud. ${addr.county}, ${addr.postalCode}`,
    ``,
    `Produse:`,
    ...data.items.map(
      (i) =>
        `- ${i.name}${i.variant ? ` (${i.variant})` : ""} x${i.quantity} — ${formatPrice(
          i.unitPrice
        )} (subtotal ${formatPrice(i.unitPrice * i.quantity)})`
    ),
    ``,
    `Subtotal: ${formatPrice(totals.subtotal)}`,
    ...(totals.discount > 0
      ? [`Reducere${data.couponCode ? ` (${data.couponCode})` : ""}: -${formatPrice(totals.discount)}`]
      : []),
    `Transport: ${formatPrice(totals.shipping)}`,
    `Total: ${formatPrice(totals.total)}`,
    `Plată: ${payment}`,
    ...(data.notes ? [``, `Observații: ${data.notes}`] : []),
  ].join("\n");

  await send({
    replyTo: customer.email,
    subject: `Comandă nouă ${data.orderId} — ${customer.firstName} ${customer.lastName}`,
    text,
    html,
  });
}

export interface ShippingEmailData {
  orderId: string;
  customerEmail: string;
  customerFirstName: string;
  courierCity: string;
  awb: string;
}

/**
 * Tells the CUSTOMER their parcel is on its way. Unlike the other senders (which
 * notify the shop at MAIL_TO), this goes to the customer's address, from the shop
 * (MAIL_FROM, a verified faguruldeaur.ro sender), with replies routed to the shop
 * inbox. Throws on failure so the caller can abort before persisting.
 */
export async function sendShippingEmail(data: ShippingEmailData): Promise<void> {
  const name = esc(data.customerFirstName);
  const orderId = esc(data.orderId);
  const city = esc(data.courierCity);
  const awb = esc(data.awb);

  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:560px">
      <h2 style="color:#B5700A">Comanda ta e pe drum 🚚</h2>
      <p>Salut ${name},</p>
      <p>
        Comanda <strong>${orderId}</strong> este în curs de livrare din sediul
        <strong>Fan Courier ${city}</strong>, cu numărul AWB <strong>${awb}</strong>.
      </p>
      <p>O poți urmări pe <a href="https://www.fancourier.ro/awb-tracking/" style="color:#B5700A">fancourier.ro</a> folosind codul AWB.</p>
      <p style="color:#888">Mulțumim că ai ales Fagurul de Aur! 🐝</p>${CUSTOMER_FOOTER_HTML}
    </div>`;

  const text = [
    `Comanda ta e pe drum`,
    ``,
    `Salut ${data.customerFirstName},`,
    `Comanda ${data.orderId} este în curs de livrare din sediul Fan Courier ${data.courierCity}, cu AWB ${data.awb}.`,
    `Urmărește pe: https://www.fancourier.ro/awb-tracking/`,
    ``,
    `Mulțumim că ai ales Fagurul de Aur!`,
    ``,
    ...CUSTOMER_FOOTER_TEXT,
  ].join("\n");

  const { error } = await getClient().emails.send({
    from: MAIL_FROM,
    to: data.customerEmail,
    replyTo: SHOP_REPLY_TO, // customer replies reach the business inbox
    subject: `Comanda ${data.orderId} a fost expediată`,
    html,
    text,
  });
  if (error) {
    throw new Error(`Resend error: ${error.name} — ${error.message}`);
  }
}

export interface CancellationEmailData {
  orderId: string;
  customerEmail: string;
  customerFirstName: string;
}

/**
 * Tells the CUSTOMER their order was cancelled. Like sendShippingEmail, it goes
 * to the customer from the shop sender (MAIL_FROM) with replies routed to the
 * shop inbox. Throws on failure so the caller can abort before persisting.
 */
export async function sendCancellationEmail(data: CancellationEmailData): Promise<void> {
  const name = esc(data.customerFirstName);
  const orderId = esc(data.orderId);

  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:560px">
      <h2 style="color:#B5700A">Comanda ta a fost anulată</h2>
      <p>Salut ${name},</p>
      <p>
        Ne pare rău, dar comanda <strong>${orderId}</strong> nu a putut fi procesată
        și a fost anulată. Te rugăm să refaci comanda.
      </p>
      <p><a href="https://faguruldeaur.ro/miere" style="color:#B5700A">Reia comanda →</a></p>
      <p style="color:#888">Îți mulțumim pentru înțelegere! 🐝</p>${CUSTOMER_FOOTER_HTML}
    </div>`;

  const text = [
    `Comanda ta a fost anulată`,
    ``,
    `Salut ${data.customerFirstName},`,
    `Ne pare rău, dar comanda ${data.orderId} nu a putut fi procesată și a fost anulată. Te rugăm să refaci comanda.`,
    `Reia comanda: https://faguruldeaur.ro/miere`,
    ``,
    `Îți mulțumim pentru înțelegere!`,
    ``,
    ...CUSTOMER_FOOTER_TEXT,
  ].join("\n");

  const { error } = await getClient().emails.send({
    from: MAIL_FROM,
    to: data.customerEmail,
    replyTo: SHOP_REPLY_TO, // customer replies reach the business inbox
    subject: `Comanda ${data.orderId} a fost anulată`,
    html,
    text,
  });
  if (error) {
    throw new Error(`Resend error: ${error.name} — ${error.message}`);
  }
}

export interface ConfirmationEmailData {
  orderId: string;
  customerEmail: string;
  customerFirstName: string;
}

/**
 * Tells the CUSTOMER their order was received and is being processed. Like
 * sendCancellationEmail, it goes to the customer from the shop sender (MAIL_FROM)
 * with replies routed to the shop inbox. Throws on failure so the caller can
 * abort before persisting.
 */
export async function sendConfirmationEmail(data: ConfirmationEmailData): Promise<void> {
  const name = esc(data.customerFirstName);
  const orderId = esc(data.orderId);

  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:560px">
      <h2 style="color:#B5700A">Comanda dumneavoastră este în curs de procesare !</h2>
      <p>Bună ziua ${name},</p>
      <p>
        Am primit comanda <strong>${orderId}</strong> și este în curs de procesare.
        Veți primi un email cu AWB-ul când aceasta va fi expediată.
      </p>
      <p style="color:#888">Vă mulțumim! 🐝</p>${CUSTOMER_FOOTER_HTML}
    </div>`;

  const text = [
    `Comanda dumneavoastră este în curs de procesare !`,
    ``,
    `Bună ziua ${data.customerFirstName},`,
    `Am primit comanda ${data.orderId} și este în curs de procesare. Veți primi un email cu AWB-ul când aceasta va fi expediată.`,
    ``,
    `Vă mulțumim!`,
    ``,
    ...CUSTOMER_FOOTER_TEXT,
  ].join("\n");

  const { error } = await getClient().emails.send({
    from: MAIL_FROM,
    to: data.customerEmail,
    replyTo: SHOP_REPLY_TO, // customer replies reach the business inbox
    subject: `Comanda ${data.orderId} a fost primită`,
    html,
    text,
  });
  if (error) {
    throw new Error(`Resend error: ${error.name} — ${error.message}`);
  }
}

export interface ContactEmailData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export async function sendContactEmail(data: ContactEmailData): Promise<void> {
  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:640px">
      <h2 style="color:#B5700A">Mesaj nou de contact</h2>
      <p>
        <strong>Nume:</strong> ${esc(data.name)}<br>
        <strong>Email:</strong> <a href="mailto:${esc(data.email)}">${esc(data.email)}</a><br>
        ${data.phone ? `<strong>Telefon:</strong> ${esc(data.phone)}<br>` : ""}
        <strong>Subiect:</strong> ${esc(data.subject)}
      </p>
      <h3>Mesaj</h3>
      <p style="white-space:pre-wrap">${esc(data.message)}</p>
    </div>`;

  const text = [
    `Mesaj nou de contact`,
    ``,
    `Nume: ${data.name}`,
    `Email: ${data.email}`,
    ...(data.phone ? [`Telefon: ${data.phone}`] : []),
    `Subiect: ${data.subject}`,
    ``,
    `Mesaj:`,
    data.message,
  ].join("\n");

  await send({
    replyTo: data.email,
    subject: `Mesaj contact: ${data.subject} — ${data.name}`,
    text,
    html,
  });
}

/**
 * Newsletter / exit-popup signup. Always notifies the shop (reliable, since it
 * delivers to MAIL_TO), then best-effort sends the welcome + discount code to
 * the subscriber. The latter only delivers once a sending domain is verified in
 * Resend — until then it fails quietly and the shop still captures the lead.
 */
export async function sendNewsletterSignup(
  email: string,
  source: "newsletter" | "popup"
): Promise<void> {
  const label = source === "popup" ? "pop-up (exit-intent)" : "formular newsletter";

  // 1) Lead notification to the shop.
  await send({
    replyTo: email,
    subject: `Abonare newsletter nouă — ${email}`,
    text: `Lead nou (${label})\nEmail: ${email}\nCod oferit: ${NEWSLETTER_DISCOUNT_CODE}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#222;max-width:640px">
        <h2 style="color:#B5700A">Abonare newsletter nouă</h2>
        <p>
          Sursă: ${esc(label)}<br>
          Email: <a href="mailto:${esc(email)}">${esc(email)}</a><br>
          Cod oferit: <strong>${NEWSLETTER_DISCOUNT_CODE}</strong>
        </p>
      </div>`,
  });

  // 2) Best-effort welcome to the subscriber (needs a verified domain in Resend).
  try {
    const { error } = await getClient().emails.send({
      from: MAIL_FROM,
      to: email,
      subject: "Reducerea ta de 5% la Fagurul de Aur",
      text: `Bun venit la Fagurul de Aur!\n\nCodul tău de 5% la prima comandă: ${NEWSLETTER_DISCOUNT_CODE}\n\nComandă miere pură din Gorj: https://faguruldeaur.ro/miere\n\n${CUSTOMER_FOOTER_TEXT.join("\n")}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#222;max-width:560px">
          <h2 style="color:#B5700A">Bun venit la Fagurul de Aur 🐝</h2>
          <p>Mulțumim că te-ai abonat! Iată reducerea ta:</p>
          <p style="font-size:22px;font-weight:bold;letter-spacing:2px;background:#f7f1e3;padding:14px 18px;border-radius:8px;display:inline-block">${NEWSLETTER_DISCOUNT_CODE}</p>
          <p>Folosește codul la prima comandă de miere artizanală, recoltată manual în Gorj.</p>
          <p><a href="https://faguruldeaur.ro/miere" style="color:#B5700A">Descoperă mierea →</a></p>${CUSTOMER_FOOTER_HTML}
        </div>`,
    });
    if (error) throw new Error(`${error.name} — ${error.message}`);
  } catch (welcomeError) {
    console.error(
      "Welcome email to subscriber failed (verify a sending domain in Resend to enable):",
      welcomeError
    );
  }
}
