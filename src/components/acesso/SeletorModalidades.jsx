// Escolha das modalidades que o professor dá aula, a partir das modalidades cadastradas em Configurações.
// Lista FECHADA: só aparecem botões das modalidades ativas; não dá para digitar nome novo.
// O valor volta como texto "Zumba, Pilates" (o mesmo campo "modalidades" de sempre).
import { useTranslation } from "react-i18next";
import { Loader2, Check } from "lucide-react";
import { useModalidadesAtivas, modalidadesDaUnidade, modalidadesDoTexto, LIMITE_MODALIDADES } from "./acessoDados";
import { classeRotulo } from "./AcessoUI";

// `unidade` (da vitrine pública): mostra só as modalidades dela. null = ainda sem unidade escolhida (pede para escolher antes);
// sem a propriedade = todas as modalidades ativas (professor antigo sem unidade no crachá).
// `claro`: versão para as telas internas (fundo claro, cinza e vermelho), como o Meu cadastro.
export default function SeletorModalidades({ id, valor, onChange, unidade, desabilitado = false, claro = false }) {
  const { t } = useTranslation();
  const todas = useModalidadesAtivas();
  const lista = todas === null ? null : unidade === undefined ? todas : modalidadesDaUnidade(todas, unidade);
  const escolhidas = new Set(modalidadesDoTexto(valor));
  const rotulo = claro ? "text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase" : classeRotulo;
  const ajuda = claro ? "text-xs text-slate-500 dark:text-slate-400" : "text-xs text-zinc-500";
  const botao = (marcada) => (marcada
    ? "bg-red-600 border-red-600 text-white"
    : claro
      ? "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:border-red-500"
      : "bg-zinc-900/50 border-zinc-700 text-zinc-300 hover:border-red-600");

  function alternar(nome) {
    const proximas = new Set(escolhidas);
    if (proximas.has(nome)) proximas.delete(nome); else proximas.add(nome);
    // mantém a ordem do cadastro de modalidades
    const texto = (lista || []).filter((m) => proximas.has(m.nome)).map((m) => m.nome).join(", ");
    if (texto.length <= LIMITE_MODALIDADES) onChange(texto);
  }

  return (
    <div className="space-y-2">
      <p id={id} className={rotulo}>{t("accessRequest.fields.modalities")}</p>
      {unidade === null ? (
        <p className={ajuda}>{t("accessRequest.hints.modalitiesPickUnit")}</p>
      ) : lista === null ? (
        <p className={`${ajuda} flex items-center gap-2`}><Loader2 className="w-4 h-4 animate-spin" /> {t("accessRequest.hints.modalitiesLoading")}</p>
      ) : lista.length === 0 ? (
        <p className={ajuda}>{t("accessRequest.hints.modalitiesNone")}</p>
      ) : (
        <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
          {lista.map((m) => {
            const marcada = escolhidas.has(m.nome);
            return (
              <button key={m.id} type="button" onClick={() => alternar(m.nome)} disabled={desabilitado} aria-pressed={marcada}
                className={`px-3.5 py-2 rounded-xl border text-xs font-black uppercase flex items-center gap-1.5 transition-colors disabled:opacity-50 ${botao(marcada)}`}>
                {marcada && <Check className="w-3.5 h-3.5" />} {m.nome}
              </button>
            );
          })}
        </div>
      )}
      <p className={`text-[11px] ml-1 ${claro ? "text-slate-500 dark:text-slate-400" : "text-zinc-500"}`}>{t("accessRequest.hints.modalities")}</p>
    </div>
  );
}
