import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";

console.log("[Radar] Etapa 1 — main.tsx carregado");

const rootEl = document.getElementById("root");
console.log("[Radar] Etapa 2 — root element:", rootEl ? "encontrado" : "AUSENTE");

if (!rootEl) {
  document.body.innerHTML =
    '<div style="padding:2rem;color:red;font-family:sans-serif">Elemento #root não encontrado no DOM.</div>';
} else {
  try {
    console.log("[Radar] Etapa 3 — criando React root");
    const root = createRoot(rootEl);
    console.log("[Radar] Etapa 4 — chamando root.render()");
    root.render(
      <React.StrictMode>
        <ErrorBoundary fallbackTitle="Erro fatal na aplicação">
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log("[Radar] Etapa 5 — render() agendado com sucesso");
  } catch (err) {
    console.error("[Radar] FALHA CRÍTICA no render:", err);
    rootEl.innerHTML =
      '<div style="padding:2rem;color:red;font-family:sans-serif">Falha crítica ao montar a aplicação. Veja o console.</div>';
  }
}
