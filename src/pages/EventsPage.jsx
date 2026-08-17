import CertificateSearch from "../components/CertificateSearch.jsx";

export default function EventsPage() {
  return (
    <CertificateSearch
      heading="Find Your Conference Invitation"
      description="Enter your full name exactly as it appears on your invitation record to find your conference certificate, its number, and the QR code that verifies it."
      placeholder="e.g. Zekai Yu"
      emptyHint="Make sure it matches your full name exactly (no titles, no partial names), or contact the conference organizers if you believe this is an error."
      scope={(r) => r.cert_type === "conference_invitation"}
    />
  );
}
