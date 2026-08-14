import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import VerifyPage from "./pages/VerifyPage.jsx";
import CertificatePage from "./pages/CertificatePage.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/certificate/:id" element={<CertificatePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
