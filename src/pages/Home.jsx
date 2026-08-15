import CertificateSearch from "../components/CertificateSearch.jsx";

export default function Home() {
  return (
    <CertificateSearch
      heading="Find Your Certificate"
      description="Enter your full name exactly as it appears on your appointment record to find your certificate, its number, and the QR code that verifies it."
      placeholder="e.g. Yulei Tao"
      emptyHint="Make sure it matches your full name exactly (no titles, no partial names), or contact the editorial office if you believe this is an error."
    />
  );
}
