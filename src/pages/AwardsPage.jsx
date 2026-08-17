import CertificateSearch from "../components/CertificateSearch.jsx";

export default function AwardsPage() {
  return (
    <CertificateSearch
      heading="Find Your Paper Award"
      description="Enter your full name exactly as it appears on your award record to find your Outstanding Paper certificate, its number, and the QR code that verifies it."
      placeholder="e.g. Feifei Chen"
      emptyHint="Make sure it matches your full name exactly (no titles, no partial names), or contact the journal's editorial office if you believe this is an error."
      scope={(r) => r.cert_type === "paper_award"}
    />
  );
}
