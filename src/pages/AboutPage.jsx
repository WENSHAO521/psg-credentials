export default function AboutPage() {
  return (
    <div className="flex-grow flex flex-col items-center px-4 md:px-16 py-20">
      <div className="max-w-2xl w-full flex flex-col gap-10">
        <div className="text-center">
          <h1 className="font-sans font-extrabold text-3xl md:text-5xl leading-tight tracking-tight uppercase mb-4 text-balance">
            About This Registry
          </h1>
          <p className="font-sans text-base text-steel max-w-lg mx-auto">
            What a PSG credential is, and how to check one.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs font-semibold tracking-[0.15em] uppercase text-ink">
            What is a PSG credential?
          </h2>
          <p className="text-sm text-steel leading-relaxed">
            Panorama Scholarly Group ("PSG") is an international academic
            publisher operating a portfolio of peer-reviewed journals. This
            registry is the official system of record for credentials it
            issues -- editorial board appointments, Institute appointments,
            paper awards, and conference invitations -- across those
            journals. Every certificate carries a unique number, a QR code,
            and an invisible watermark embedded in the exported file itself,
            so its authenticity can be verified independently of who is
            presenting it.
          </p>
          <p className="text-sm text-steel leading-relaxed">
            To learn more about Panorama Scholarly Group, our journals, and
            our editorial standards, visit our official website at{" "}
            <a
              href="https://panorama-sg.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink hover:text-red underline underline-offset-4 decoration-1"
            >
              panorama-sg.com
            </a>
            .
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs font-semibold tracking-[0.15em] uppercase text-ink">
            How to check a certificate
          </h2>
          <p className="text-sm text-steel leading-relaxed">
            Use{" "}
            <a
              href="/verify"
              className="text-ink hover:text-red underline underline-offset-4 decoration-1"
            >
              Verify
            </a>{" "}
            with the certificate number or by scanning its QR code, or upload
            the certificate file (PNG/PDF) directly to authenticate it against
            our records. A genuine certificate will show as active, revoked,
            or expired -- never simply "not found" for a real record.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs font-semibold tracking-[0.15em] uppercase text-ink">
            Reporting a concern
          </h2>
          <p className="text-sm text-steel leading-relaxed">
            If a certificate does not verify, looks altered, or you suspect
            someone is misrepresenting a role they don't hold, contact the
            editorial office of the journal named on the certificate, or
            reach Panorama Scholarly Group directly through{" "}
            <a
              href="https://journals.panorama-sg.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink hover:text-red underline underline-offset-4 decoration-1"
            >
              journals.panorama-sg.com
            </a>
            . This registry does not store contact details for certificate
            holders, so we cannot look up or share personal information
            beyond what a search already returns.
          </p>
        </section>
      </div>
    </div>
  );
}
