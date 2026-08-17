import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import InstitutePage from "./pages/InstitutePage.jsx";
import AwardsPage from "./pages/AwardsPage.jsx";
import EventsPage from "./pages/EventsPage.jsx";
import JournalsPage from "./pages/JournalsPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import VerifyPage from "./pages/VerifyPage.jsx";
import CertificatePage from "./pages/CertificatePage.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/institute" element={<InstitutePage />} />
        <Route path="/awards" element={<AwardsPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/journals" element={<JournalsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/certificate/:id" element={<CertificatePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
