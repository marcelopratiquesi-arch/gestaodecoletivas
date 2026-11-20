// Computador (>= 1024 px) ou celular? As telas de Configurações que têm um desenho próprio para o computador
// escolhem aqui qual desenhar, para o celular continuar exatamente como era (nada do computador é montado nele).
import { useEffect, useState } from "react";

const CONSULTA = "(min-width: 1024px)";
const agora = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(CONSULTA).matches;

export function useTelaGrande() {
  const [grande, setGrande] = useState(agora);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(CONSULTA);
    const mudar = () => setGrande(mq.matches);
    mudar();
    mq.addEventListener("change", mudar);
    return () => mq.removeEventListener("change", mudar);
  }, []);
  return grande;
}
