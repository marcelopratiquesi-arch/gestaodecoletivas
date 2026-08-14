import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx"; // <--- Importe aqui
import './i18n'; // 🟢 LIGA O MOTOR DE TRADUÇÃO AQUI!

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider> {/* <--- Envolva o App aqui */}
        <App />
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
);