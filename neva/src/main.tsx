import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { LessonPage } from "./pages/LessonPage";
import { OfficeHours } from "./pages/OfficeHours";
import { PathPage } from "./pages/PathPage";
import { registerLicensedFonts } from "./lib/fonts";
import "./styles.css";

registerLicensedFonts();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="paths/:id" element={<PathPage />} />
          <Route path="lesson/:id" element={<LessonPage />} />
          <Route path="office-hours" element={<OfficeHours />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
