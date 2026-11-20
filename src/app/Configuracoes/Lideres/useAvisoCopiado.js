// "Copiado" rápido no rodapé da tela (aba Líderes: lista e ficha). O aviso em si está em avisoCopiado.jsx.
import { useState } from "react";

export function useAvisoCopiado() {
  const [visivel, setVisivel] = useState(false);
  const copiar = async (texto) => {
    try { await navigator.clipboard.writeText(String(texto)); setVisivel(true); setTimeout(() => setVisivel(false), 1500); }
    catch (e) { console.error("Não foi possível copiar:", e); }
  };
  return { visivel, copiar };
}
