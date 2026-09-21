/**
 * Handing the guardian a report over WhatsApp.
 *
 * WhatsApp has no way for a web page to attach a file to a chat — `wa.me` only carries
 * text — so the message carries a private link instead, and the link opens the same PDF
 * the teacher exports under FR15. The parent taps once and the report is on their phone.
 *
 * The parent still holds no account and remains outside the system boundary of Figure 1.1:
 * the link expires, it can be revoked, and every open is written to the audit trail.
 */

/**
 * WhatsApp addresses a chat by digits only — no +, no spaces, no dashes — and needs the
 * country code. Saudi numbers are stored locally as often as internationally, so a leading
 * 0 is swapped for 966 and a bare 5xxxxxxxx is assumed to be Saudi. Any number already in
 * international form is left exactly as entered.
 */
export function toWhatsAppNumber(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `966${d.slice(1)}`;
  else if (d.length === 9 && d.startsWith("5")) d = `966${d}`;
  return d.length >= 8 ? d : null;
}

/** Fills {placeholders} in the localized message template. */
export function fillTemplate(template, vars) {
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v ?? ""), template);
}

/**
 * Opens WhatsApp on the guardian's chat with the message ready to send.
 *
 * The window is opened from the click that called this, so a pop-up blocker treats it as a
 * user action. `wa.me` picks the installed app on a phone and WhatsApp Web on a desktop.
 */
export function openWhatsApp(phone, message) {
  const number = toWhatsAppNumber(phone);
  if (!number) return false;
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  return true;
}
