import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import QRCode from "qrcode";
import { findById, certificateStatus } from "../lib/data.js";
import { loadCertificateTemplate, buildCertificateSvg } from "../lib/renderCertificate.js";
import { downloadCertificatePng, downloadCertificatePdf } from "../lib/exportCertificate.js";
import StatusBadge from "../components/StatusBadge.jsx";

export default function CertificatePage() {
  const { id } = useParams();
  const [phase, setPhase] = useState("loading"); // loading | ready | not_found | error
  const [record, setRecord] = useState(null);
  const [svgString, setSvgString] = useState("");
  const [exporting, setExporting] = useState(null); // 'png' | 'pdf' | null

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setPhase("loading");
      const found = await findById(id);
      if (cancelled) return;
      if (!found) {
        setPhase("not_found");
        return;
      }
      setRecord(found);

      try {
        const verifyUrl = `${window.location.origin}/verify?id=${encodeURIComponent(
          found.certificate_id
        )}&token=${encodeURIComponent(found.token)}`;
        const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
          margin: 0,
          width: 264,
          color: { dark: "#000000ff", light: "#ffffff00" },
        });
        const template = await loadCertificateTemplate(found.cert_type);
        const svg = buildCertificateSvg(template, found, qrDataUrl);
        if (cancelled) return;
        setSvgString(svg);
        setPhase("ready");
      } catch (err) {
        console.error(err);
        if (!cancelled) setPhase("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleExport(kind) {
    if (!svgString || !record) return;
    setExporting(kind);
    try {
      if (kind === "png") await downloadCertificatePng(svgString, record);
      else await downloadCertificatePdf(svgString, record);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(null);
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex-grow flex flex-col items-center gap-8 px-4 md:px-16 py-16">
        <div className="max-w-4xl w-full aspect-[842/595] skeleton border border-surface-line" />
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-steel">
          Loading certificate&hellip;
        </p>
      </div>
    );
  }

  if (phase === "not_found") {
    return (
      <div className="flex-grow flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full flex flex-col items-center gap-6 text-center">
          <StatusBadge variant="not_found" />
          <p className="text-sm text-steel">
            No certificate matches &ldquo;{id}&rdquo;.
          </p>
          <Link
            to="/"
            className="font-mono text-xs tracking-[0.15em] uppercase text-ink hover:text-red underline underline-offset-4 decoration-1"
          >
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex-grow flex items-center justify-center py-20 px-4">
        <p className="text-sm text-steel">
          Something went wrong rendering this certificate. Try reloading the page.
        </p>
      </div>
    );
  }

  const status = certificateStatus(record);

  return (
    <div className="flex-grow flex flex-col items-center gap-6 px-4 md:px-16 py-16">
      <div className="max-w-4xl w-full flex items-center justify-between gap-4 font-mono text-xs">
        <span className="tracking-[0.1em] uppercase text-steel">
          {record.certificate_id}
        </span>
        {status !== "active" && (
          <div className="flex items-center gap-2">
            <StatusBadge variant={status} size="sm" />
          </div>
        )}
      </div>

      {/* On a narrow phone, shrinking an A4-landscape document to fit the
          screen width makes its fine print unreadably small. Below the
          min-width, this scrolls horizontally in its own box instead of
          shrinking further -- the page itself never scrolls sideways. */}
      <div className="max-w-4xl w-full overflow-x-auto">
        <div className="cert-shell min-w-[600px] border border-surface-line shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.10)]">
          <div dangerouslySetInnerHTML={{ __html: svgString }} />
        </div>
      </div>

      {/* Status stays visible when printed on purpose -- a printed revoked
          or expired certificate should still show that it isn't valid.
          Only the interactive-only controls below are print:hidden. */}
      <div className="print:hidden flex items-center gap-3 flex-wrap justify-center">
        <button
          onClick={() => handleExport("png")}
          disabled={exporting !== null}
          className="py-3 px-6 border-2 border-ink bg-ink text-paper-pure font-mono text-xs font-semibold tracking-[0.15em] uppercase hover:bg-paper-pure hover:text-ink active:scale-[0.98] transition-all duration-150 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-2"
        >
          {exporting === "png" ? "Preparing…" : "Download PNG"}
        </button>
        <button
          onClick={() => handleExport("pdf")}
          disabled={exporting !== null}
          className="py-3 px-6 border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper-pure active:scale-[0.98] transition-all duration-150 font-mono text-xs font-semibold tracking-[0.15em] uppercase disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-2"
        >
          {exporting === "pdf" ? "Preparing…" : "Download PDF"}
        </button>
      </div>

      <Link
        to="/"
        className="print:hidden font-mono text-xs tracking-[0.1em] uppercase text-steel hover:text-ink transition-colors underline underline-offset-4 decoration-1"
      >
        Back to search
      </Link>
    </div>
  );
}
