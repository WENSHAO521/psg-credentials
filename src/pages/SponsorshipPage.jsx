import CertificateSearch from "../components/CertificateSearch.jsx";

export default function SponsorshipPage() {
  return (
    <CertificateSearch
      heading="Find a Publication Sponsorship"
      description="Panorama Research Institute sponsors the article processing charge (APC) of selected research articles. Enter the author's full name or the article's exact title to find its sponsorship certificate. The certificate number is the Sponsorship No. authors cite under Funding / Supporting Agencies, and journal editors can confirm it here."
      placeholder="e.g. Leyuan Liu, or the full article title"
      fieldLabel="Author Name or Article Title"
      emptyHint="Make sure it matches the author's full name or the article's exact title (no partial titles), or contact the Institute if you believe this is an error."
      scope={(r) => r.cert_type === "publication_sponsorship"}
    />
  );
}
