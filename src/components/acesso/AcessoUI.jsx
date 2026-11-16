// Peças em comum das telas de entrada: login, primeiro acesso (pedido de acesso) e atualização de cadastro.
// Mesmo visual da tela de login: fundo escuro com a foto da academia e o cartão preto com a marca.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X, HelpCircle, Loader2 } from "lucide-react";
import { GESTOR_COLETIVAS } from "../../config/contatoGestor";

export const MAX_UNIDADES_PEDIDO = 5;

export function FundoAcesso({ children, topo = null, onClick }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black font-sans" onClick={onClick}>
      {topo}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-40 scale-105 animate-pulse-slow"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop')" }}
      ></div>
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-black/80 via-transparent to-black/80"></div>
      <div className="relative z-10 w-full max-w-md p-4 sm:p-6 animate-fade-in">
        <div className="bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10 relative overflow-hidden group text-zinc-200">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Marca({ compacta = false }) {
  const { t } = useTranslation();
  return (
    <div className={`text-center ${compacta ? "mb-6" : "mb-8"}`}>
      <h1 className={`${compacta ? "text-3xl" : "text-4xl"} font-black text-white italic tracking-tighter`}>
        PRATIQUE <span className="text-red-600">COLETIVAS</span>
      </h1>
      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">{t("login.subtitle")}</p>
    </div>
  );
}

export function IconeGoogle({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

// Barra de passos: ["Função", "Google", ...] e o índice do passo atual.
export function Passos({ etapas, atual }) {
  return (
    <div className="grid gap-1.5 mb-5" style={{ gridTemplateColumns: `repeat(${etapas.length}, minmax(0, 1fr))` }}>
      {etapas.map((nome, i) => (
        <div key={nome} className="flex flex-col gap-1.5">
          <span className={`h-[3px] rounded-full ${i <= atual ? "bg-red-600" : "bg-zinc-800"}`} />
          <span className={`text-[9px] font-black uppercase tracking-wide ${i === atual ? "text-white" : i < atual ? "text-zinc-400" : "text-zinc-600"}`}>{nome}</span>
        </div>
      ))}
    </div>
  );
}

export const classeCampo = "w-full bg-zinc-900/50 border border-zinc-700 text-white font-bold px-4 py-3 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none placeholder:text-zinc-600 placeholder:font-normal";
export const classeRotulo = "text-[10px] font-bold text-zinc-500 uppercase ml-1";

export function BotaoVermelho({ children, ...props }) {
  return (
    <button {...props} className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase text-sm tracking-wide py-4 rounded-xl shadow-lg shadow-red-900/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
      {children}
    </button>
  );
}

export function BotaoLink({ children, ...props }) {
  return (
    <button type="button" {...props} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-zinc-500 hover:text-white uppercase tracking-widest py-1.5 disabled:opacity-50">
      {children}
    </button>
  );
}

// Cartão de escolha (função no primeiro acesso; resposta na atualização de cadastro).
export function CartaoEscolha({ ativo, onClick, icone: Icone, titulo, descricao, desabilitado, selo }) {
  return (
    <button
      type="button" onClick={onClick} disabled={desabilitado} aria-pressed={!!ativo}
      className={`w-full text-left flex items-center gap-3 p-3.5 rounded-2xl border transition-colors ${
        ativo ? "border-red-600 bg-red-600/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
      } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-zinc-800`}
    >
      {Icone ? (
        <span className={`shrink-0 w-11 h-11 rounded-xl grid place-items-center bg-black/40 border ${ativo ? "border-red-600" : "border-zinc-800"}`}>
          <Icone className="w-5 h-5 text-red-500" />
        </span>
      ) : (
        <span className={`shrink-0 w-[18px] h-[18px] rounded-full border-2 ${ativo ? "border-red-600 bg-red-600 shadow-[inset_0_0_0_3px_#18181b]" : "border-zinc-600"}`} />
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <strong className="text-sm font-black text-white">{titulo}</strong>
          {selo && <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{selo}</span>}
        </span>
        <span className="block text-xs text-zinc-400 leading-snug mt-0.5">{descricao}</span>
      </span>
    </button>
  );
}

// Faixa "Função: Líder · Trocar".
export function FuncaoEscolhida({ texto, onTrocar }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-400 mb-4">
      <span>{t("access.role")}: <b className="text-white">{texto}</b></span>
      {onTrocar && <button type="button" onClick={onTrocar} className="text-[11px] font-black uppercase text-zinc-500 hover:text-white">{t("access.change")}</button>}
    </div>
  );
}

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Filtro de unidades: a pessoa digita nome, cidade ou estado e clica nas unidades (vira etiqueta).
export function SeletorUnidades({ unidades, selecionadas, onChange, rotulo, max = MAX_UNIDADES_PEDIDO, desabilitado }) {
  const { t } = useTranslation();
  const [busca, setBusca] = useState("");
  const porId = useMemo(() => new Map((unidades || []).map((u) => [u.id, u])), [unidades]);
  const cheio = selecionadas.length >= max;

  const lista = useMemo(() => {
    const termo = semAcento(busca.trim());
    return (unidades || [])
      .filter((u) => !selecionadas.includes(u.id))
      .filter((u) => !termo || semAcento(`${u.nome} ${u.cidade} ${u.estado}`).includes(termo))
      .slice(0, 60);
  }, [unidades, selecionadas, busca]);

  return (
    <div className="space-y-1.5">
      <label htmlFor="busca-unidade" className={classeRotulo}>{rotulo}</label>
      {unidades === null ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-3"><Loader2 className="w-4 h-4 animate-spin" /> {t("access.units.loading")}</div>
      ) : unidades.length === 0 ? (
        <p className="text-sm text-amber-400 py-2">{t("access.units.none")}</p>
      ) : (
        <div className="border border-zinc-700 rounded-xl overflow-hidden bg-zinc-900/50">
          <div className="relative border-b border-zinc-800">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
            <input
              id="busca-unidade" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off"
              disabled={desabilitado || cheio}
              placeholder={cheio ? t("access.units.max", { max }) : t("access.units.search")}
              className="w-full bg-transparent text-white font-bold pl-11 pr-4 py-3 outline-none placeholder:text-zinc-600 placeholder:font-normal disabled:cursor-not-allowed"
            />
          </div>
          {!cheio && (
            <div className="max-h-44 overflow-y-auto">
              {lista.length === 0 ? (
                <p className="px-4 py-3 text-xs text-amber-400">{t("access.units.notFound", { term: busca })}</p>
              ) : lista.map((u) => (
                <button
                  key={u.id} type="button" disabled={desabilitado}
                  onClick={() => { onChange([...selecionadas, u.id]); setBusca(""); }}
                  className="w-full flex items-baseline justify-between gap-3 px-4 py-2.5 border-b border-zinc-800/70 last:border-b-0 text-left hover:bg-red-600/10"
                >
                  <b className="text-[13px] text-white">{u.nome}</b>
                  <span className="text-[11px] text-zinc-500 whitespace-nowrap">{[u.cidade, u.estado].filter(Boolean).join(" · ")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {selecionadas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selecionadas.map((id) => (
            <button
              key={id} type="button" disabled={desabilitado}
              onClick={() => onChange(selecionadas.filter((x) => x !== id))}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-600 bg-red-600/10 text-red-100 text-xs font-bold px-2.5 py-1"
              title={t("access.units.remove")}
            >
              {porId.get(id)?.nome || id}
              {porId.get(id)?.estado && <span className="text-zinc-400">{porId.get(id).estado}</span>}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Caixa "Ficou com alguma dúvida?": mentor responsável (só o nome) + contato do Gestor das Coletivas.
export function CaixaAjuda({ mentores = [] }) {
  const { t } = useTranslation();
  const nomes = [...new Set(mentores.filter(Boolean))];
  const g = GESTOR_COLETIVAS;
  return (
    <div className="mt-6 pt-5 border-t border-zinc-800 flex gap-2.5 items-start">
      <HelpCircle className="w-[18px] h-[18px] text-zinc-500 shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed text-zinc-400 min-w-0">
        <p className="font-bold text-white">{t("access.help.title")}</p>
        <p>
          {nomes.length
            ? t("access.help.mentorNamed", { count: nomes.length, names: nomes.join(" / ") })
            : t("access.help.mentor")}{" "}
          {t("access.help.orManager")}
        </p>
        <p className="mt-1">
          <b className="text-zinc-200">{g.nome}</b> · {t("access.help.manager")}<br />
          <a href={g.whatsappLink} target="_blank" rel="noreferrer" className="text-zinc-200 underline hover:text-white">WhatsApp {g.whatsapp}</a>
          <span className="block break-all">{g.email}</span>
        </p>
      </div>
    </div>
  );
}
