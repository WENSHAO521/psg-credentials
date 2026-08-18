import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { loadCertificateTemplate, buildCertificateSvg } from "../lib/renderCertificate.js";

// Fabricated end-to-end -- no real certificate_id, name, or token. Exists
// purely so the homepage can show what a genuine credential looks like
// (seal, ID, QR) without ever rendering an actual person's record. The QR
// still points at /verify so scanning it lands somewhere real rather than
// erroring, it just doesn't carry an id/token that resolves to anything.
const SAMPLE_RECORD = {
  certificate_id: "PSG-SAMPLE-00000",
  cert_type: "appointment",
  display_name: "Jordan A. Whitfield",
  role: "Editorial Board Member",
  journal: "Journal of Applied Materials Science",
  valid_from: "2025-01-01",
  valid_until: "2027-01-01",
  issue_date: "2025-01-01",
  signatory_name: "Dr. Elena Marchetti",
  signatory_title: "Editor-in-Chief",
  seal: "gold",
  secretariat_signed: false,
};

export default function SampleCertificate({ className = "" }) {
  const [svgString, setSvgString] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/verify`, {
          margin: 0,
          width: 264,
          color: { dark: "#000000ff", light: "#ffffff00" },
        });
        const template = await loadCertificateTemplate(SAMPLE_RECORD.cert_type);
        const svg = buildCertificateSvg(template, SAMPLE_RECORD, qrDataUrl);
        if (!cancelled) setSvgString(svg);
      } catch (err) {
        console.error(err);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`relative select-none ${className}`}>
      <div className="cert-shell border border-surface-line shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.10)] overflow-hidden">
        {svgString ? (
          <div dangerouslySetInnerHTML={{ __html: svgString }} />
        ) : (
          <div className="skeleton aspect-[842/595]" />
        )}
      </div>
      {/* Overlaid, not baked into the SVG -- keeps SAMPLE_RECORD's own PNG/PDF
          export path (if it were ever wired up) irrelevant, since this
          watermark only exists in this on-page preview. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        <span className="font-mono font-bold text-red/25 text-3xl md:text-4xl tracking-[0.3em] uppercase -rotate-[18deg] whitespace-nowrap">
          Sample — Not Valid
        </span>
      </div>
    </div>
  );
}
