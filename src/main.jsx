import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx"; // <--- Importe aqui

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider> {/* <--- Envolva o App aqui */}
        <App />
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
);