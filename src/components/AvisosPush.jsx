import React, { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Loader2, Share, SquarePlus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ativarAvisos, estadoDosAvisos, renovarAparelho } from "../services/avisosPushService";

// Avisos do administrador no celular/computador. Não existe botão de DESLIGAR de propósito (decisão do Marcelo):
// aviso do administrador tem que chegar. Quem quiser parar bloqueia nas configurações do próprio aparelho.
// Estados: preparando | sem-suporte | instalar-iphone | bloqueado | desligado | ligado

function useEstadoAvisos(uid) {
  const [estado, setEstado] = useState(null);
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!uid) return undefined;
    let vivo = true;
    estadoDosAvisos().then((e) => { if (vivo) setEstado(e); }).catch(() => { if (vivo) setEstado("sem-suporte"); });
    renovarAparelho(uid).catch(() => {}); // já tinha ligado: renova o endereço do aparelho em silêncio
    return () => { vivo = false; };
  }, [uid]);

  const ativar = useCallback(async () => {
    setAtivando(true);
    setErro("");
    try { setEstado(await ativarAvisos(uid)); } catch (e) { setErro(e.message || "Não deu certo. Tente de novo."); } finally { setAtivando(false); }
  }, [uid]);

  return { estado, ativando, erro, ativar };
}

function PassosIphone() {
  return (
    <ol className="mt-2 space-y-1.5 text-xs font-bold normal-case text-slate-600 dark:text-slate-300 list-decimal pl-5">
      <li>Abra o sistema no <b>Safari</b> (não funciona em outro navegador).</li>
      <li>Toque em <Share size={14} className="inline -mt-0.5" /> <b>Compartilhar</b> (o quadradinho com a seta, embaixo da tela).</li>
      <li>Escolha <SquarePlus size={14} className="inline -mt-0.5" /> <b>Adicionar à Tela de Início</b> e toque em Adicionar.</li>
      <li>Abra o <b>Coletivas</b> pelo ícone novo na tela do iPhone e toque em "Ativar avisos".</li>
      <li className="list-none -ml-5 pt-1 text-[11px] font-medium text-slate-500">Precisa de iPhone com iOS 16.4 ou mais novo.</li>
    </ol>
  );
}

// Faixa discreta no alto do sistema, até a pessoa ligar os avisos (sem X: o aviso do administrador tem que chegar).
export default function FaixaAvisos() {
  const { crachaReal } = useAuth();
  const uid = crachaReal?.id || null;
  const { estado, ativando, erro, ativar } = useEstadoAvisos(uid);
  const [ajuda, setAjuda] = useState(false);

  if (!uid || !["desligado", "instalar-iphone", "bloqueado"].includes(estado)) return null;

  return (
    <div role="status" className="bg-red-600 text-white px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Bell size={18} className="shrink-0" />
        <span className="flex-1 text-xs font-bold uppercase">
          {estado === "bloqueado" ? "Os avisos estão bloqueados neste aparelho" : "Ative os avisos para receber os recados da gestão"}
        </span>
        {estado === "desligado" && (
          <button type="button" onClick={ativar} disabled={ativando} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-black uppercase text-red-600 disabled:opacity-60">
            {ativando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ativar"}
          </button>
        )}
        {estado !== "desligado" && (
          <button type="button" onClick={() => setAjuda((v) => !v)} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-black uppercase text-red-600">
            {ajuda ? "Fechar" : "Como fazer"}
          </button>
        )}
      </div>
      {erro && <p className="mt-1 text-[11px] font-bold normal-case">{erro}</p>}
      {ajuda && estado === "instalar-iphone" && <div className="rounded-lg bg-white p-3 mt-2"><PassosIphone /></div>}
      {ajuda && estado === "bloqueado" && (
        <p className="mt-2 rounded-lg bg-white p-3 text-xs font-bold normal-case text-slate-600">
          Toque no cadeado (ou nos 3 pontinhos) ao lado do endereço do site, abra "Configurações do site" e mude "Notificações" para "Permitir". Depois atualize a página.
        </p>
      )}
    </div>
  );
}

// Cartão em "Meu cadastro": mostra se está ligado e, se não, o botão (e o passo a passo do iPhone).
export function CartaoAvisos({ classeCartao, classeSecao }) {
  const { crachaReal } = useAuth();
  const uid = crachaReal?.id || null;
  const { estado, ativando, erro, ativar } = useEstadoAvisos(uid);

  if (!uid || !estado || estado === "preparando") return null;

  return (
    <section className={classeCartao}>
      <h2 className={classeSecao}>Avisos da gestão</h2>
      {estado === "ligado" && (
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase">
          <CheckCircle2 size={18} /> Avisos ligados neste aparelho
        </p>
      )}
      {estado === "desligado" && (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400 normal-case">Receba no celular ou no computador os recados da gestão, mesmo com o sistema fechado.</p>
          <button type="button" onClick={ativar} disabled={ativando} className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2.5 text-sm font-black uppercase text-white disabled:opacity-60">
            {ativando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell size={16} />} Ativar avisos
          </button>
        </>
      )}
      {estado === "instalar-iphone" && (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400 normal-case">No iPhone, os avisos só funcionam com o sistema instalado na tela inicial. Faça assim:</p>
          <PassosIphone />
        </>
      )}
      {estado === "bloqueado" && (
        <p className="flex items-start gap-2 text-sm font-bold text-amber-700 dark:text-amber-400 normal-case">
          <BellOff size={18} className="shrink-0" /> Os avisos estão bloqueados neste aparelho. Libere "Notificações" nas configurações do site (cadeado ao lado do endereço) e atualize a página.
        </p>
      )}
      {estado === "sem-suporte" && (
        <p className="text-sm text-slate-500 dark:text-slate-400 normal-case">Este navegador não recebe avisos. Use o Chrome (Android ou computador) ou o Safari com o sistema instalado (iPhone).</p>
      )}
      {erro && <p className="text-xs font-bold text-red-600 normal-case">{erro}</p>}
    </section>
  );
}
