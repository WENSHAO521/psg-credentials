import CertificateSearch from "../components/CertificateSearch.jsx";

export default function AwardsPage() {
  return (
    <CertificateSearch
      heading="Find Your Paper Award"
      description="Enter the paper's exact title to find its Outstanding Paper certificate, its number, and the QR code that verifies it. Search is by paper title only, since author names aren't unique enough to reliably find the right record."
      placeholder="e.g. A Randomized Trial of Something Important"
      fieldLabel="Paper Title"
      emptyHint="Make sure it matches the paper's exact title (no partial titles), or contact the journal's editorial office if you believe this is an error."
      scope={(r) => r.cert_type === "paper_award"}
    />
  );
}
