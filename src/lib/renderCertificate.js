const SVG_NS = "http://www.w3.org/2000/svg";
const FRAME_INNER_MAX_WIDTH = 680; // frame spans x40..818; leaves margin either side

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fillPlaceholders(templateText, record) {
  const map = {
    "{{DISPLAY_NAME}}": record.display_name,
    "{{ROLE}}": record.role,
    "{{JOURNAL}}": record.journal,
    "{{VALID_FROM}}": record.valid_from,
    "{{VALID_UNTIL}}": record.valid_until,
    "{{CERTIFICATE_ID}}": record.certificate_id,
    "{{SIGNATORY_NAME}}": record.signatory_name || "",
    "{{SIGNATORY_TITLE}}": record.signatory_title || "",
    "{{ISSN}}": record.issn || "",
  };
  let out = templateText;
  for (const [token, value] of Object.entries(map)) {
    out = out.split(token).join(escapeXml(value));
  }
  return out;
}

// Shrinks a live (DOM-attached) <text> element's font-size (and letter-spacing,
// proportionally) until it fits maxWidth, down to minSize. Returns true if it
// still overflows at minSize, so the caller can fall back to wrapping.
function shrinkToFit(textEl, maxWidth, minSize) {
  const originalSize = parseFloat(textEl.getAttribute("font-size"));
  const originalSpacing = parseFloat(textEl.getAttribute("letter-spacing") || "0");
  const length = textEl.getComputedTextLength();
  if (length <= maxWidth) return false;

  const ratio = maxWidth / length;
  const newSize = Math.max(originalSize * ratio, minSize);
  textEl.setAttribute("font-size", newSize.toFixed(1));
  if (originalSpacing) {
    textEl.setAttribute(
      "letter-spacing",
      ((originalSpacing * newSize) / originalSize).toFixed(2)
    );
  }
  return textEl.getComputedTextLength() > maxWidth;
}

function wrapIntoTwoLines(textEl, text, centerY, lineHeight) {
  const mid = Math.floor(text.length / 2);
  let splitAt = text.lastIndexOf(" ", mid);
  if (splitAt === -1) splitAt = text.indexOf(" ", mid);
  if (splitAt === -1) return; // single unbreakable word, leave as-is

  const x = textEl.getAttribute("x");
  const line1 = text.slice(0, splitAt);
  const line2 = text.slice(splitAt + 1);

  while (textEl.firstChild) textEl.removeChild(textEl.firstChild);

  const tspan1 = document.createElementNS(SVG_NS, "tspan");
  tspan1.setAttribute("x", x);
  tspan1.setAttribute("y", (centerY - lineHeight / 2).toFixed(1));
  tspan1.textContent = line1;

  const tspan2 = document.createElementNS(SVG_NS, "tspan");
  tspan2.setAttribute("x", x);
  tspan2.setAttribute("y", (centerY + lineHeight / 2).toFixed(1));
  tspan2.textContent = line2;

  textEl.appendChild(tspan1);
  textEl.appendChild(tspan2);
}

function fitAllText(svgEl) {
  // querySelector, not getElementById: getElementById is a Document-only
  // method and this SVG root is a detached/off-screen Element.
  const nameEl = svgEl.querySelector("#field-name");
  const roleEl = svgEl.querySelector("#field-role");
  const journalEl = svgEl.querySelector("#field-journal");
  const signatoryEl = svgEl.querySelector("#field-signatory-name");

  if (nameEl) shrinkToFit(nameEl, FRAME_INNER_MAX_WIDTH, 22);
  if (roleEl) shrinkToFit(roleEl, FRAME_INNER_MAX_WIDTH, 14);
  // Signature line runs x=70..230 (160pt); leave a small margin either side.
  if (signatoryEl && signatoryEl.textContent) shrinkToFit(signatoryEl, 150, 16);

  if (journalEl) {
    const journalText = journalEl.textContent;
    const stillOverflows = shrinkToFit(journalEl, FRAME_INNER_MAX_WIDTH, 14);
    if (stillOverflows) {
      journalEl.setAttribute("font-size", "15");
      wrapIntoTwoLines(journalEl, journalText, 356, 18);
    }
  }
}

function removeIfEmpty(svgEl, id, value) {
  if (value) return;
  const el = svgEl.querySelector(`#${id}`);
  if (el) el.remove();
}

// record.seal is 'gold' (journal, named signatory), 'bronze' (Research
// Institute, named signatory), or 'silver' (nobody named -- the Secretariat
// stepping in, regardless of journal vs institute). Exactly one of the three
// seal groups is shown; the stamp-on-signature-line is silver-only and tied
// to secretariat_signed since it represents the same "no named signer" case.
function selectSeal(svgEl, seal, secretariatSigned) {
  const groups = {
    gold: svgEl.querySelector("#seal-standard"),
    bronze: svgEl.querySelector("#seal-institute"),
    silver: svgEl.querySelector("#seal-secretariat"),
  };
  for (const [key, el] of Object.entries(groups)) {
    if (el) el.setAttribute("display", key === seal ? "inline" : "none");
  }
  const stamp = svgEl.querySelector("#seal-signature-stamp");
  if (stamp) stamp.setAttribute("display", secretariatSigned ? "inline" : "none");
}

function injectQrCode(svgEl, qrDataUrl) {
  const slot = svgEl.querySelector("#qr-slot");
  if (!slot) return;
  const image = document.createElementNS(SVG_NS, "image");
  image.setAttribute("href", qrDataUrl);
  image.setAttribute("x", "596");
  image.setAttribute("y", "447");
  image.setAttribute("width", "66");
  image.setAttribute("height", "66");
  slot.appendChild(image);
}

export async function loadCertificateTemplate() {
  const res = await fetch("/templates/certificate.svg");
  if (!res.ok) throw new Error("Failed to load certificate template");
  return res.text();
}

// Fills the template with record data, fits the variable-length text fields
// to the frame, injects the QR code, and returns a serialized, self-contained
// SVG string ready to render or rasterize.
export function buildCertificateSvg(templateText, record, qrDataUrl) {
  const filled = fillPlaceholders(templateText, record);
  const parser = new DOMParser();
  const doc = parser.parseFromString(filled, "image/svg+xml");
  const svgEl = doc.documentElement;

  // getComputedTextLength requires layout, so mount off-screen before measuring.
  svgEl.style.position = "fixed";
  svgEl.style.left = "-9999px";
  svgEl.style.top = "0";
  document.body.appendChild(svgEl);

  try {
    removeIfEmpty(svgEl, "field-issn", record.issn);
    selectSeal(svgEl, record.seal, record.secretariat_signed);
    fitAllText(svgEl);
    injectQrCode(svgEl, qrDataUrl);
    // Strip the off-screen positioning before serializing — it was only ever
    // needed to get getComputedTextLength() to work, and would otherwise ship
    // inside the output and render the certificate off-screen wherever it's used.
    svgEl.removeAttribute("style");
    return new XMLSerializer().serializeToString(svgEl);
  } finally {
    document.body.removeChild(svgEl);
  }
}
