import CertificateSearch from "../components/CertificateSearch.jsx";

export default function InstitutePage() {
  return (
    <CertificateSearch
      heading="Find Your Institute Certificate"
      description="Enter your full name exactly as it appears on your appointment record to find your Panorama Research Institute credential, its number, and the QR code that verifies it."
      placeholder="e.g. Hengjie Wang"
      emptyHint="Make sure it matches your full name exactly (no titles, no partial names), or contact the Institute if you believe this is an error."
      scope={(r) => r.journal === "Panorama Research Institute"}
    />
  );
}
