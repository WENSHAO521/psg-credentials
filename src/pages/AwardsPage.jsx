import CertificateSearch from "../components/CertificateSearch.jsx";

export default function AwardsPage() {
  return (
    <CertificateSearch
      heading="Find Your Paper Award"
      description="Enter your full name, or the paper's exact title, to find your Outstanding Paper certificate, its number, and the QR code that verifies it."
      placeholder="e.g. Feifei Chen, or the paper title"
      fieldLabel="Full Name or Paper Title"
      emptyHint="Make sure it matches exactly (no titles, no partial names or titles), or contact the journal's editorial office if you believe this is an error."
      scope={(r) => r.cert_type === "paper_award"}
    />
  );
}
