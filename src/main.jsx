import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx"; // <--- Importe aqui
import './i18n'; // 🟢 LIGA O MOTOR DE TRADUÇÃO AQUI!

// Depois de uma publicação, quem estava com o site aberto ainda tem a versão antiga, que pede pedaços do site
// que não existem mais (tela branca). Nesse caso recarrega UMA vez sozinho para pegar a versão nova.
// A trava de 1 minuto evita ficar recarregando sem parar se o problema for outro (ex.: sem internet).
const CHAVE_RECARGA = "recarregouVersaoNova";
function recarregarParaVersaoNova() {
  let ultima = 0;
  try { ultima = Number(sessionStorage.getItem(CHAVE_RECARGA)) || 0; } catch { /* sem armazenamento */ }
  if (Date.now() - ultima < 60000) return false;
  try { sessionStorage.setItem(CHAVE_RECARGA, String(Date.now())); } catch { /* sem armazenamento */ }
  window.location.reload();
  return true;
}
window.addEventListener("vite:preloadError", (e) => { if (recarregarParaVersaoNova()) e.preventDefault(); });
window.addEventListener("unhandledrejection", (e) => {
  const msg = String(e?.reason?.message || e?.reason || "");
  if (/dynamically imported module|Importing a module script failed|error loading dynamically imported/i.test(msg)) recarregarParaVersaoNova();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider> {/* <--- Envolva o App aqui */}
        <App />
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
);