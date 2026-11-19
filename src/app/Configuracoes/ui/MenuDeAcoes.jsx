// Menu "⋯" das ações de cada linha das tabelas: as ações menos usadas ficam aqui, com o nome escrito.
// "Excluir/Remover" (tipo "perigo") vai sempre por último, em vermelho, separado por uma linha.
// O menu abre "por cima" da tela (portal), para não ser cortado pela rolagem lateral da tabela.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

const LARGURA = 248;

/**
 * @param {{itens:{id:string, rotulo:string, icone?:React.ElementType, onClick:()=>void, tipo?:"perigo"|"normal", oculto?:boolean, desabilitado?:boolean}[], desabilitado?:boolean}} props
 */
export function MenuDeAcoes({ itens, desabilitado }) {
  const { t } = useTranslation();
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState(null);
  const botaoRef = useRef(null);
  const menuRef = useRef(null);

  const visiveis = itens.filter((i) => !i.oculto);
  const normais = visiveis.filter((i) => i.tipo !== "perigo");
  const perigosos = visiveis.filter((i) => i.tipo === "perigo");

  // Posição: alinhado à direita do botão; se não couber embaixo, abre para cima.
  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return;
    const r = botaoRef.current.getBoundingClientRect();
    const altura = menuRef.current?.offsetHeight || 0;
    const cabeEmbaixo = r.bottom + 6 + altura <= window.innerHeight;
    setPosicao({
      top: cabeEmbaixo ? r.bottom + 6 : Math.max(8, r.top - 6 - altura),
      left: Math.min(Math.max(8, r.right - LARGURA), window.innerWidth - LARGURA - 8),
    });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = () => setAberto(false);
    const fora = (e) => {
      if (!menuRef.current?.contains(e.target) && !botaoRef.current?.contains(e.target)) fechar();
    };
    const tecla = (e) => { if (e.key === "Escape") { fechar(); botaoRef.current?.focus(); } };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  if (visiveis.length === 0) return null;

  const item = (i) => {
    const Icone = i.icone;
    return (
      <button key={i.id} type="button" role="menuitem" disabled={i.desabilitado}
        onClick={() => { setAberto(false); i.onClick(); }}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-bold transition-colors disabled:opacity-40 ${i.tipo === "perigo"
          ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
        {Icone && <Icone className="w-4 h-4 shrink-0" />} {i.rotulo}
      </button>
    );
  };

  return (
    <>
      <button ref={botaoRef} type="button" onClick={() => setAberto((v) => !v)} disabled={desabilitado}
        aria-haspopup="menu" aria-expanded={aberto} title={t("tabela.more")} aria-label={t("tabela.more")}
        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${aberto
          ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-white"}`}>
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {aberto && createPortal(
        <div ref={menuRef} role="menu" style={{ top: posicao?.top ?? -9999, left: posicao?.left ?? -9999, width: LARGURA }}
          className="fixed z-[60] p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl">
          {normais.map(item)}
          {perigosos.length > 0 && normais.length > 0 && <div className="my-1 border-t border-slate-100 dark:border-slate-700" />}
          {perigosos.map(item)}
        </div>,
        document.body,
      )}
    </>
  );
}
