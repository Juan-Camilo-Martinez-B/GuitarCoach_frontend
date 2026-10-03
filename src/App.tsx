import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./layout/Shell";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { LoginPage } from "./pages/LoginPage";
import { PracticePage } from "./pages/PracticePage";
import { ReportPage } from "./pages/ReportPage";
import { TunerPage } from "./pages/TunerPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/afinador" element={<TunerPage />} />
        <Route path="/practica" element={<PracticePage />} />
        <Route path="/biblioteca" element={<LibraryPage />} />
        <Route path="/informe" element={<ReportPage />} />
        <Route path="/entrar" element={<LoginPage />} />
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
