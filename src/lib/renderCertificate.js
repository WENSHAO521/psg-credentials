const SVG_NS = "http://www.w3.org/2000/svg";
const FRAME_INNER_MAX_WIDTH = 680; // frame spans x40..818; leaves margin either side

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const MAX_AFFILIATIONS = 3;

// Institutions are separated by "; ". Beyond three, the certificate shows the
// first three and "et al."; the full list stays in the registry.
function capAffiliations(affiliation) {
  const parts = (affiliation || "").split(/;\s*/).filter(Boolean);
  if (parts.length <= MAX_AFFILIATIONS) return affiliation || "";
  return `${parts.slice(0, MAX_AFFILIATIONS).join("; ")} et al.`;
}

function fillPlaceholders(templateText, record) {
  const map = {
    "{{DISPLAY_NAME}}": record.display_name,
    "{{ROLE}}": record.role,
    "{{JOURNAL}}": record.journal,
    "{{VALID_FROM}}": record.valid_from,
    "{{VALID_UNTIL}}": record.valid_until,
    "{{ISSUE_DATE}}": record.issue_date || "",
    "{{DETAIL}}": record.detail || "",
    "{{AFFILIATION}}": capAffiliations(record.affiliation),
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

// Shrinks a centered text line to fit, falling back to a two-line wrap if
// it's still too long even at a reasonable minimum size. Reads its target
// centerY straight off the element's own y attribute (rather than a
// hardcoded value) so the same helper works for #field-journal and
// #field-detail regardless of which certificate template placed them --
// paper titles / conference names / journal names all vary in length and
// share this treatment.
function fitWithWrapFallback(el) {
  if (!el || !el.textContent) return;
  const originalSize = parseFloat(el.getAttribute("font-size"));
  const centerY = parseFloat(el.getAttribute("y"));
  const r = chooseWrap(el, el.textContent.split(/\s+/).filter(Boolean), {
    baseSize: originalSize,
    minSingleSize: Math.max(originalSize * 0.55, 10),
    maxWidth: FRAME_INNER_MAX_WIDTH,
    ellipsis: " …",
    tiers: [
      { size: originalSize * 0.8, lineHeight: originalSize, maxLines: 2 },
      { size: originalSize * 0.65, lineHeight: originalSize * 0.8, maxLines: 3 },
    ],
  });
  if (r.lines.length === 1) {
    el.textContent = r.lines[0];
    el.setAttribute("font-size", String(r.size));
    return;
  }
  // Lines are balanced around the original single-line position.
  setLines(el, r.lines, r.size, r.lineHeight, centerY - ((r.lines.length - 1) * r.lineHeight) / 2);
}

// ---- Multi-line flow layout (templates with a #body-flow group) -----------
// Used by the sponsorship certificate, whose name / affiliation / article
// title can run to many authors. Each block is wrapped on token boundaries
// (whole names, whole institutions, words) into as many lines as it needs,
// trying progressively smaller type; the lines below it are shifted down and
// the whole group is scaled to stay clear of the footer.

function measureText(el, str, size) {
  el.textContent = str;
  el.setAttribute("font-size", String(size));
  return el.getComputedTextLength();
}

function greedyLines(el, tokens, size, maxWidth) {
  const lines = [];
  let cur = "";
  for (const tok of tokens) {
    const next = cur ? `${cur} ${tok}` : tok;
    if (!cur || measureText(el, next, size) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = tok;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function fitsWidth(el, lines, size, maxWidth) {
  return lines.every((l) => measureText(el, l, size) <= maxWidth);
}

function setLines(el, lines, size, lineHeight, firstY) {
  el.textContent = "";
  el.setAttribute("font-size", String(size));
  const x = el.getAttribute("x");
  lines.forEach((line, i) => {
    const t = document.createElementNS(SVG_NS, "tspan");
    t.setAttribute("x", x);
    t.setAttribute("y", (firstY + i * lineHeight).toFixed(1));
    t.textContent = line;
    el.appendChild(t);
  });
}

// tiers: [{ size, lineHeight, maxLines }] from largest to smallest type. The
// first tier is tried as a single line that may shrink to `minSingleSize`.
// Returns { lines, size, lineHeight }. When even the last tier overflows,
// trailing tokens are dropped and `ellipsis` appended.
function chooseWrap(el, tokens, { baseSize, minSingleSize, tiers, ellipsis, maxWidth }) {
  const full = tokens.join(" ");
  const w = measureText(el, full, baseSize);
  if (w <= maxWidth) return { lines: [full], size: baseSize, lineHeight: 0 };
  const shrunk = baseSize * (maxWidth / w);
  if (shrunk >= minSingleSize && measureText(el, full, shrunk) <= maxWidth) {
    return { lines: [full], size: Number(shrunk.toFixed(1)), lineHeight: 0 };
  }
  for (const tier of tiers) {
    const lines = greedyLines(el, tokens, tier.size, maxWidth);
    if (lines.length <= tier.maxLines && fitsWidth(el, lines, tier.size, maxWidth)) {
      return { lines, size: tier.size, lineHeight: tier.lineHeight };
    }
  }
  const last = tiers[tiers.length - 1];
  const kept = tokens.slice();
  while (kept.length > 1) {
    kept.pop();
    const text = [...kept.slice(0, -1), kept[kept.length - 1].replace(/[,;]$/, "") + ellipsis];
    const lines = greedyLines(el, text, last.size, maxWidth);
    if (lines.length <= last.maxLines && fitsWidth(el, lines, last.size, maxWidth)) {
      return { lines, size: last.size, lineHeight: last.lineHeight };
    }
  }
  return { lines: greedyLines(el, kept, last.size, maxWidth).slice(0, last.maxLines), size: last.size, lineHeight: last.lineHeight };
}

// "A, B, C and D" -> ["A,", "B,", "C", "and D"]: wrap between people, never inside a name.
function nameTokens(text) {
  return text.split(/(?<=,)\s+|\s+(?=and\s)/).filter(Boolean);
}

function fitBodyFlow(svgEl, flow) {
  const nameEl = svgEl.querySelector("#field-name");
  const affEl = svgEl.querySelector("#field-affiliation");
  const detailEl = svgEl.querySelector("#field-detail");
  const W = FRAME_INNER_MAX_WIDTH;
  const shifts = []; // { y, d }: elements below original baseline y move down by d

  if (nameEl && nameEl.textContent) {
    const y0 = parseFloat(nameEl.getAttribute("y"));
    const base = parseFloat(nameEl.getAttribute("font-size"));
    const r = chooseWrap(nameEl, nameTokens(nameEl.textContent), {
      baseSize: base, minSingleSize: 30, maxWidth: W, ellipsis: ", et al.",
      tiers: [
        { size: 28, lineHeight: 32, maxLines: 2 },
        { size: 22, lineHeight: 26, maxLines: 3 },
        { size: 18, lineHeight: 21, maxLines: 4 },
      ],
    });
    if (r.lines.length === 1) {
      nameEl.textContent = r.lines[0];
      nameEl.setAttribute("font-size", String(r.size));
    } else {
      const top = y0 - 0.72 * base; // keep the cap line where a one-line name puts it
      const first = top + 0.72 * r.size;
      setLines(nameEl, r.lines, r.size, r.lineHeight, first);
      shifts.push({ y: y0, d: first + (r.lines.length - 1) * r.lineHeight - y0 });
    }
  }

  if (affEl && affEl.textContent) {
    const y0 = parseFloat(affEl.getAttribute("y"));
    const base = parseFloat(affEl.getAttribute("font-size"));
    const tokens = affEl.textContent.split(/(?<=;)\s+/).filter(Boolean);
    const r = chooseWrap(affEl, tokens, {
      baseSize: base, minSingleSize: 10, maxWidth: W, ellipsis: " …",
      tiers: [
        { size: 11, lineHeight: 14, maxLines: 2 },
        { size: 10, lineHeight: 13, maxLines: 3 },
      ],
    });
    if (r.lines.length === 1) {
      affEl.textContent = r.lines[0];
      affEl.setAttribute("font-size", String(r.size));
    } else {
      setLines(affEl, r.lines, r.size, r.lineHeight, y0);
      shifts.push({ y: y0, d: (r.lines.length - 1) * r.lineHeight });
    }
  }

  if (detailEl && detailEl.textContent) {
    const y0 = parseFloat(detailEl.getAttribute("y"));
    const base = parseFloat(detailEl.getAttribute("font-size"));
    const r = chooseWrap(detailEl, detailEl.textContent.split(/\s+/).filter(Boolean), {
      baseSize: base, minSingleSize: 15, maxWidth: W, ellipsis: " …",
      tiers: [
        { size: 17, lineHeight: 21, maxLines: 2 },
        { size: 14, lineHeight: 17, maxLines: 3 },
      ],
    });
    if (r.lines.length === 1) {
      detailEl.textContent = r.lines[0];
      detailEl.setAttribute("font-size", String(r.size));
    } else {
      setLines(detailEl, r.lines, r.size, r.lineHeight, y0);
      shifts.push({ y: y0, d: (r.lines.length - 1) * r.lineHeight });
    }
  }

  // Shift everything below each grown block.
  let total = 0;
  for (const child of flow.children) {
    const y = parseFloat(child.getAttribute("y") ?? child.getAttribute("y1"));
    if (Number.isNaN(y)) continue;
    const d = shifts.reduce((sum, s) => (s.y < y ? sum + s.d : sum), 0);
    if (d) child.setAttribute("transform", `translate(0,${d.toFixed(1)})`);
    total = Math.max(total, d);
  }

  // Original body spans y140..440; the footer (QR, signature) starts at 447.
  // Grow upward into the gap under the header rule first, then scale to fit.
  const FLOW_TOP = 140, FLOW_HEIGHT = 300, FOOTER_Y = 441, MAX_RISE = 22;
  const rise = Math.min(total, MAX_RISE);
  const top = FLOW_TOP - rise;
  const scale = Math.min(1, (FOOTER_Y - top) / (FLOW_HEIGHT + total));
  if (total) {
    flow.setAttribute(
      "transform",
      `translate(421,${top}) scale(${scale.toFixed(4)}) translate(-421,-${FLOW_TOP})`
    );
  }
}

function fitAllText(svgEl) {
  // querySelector, not getElementById: getElementById is a Document-only
  // method and this SVG root is a detached/off-screen Element.
  const nameEl = svgEl.querySelector("#field-name");
  const roleEl = svgEl.querySelector("#field-role");
  const journalEl = svgEl.querySelector("#field-journal");
  const detailEl = svgEl.querySelector("#field-detail");
  const signatoryEl = svgEl.querySelector("#field-signatory-name");
  const affiliationEl = svgEl.querySelector("#field-affiliation");

  const flow = svgEl.querySelector("#body-flow");
  if (flow) {
    // Sponsorship certificates: name/affiliation/title can span many lines.
    fitBodyFlow(svgEl, flow);
    if (roleEl) shrinkToFit(roleEl, FRAME_INNER_MAX_WIDTH, 14);
    if (signatoryEl && signatoryEl.textContent) shrinkToFit(signatoryEl, 150, 16);
    return;
  }

  if (nameEl) shrinkToFit(nameEl, FRAME_INNER_MAX_WIDTH, 22);
  if (roleEl) shrinkToFit(roleEl, FRAME_INNER_MAX_WIDTH, 14);
  if (affiliationEl && affiliationEl.textContent) shrinkToFit(affiliationEl, FRAME_INNER_MAX_WIDTH, 8);
  // Signature line runs x=70..230 (160pt); leave a small margin either side.
  if (signatoryEl && signatoryEl.textContent) shrinkToFit(signatoryEl, 150, 16);

  fitWithWrapFallback(journalEl);
  fitWithWrapFallback(detailEl);
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

function toggleInstituteLogo(svgEl, journal) {
  const show = journal === "Panorama Research Institute";
  const logo = svgEl.querySelector("#logo-institute");
  if (logo) logo.setAttribute("display", show ? "inline" : "none");
  const watermark = svgEl.querySelector("#watermark-institute");
  if (watermark) watermark.setAttribute("display", show ? "inline" : "none");
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

const TEMPLATE_PATHS = {
  appointment: "/templates/certificate.svg",
  paper_award: "/templates/certificate-award.svg",
  conference_invitation: "/templates/certificate-invitation.svg",
  publication_sponsorship: "/templates/certificate-sponsorship.svg",
};

export async function loadCertificateTemplate(certType = "appointment") {
  const path = TEMPLATE_PATHS[certType] || TEMPLATE_PATHS.appointment;
  // Revalidate every time: the host caches static files for hours, and a stale
  // template paired with newer code mis-lays-out the certificate.
  const res = await fetch(path, { cache: "no-cache" });
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
    removeIfEmpty(svgEl, "field-affiliation", record.affiliation);
    selectSeal(svgEl, record.seal, record.secretariat_signed);
    toggleInstituteLogo(svgEl, record.journal);
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
