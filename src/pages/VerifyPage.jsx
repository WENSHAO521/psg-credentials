import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { IconArrowRight } from "@tabler/icons-react";
import { findById, certificateStatus } from "../lib/data.js";
import { extractWatermarkFromImageFile, extractWatermarkFromPdfFile } from "../lib/watermark.js";
import StatusBadge from "../components/StatusBadge.jsx";
import DocumentCard from "../components/DocumentCard.jsx";

export default function VerifyPage() {
  const [params, setParams] = useSearchParams();
  const urlId = params.get("id");
  const urlToken = params.get("token");

  const [inputId, setInputId] = useState(urlId || "");
  const [phase, setPhase] = useState("idle"); // idle | loading | done
  const [outcome, setOutcome] = useState(null); // { variant, record }
  const [uploadStatus, setUploadStatus] = useState(null); // null | 'reading' | 'error'

  async function runVerification(id, token) {
    setPhase("loading");
    const record = await findById(id.trim());

    if (!record) {
      setOutcome({ variant: "not_found", record: null });
      setPhase("done");
      return;
    }
    if (token && record.token !== token) {
      setOutcome({ variant: "invalid", record: null });
      setPhase("done");
      return;
    }

    const status = certificateStatus(record);
    const variant = status === "active" ? "verified" : status;
    setOutcome({ variant, record });
    setPhase("done");
  }

  useEffect(() => {
    if (urlId) runVerification(urlId, urlToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlId, urlToken]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!inputId.trim()) return;
    setParams({ id: inputId.trim() });
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same file afterwards
    if (!file) return;

    setUploadStatus("reading");
    const found =
      file.type === "application/pdf"
        ? await extractWatermarkFromPdfFile(file)
        : await extractWatermarkFromImageFile(file);
    if (!found) {
      setUploadStatus("error");
      return;
    }
    setUploadStatus(null);
    setParams({ id: found.certificateId, token: found.token });
  }

  function reset() {
    setInputId("");
    setOutcome(null);
    setPhase("idle");
    setUploadStatus(null);
    setParams({});
  }

  return (
    <div className="flex-grow flex items-center justify-center px-4 md:px-16 py-20">
      <DocumentCard>
        {phase !== "done" && (
          <>
            <div className="text-center mb-10 relative z-10">
              <h1 className="font-sans font-extrabold text-3xl md:text-5xl leading-tight tracking-tight uppercase mb-4 text-balance">
                Verify Certificate
              </h1>
              <p className="font-sans text-base text-steel max-w-lg mx-auto">
                Enter a certificate number, or scan the QR code printed on the
                certificate, to confirm it is authentic and check its current
                status.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
              <div className="flex flex-col">
                <label
                  htmlFor="cert-id"
                  className="font-mono text-xs font-semibold tracking-[0.15em] uppercase text-steel mb-2"
                >
                  Certificate Number
                </label>
                <input
                  id="cert-id"
                  type="text"
                  autoComplete="off"
                  required
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value)}
                  placeholder="e.g. PSG-AE-2026-000001"
                  className="w-full bg-surface border-0 border-b border-ink focus:ring-0 focus:border-red focus:border-b-2 py-3 px-4 font-mono text-sm text-ink placeholder-steel-dim outline-none transition-colors focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-2"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 border-2 border-ink bg-ink text-paper-pure font-mono text-xs font-semibold tracking-[0.2em] uppercase hover:bg-paper-pure hover:text-ink active:scale-[0.98] active:translate-y-px transition-all duration-150 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-2"
              >
                Verify
                <IconArrowRight size={18} stroke={1.75} />
              </button>
            </form>

            <div className="flex items-center gap-3 my-6 relative z-10">
              <div className="flex-1 h-px bg-surface-line" />
              <span className="font-mono text-xs tracking-[0.15em] uppercase text-steel-dim">
                Or
              </span>
              <div className="flex-1 h-px bg-surface-line" />
            </div>

            <div className="relative z-10 text-center">
              <label
                htmlFor="cert-image-upload"
                className="inline-block cursor-pointer py-3 px-6 border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper-pure active:scale-[0.98] transition-all duration-150 font-mono text-xs font-semibold tracking-[0.15em] uppercase focus-within:outline-2 focus-within:outline-red focus-within:outline-offset-2"
              >
                {uploadStatus === "reading" ? "Verifying file…" : "Verify by File Upload"}
                <input
                  id="cert-image-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploadStatus === "reading"}
                  className="sr-only"
                />
              </label>
              <p className="mt-3 text-xs text-steel max-w-sm mx-auto">
                For a direct document check, upload the certificate file as
                downloaded from this registry. This authenticates the file
                itself against our records, independent of the QR code.
              </p>
              {uploadStatus === "error" && (
                <p className="mt-2 text-xs text-red">
                  This file could not be authenticated against our records.
                  Confirm it is an unmodified download from this registry, or
                  verify using the certificate number instead.
                </p>
              )}
            </div>
          </>
        )}

        {phase === "loading" && (
          <div className="absolute inset-0 bg-paper-pure/95 flex flex-col items-center justify-center gap-4 z-20">
            <div className="w-10 h-10 border-2 border-surface-line border-t-red rounded-full animate-spin" />
            <p className="font-mono text-xs tracking-[0.2em] uppercase text-steel">
              Checking registry&hellip;
            </p>
          </div>
        )}

        {phase === "done" && outcome && (
          <div className="flex flex-col items-center text-center gap-6 py-4 relative z-10">
            <StatusBadge variant={outcome.variant} />

            {outcome.variant === "verified" && outcome.record && (
              <div className="w-full">
                <h2 className="font-sans font-bold text-2xl mb-1">
                  {outcome.record.display_name}
                </h2>
                <p className="text-steel text-sm mb-6">
                  {outcome.record.role} &middot; {outcome.record.journal}
                </p>
                <dl className="grid grid-cols-2 gap-4 text-left border-t border-surface-line pt-6 font-mono text-xs">
                  <div>
                    <dt className="text-steel uppercase tracking-[0.1em] mb-1">
                      Certificate No.
                    </dt>
                    <dd className="text-ink">{outcome.record.certificate_id}</dd>
                  </div>
                  <div>
                    <dt className="text-steel uppercase tracking-[0.1em] mb-1">
                      Term
                    </dt>
                    <dd className="text-ink">
                      {outcome.record.valid_from} - {outcome.record.valid_until}
                    </dd>
                  </div>
                </dl>
                <Link
                  to={`/certificate/${outcome.record.certificate_id}`}
                  className="inline-flex items-center gap-2 mt-6 font-mono text-xs tracking-[0.1em] uppercase text-ink hover:text-red transition-colors underline underline-offset-4 decoration-1"
                >
                  View certificate
                  <IconArrowRight size={16} stroke={1.75} />
                </Link>
              </div>
            )}

            {(outcome.variant === "revoked" || outcome.variant === "expired") &&
              outcome.record && (
                <div className="w-full">
                  <h2 className="font-sans font-bold text-2xl mb-1">
                    {outcome.record.display_name}
                  </h2>
                  <p className="text-steel text-sm mb-2">
                    {outcome.record.role} &middot; {outcome.record.journal}
                  </p>
                  <p className="text-sm text-ink">
                    {outcome.variant === "revoked"
                      ? "This credential has been revoked and is no longer valid."
                      : `This credential's term ended on ${outcome.record.valid_until}.`}
                  </p>
                </div>
              )}

            {outcome.variant === "not_found" && (
              <p className="text-sm text-steel max-w-sm">
                No certificate matches this number. Double-check the number
                printed on the document, or scan its QR code directly.
              </p>
            )}

            {outcome.variant === "invalid" && (
              <p className="text-sm text-steel max-w-sm">
                This verification link does not match our records. Try
                scanning the QR code again.
              </p>
            )}

            <button
              onClick={reset}
              className="mt-2 py-2 px-6 border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper-pure active:scale-[0.98] transition-all duration-150 font-mono text-xs tracking-[0.15em] uppercase focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-2"
            >
              New search
            </button>
          </div>
        )}
      </DocumentCard>
    </div>
  );
}
