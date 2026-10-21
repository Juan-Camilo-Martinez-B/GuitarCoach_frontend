import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./layout/Shell";
import { AuthPage } from "./pages/AuthPage";
import { HomePage } from "./pages/HomePage";
import { LearnPage } from "./pages/LearnPage";
import { LibraryPage } from "./pages/LibraryPage";
import { PracticePage } from "./pages/PracticePage";
import { ReportPage } from "./pages/ReportPage";
import { TunerPage } from "./pages/TunerPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/afinador" element={<TunerPage />} />
        <Route path="/aprendizaje" element={<LearnPage />} />
        <Route path="/practica" element={<PracticePage />} />
        <Route path="/biblioteca" element={<LibraryPage />} />
        <Route path="/informe" element={<ReportPage />} />
        <Route path="/entrar" element={<AuthPage />} />
        <Route path="/registro" element={<Navigate to="/entrar?alta=1" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
