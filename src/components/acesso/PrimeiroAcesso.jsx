// Aba "Primeiro acesso" da tela de login: explica como funciona, a pessoa escolhe a função
// (líder, mentor; professor em breve) e entra com o Google. Os dados são preenchidos depois,
// na tela de pedido de acesso (pages/SolicitarAcesso), que já abre com a função escolhida.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle } from "lucide-react";
import { Passos, CartaoEscolha, FuncaoEscolhida, BotaoVermelho, BotaoLink, IconeGoogle, CaixaAjuda } from "./AcessoUI";
import { ICONE_FUNCAO, lerPapelPedido, guardarPapelPedido } from "./acessoDados";

export default function PrimeiroAcesso({ onGoogle, carregando, erro, onVoltar }) {
  const { t } = useTranslation();
  const [passo, setPasso] = useState("intro"); // intro | funcao | google
  const [papel, setPapel] = useState(() => lerPapelPedido() || "lider");
  const etapas = [t("access.steps.role"), t("access.steps.google"), t("access.steps.data"), t("access.steps.approval")];

  if (passo === "intro") {
    return (
      <>
        <h2 className="text-xl font-black text-white text-center text-balance">{t("access.first.title")}</h2>
        <p className="text-sm text-zinc-400 text-center mt-2 mb-5">{t("access.first.desc")}</p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-400 leading-relaxed mb-5">
          <b className="text-white">{t("access.first.howTitle")}</b>
          <ul className="list-disc pl-4 mt-1.5 space-y-0.5">
            <li>{t("access.first.how1")}</li>
            <li>{t("access.first.how2")}</li>
            <li>{t("access.first.how3")}</li>
          </ul>
        </div>
        <BotaoVermelho type="button" onClick={() => setPasso("funcao")}>{t("access.first.start")}</BotaoVermelho>
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{t("access.first.haveAccess")}</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <BotaoLink onClick={onVoltar}>{t("access.first.backToLogin")}</BotaoLink>
        <CaixaAjuda />
      </>
    );
  }

  if (passo === "funcao") {
    return (
      <>
        <Passos etapas={etapas} atual={0} />
        <h2 className="text-xl font-black text-white text-center">{t("access.roles.title")}</h2>
        <p className="text-sm text-zinc-400 text-center mt-1.5 mb-5">{t("access.roles.desc")}</p>
        <div className="space-y-2.5">
          {["lider", "mentor"].map((p) => (
            <CartaoEscolha
              key={p} ativo={papel === p} onClick={() => setPapel(p)} icone={ICONE_FUNCAO[p]}
              titulo={t(`access.roles.${p}.name`)} descricao={t(`access.roles.${p}.desc`)}
            />
          ))}
          <CartaoEscolha
            desabilitado icone={ICONE_FUNCAO.professor} selo={t("access.roles.soon")}
            titulo={t("access.roles.professor.name")} descricao={t("access.roles.professor.soonDesc")}
          />
        </div>
        <div className="mt-5 space-y-2">
          <BotaoVermelho type="button" onClick={() => { guardarPapelPedido(papel); setPasso("google"); }}>{t("access.continue")}</BotaoVermelho>
          <BotaoLink onClick={() => setPasso("intro")}>{t("access.back")}</BotaoLink>
        </div>
        <CaixaAjuda />
      </>
    );
  }

  return (
    <>
      <Passos etapas={etapas} atual={1} />
      <h2 className="text-xl font-black text-white text-center">{t("access.google.title")}</h2>
      <p className="text-sm text-zinc-400 text-center mt-1.5 mb-5">{t("access.google.desc")}</p>
      <FuncaoEscolhida texto={t(`access.roles.${papel}.name`)} onTrocar={() => setPasso("funcao")} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-400 leading-relaxed mb-5">
        {t("access.google.hint")}
        <ul className="list-disc pl-4 mt-1.5 space-y-0.5">
          <li>{t("access.google.noPassword")}</li>
          <li>{t("access.google.keeps")}</li>
        </ul>
      </div>
      {erro && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {erro}
        </div>
      )}
      <div className="space-y-2">
        <button
          type="button" onClick={() => { guardarPapelPedido(papel); onGoogle(); }} disabled={carregando}
          className="w-full bg-white hover:bg-zinc-100 text-zinc-800 font-black text-sm py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-70 flex items-center justify-center gap-3"
        >
          {carregando ? <Loader2 className="w-5 h-5 animate-spin" /> : <IconeGoogle />}
          {t("access.google.button")}
        </button>
        <BotaoLink onClick={() => setPasso("funcao")}>{t("access.back")}</BotaoLink>
      </div>
      <CaixaAjuda />
    </>
  );
}
