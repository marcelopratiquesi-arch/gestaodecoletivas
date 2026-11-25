import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { BellRing, Loader2, Send } from "lucide-react";
import { db } from "../../../services/firebase";
import { useCatalogs } from "../../../contexts/CatalogContext";
import PopupFlutuante from "../../../components/PopupFlutuante";
import { pedirEnvioDeAviso } from "../../../services/avisosPushService";
import { CabecalhoDaAba } from "../ui/CabecalhoDaAba";

// Aba "Avisos" (só admin): escreve o aviso, escolhe quem recebe, confere e envia. Quem envia de verdade é o servidor
// (api/enviar-aviso.js). O histórico vem de avisos_enviados (só o admin lê).
const ROTULO = "text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block";
const CAMPO = "w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm font-bold outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100";
const SECAO = "text-[11px] font-black uppercase tracking-widest text-red-600";
const PAPEIS = [
  { id: "mentor", nome: "Mentores" },
  { id: "lider", nome: "Líderes" },
  { id: "professor", nome: "Professores" },
  { id: "admin", nome: "Administradores" },
];
const TELAS = [
  { id: "", nome: "Só o aviso (abre o sistema)" },
  { id: "/app/meu-cadastro", nome: "Meu cadastro" },
  { id: "/app/cronograma", nome: "Cronograma" },
  { id: "/app/validacao-diaria", nome: "Validação diária" },
];
const ROTULO_PAPEL = Object.fromEntries(PAPEIS.map((p) => [p.id, p.nome]));

const quando = (ts) => {
  const d = ts?.toDate?.();
  return d ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
};

export function AvisosTab() {
  const { catalogs } = useCatalogs();
  const unidades = useMemo(() => [...(catalogs?.unidades || [])].sort((a, b) => String(a.nome).localeCompare(String(b.nome))), [catalogs]);

  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [link, setLink] = useState("");
  const [modo, setModo] = useState("grupo"); // grupo | pessoas
  const [papeis, setPapeis] = useState([]);
  const [unidadeIds, setUnidadeIds] = useState([]);
  const [uids, setUids] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [busca, setBusca] = useState("");
  const [historico, setHistorico] = useState([]);

  const [conferindo, setConferindo] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState(null);

  const carregarHistorico = () =>
    getDocs(query(collection(db, "avisos_enviados"), orderBy("enviadoEm", "desc"), limit(30)))
      .then((s) => setHistorico(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => setHistorico([]));

  useEffect(() => {
    carregarHistorico();
  }, []);
  useEffect(() => {
    if (modo !== "pessoas" || pessoas.length) return;
    getDocs(collection(db, "usuarios")).then((s) =>
      setPessoas(s.docs.map((d) => ({ id: d.id, nome: d.data().nome || d.data().email || d.id, role: d.data().role, status: d.data().status }))
        .filter((p) => p.role !== "bloqueado" && p.status !== "inativo")
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome)))));
  }, [modo, pessoas.length]);

  const alternar = (lista, setLista, id) => setLista(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const destino = modo === "pessoas" ? { tipo: "pessoas", uids } : { tipo: "filtro", papeis, unidadeIds };
  const destinoResumo = modo === "pessoas"
    ? `${uids.length} pessoa(s) escolhida(s)`
    : [papeis.length ? papeis.map((p) => ROTULO_PAPEL[p]).join(", ") : "Todos os papéis",
      unidadeIds.length ? unidadeIds.map((id) => unidades.find((u) => String(u.id) === String(id))?.nome || id).join(", ") : "todas as unidades"].join(" · ");
  const corpo = { titulo, texto, link, destino, destinoResumo };
  const podeConferir = titulo.trim().length >= 2 && texto.trim().length >= 2 && (modo === "grupo" || uids.length > 0);

  const conferir = async () => {
    setErro("");
    setFeito(null);
    setResumo(null);
    setConferindo(true);
    try {
      setResumo(await pedirEnvioDeAviso({ ...corpo, somenteContar: true }));
    } catch (e) {
      setErro(e.message);
      setConferindo(false);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    setErro("");
    try {
      const r = await pedirEnvioDeAviso(corpo);
      setFeito(r);
      setConferindo(false);
      setTitulo("");
      setTexto("");
      carregarHistorico();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const pessoasFiltradas = pessoas.filter((p) => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 80);

  return (
    <div className="space-y-6">
      <CabecalhoDaAba abaId="avisos" icone={BellRing} titulo="Avisos" subtitulo="Mande um recado para o celular e o computador da equipe. Só recebe quem já ativou os avisos em Meu cadastro." />

      <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-4">
        <h3 className={SECAO}>O aviso</h3>
        <div>
          <label htmlFor="av-titulo" className={ROTULO}>Título ({titulo.trim().length}/60)</label>
          <input id="av-titulo" value={titulo} maxLength={60} onChange={(e) => setTitulo(e.target.value)} className={CAMPO} placeholder="Ex.: Atualize o sistema" />
        </div>
        <div>
          <label htmlFor="av-texto" className={ROTULO}>Texto ({texto.trim().length}/300)</label>
          <textarea id="av-texto" value={texto} maxLength={300} rows={3} onChange={(e) => setTexto(e.target.value)} className={CAMPO} placeholder="Ex.: Feche e abra o aplicativo para pegar a versão nova." />
        </div>
        <div>
          <label htmlFor="av-link" className={ROTULO}>Ao tocar no aviso, abrir</label>
          <select id="av-link" value={link} onChange={(e) => setLink(e.target.value)} className={CAMPO}>
            {TELAS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
      </section>

      <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-4">
        <h3 className={SECAO}>Para quem</h3>
        <div className="flex gap-2">
          {[["grupo", "Por grupo"], ["pessoas", "Pessoas escolhidas"]].map(([id, nome]) => (
            <button key={id} type="button" onClick={() => setModo(id)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase border ${modo === id ? "bg-red-600 text-white border-red-600" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"}`}>
              {nome}
            </button>
          ))}
        </div>

        {modo === "grupo" ? (
          <>
            <div>
              <span className={ROTULO}>Papel (nenhum marcado = todos)</span>
              <div className="flex flex-wrap gap-2">
                {PAPEIS.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={papeis.includes(p.id)} onChange={() => alternar(papeis, setPapeis, p.id)} className="accent-red-600" /> {p.nome}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className={ROTULO}>Unidade (nenhuma marcada = todas)</span>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-auto">
                {unidades.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={unidadeIds.includes(String(u.id))} onChange={() => alternar(unidadeIds, setUnidadeIds, String(u.id))} className="accent-red-600" /> {u.nome}
                  </label>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="av-busca" className={ROTULO}>Buscar pessoa ({uids.length} escolhida{uids.length === 1 ? "" : "s"})</label>
            <input id="av-busca" value={busca} onChange={(e) => setBusca(e.target.value)} className={CAMPO} placeholder="Digite o nome" />
            {!pessoas.length && <Loader2 className="w-5 h-5 animate-spin text-red-500 mt-3" />}
            <div className="mt-3 max-h-64 overflow-auto space-y-1">
              {pessoasFiltradas.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input type="checkbox" checked={uids.includes(p.id)} onChange={() => alternar(uids, setUids, p.id)} className="accent-red-600" />
                  <span className="flex-1">{p.nome}</span>
                  <span className="text-[10px] uppercase text-slate-400">{ROTULO_PAPEL[p.role === "unidade" ? "lider" : p.role] || p.role}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {erro && !conferindo && <p className="text-sm font-bold text-red-600">{erro}</p>}
        {feito && (
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            Aviso enviado: {feito.entregues} aparelho(s) de {feito.pessoasComAviso} pessoa(s){feito.falhas ? `; ${feito.falhas} não receberam` : ""}.
          </p>
        )}
        <button type="button" onClick={conferir} disabled={!podeConferir}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-5 py-3 text-sm font-black uppercase text-white disabled:opacity-50">
          <Send size={16} /> Conferir e enviar
        </button>
      </section>

      <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-3">
        <h3 className={SECAO}>Histórico (últimos 30)</h3>
        {!historico.length && <p className="text-sm text-slate-500">Nenhum aviso enviado ainda.</p>}
        {historico.map((h) => (
          <div key={h.id} className="border-t border-slate-200 dark:border-slate-700 pt-3 first:border-0 first:pt-0">
            <p className="text-sm font-black text-slate-800 dark:text-white">{h.titulo} <span className="text-xs font-bold text-slate-400">· {quando(h.enviadoEm)}</span></p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{h.texto}</p>
            <p className="text-[11px] font-bold uppercase text-slate-400 mt-1">
              {h.destinoResumo} · {h.entregues ?? 0} aparelho(s) / {h.pessoasComAviso ?? 0} de {h.pessoas ?? 0} pessoa(s) · por {h.enviadoPorNome}
            </p>
          </div>
        ))}
      </section>

      {conferindo && (
        <PopupFlutuante
          titulo="Conferir aviso"
          onFechar={() => { setConferindo(false); setResumo(null); }}
          bloquearFechar={enviando}
          chaveMemoria="avisos.popupConferir"
          largura={480}
          altura={520}
          rodape={(
            <div className="flex gap-3">
              <button type="button" onClick={() => { setConferindo(false); setResumo(null); }} disabled={enviando}
                className="flex-1 rounded-xl bg-slate-200 text-slate-700 px-4 py-3 text-sm font-black uppercase disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={enviar} disabled={enviando || !resumo || !resumo.aparelhos}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white px-4 py-3 text-sm font-black uppercase disabled:opacity-50">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />} Enviar agora
              </button>
            </div>
          )}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-300 bg-white p-4">
              <p className="text-sm font-black text-slate-800">{titulo}</p>
              <p className="text-sm text-slate-600 normal-case">{texto}</p>
            </div>
            {!resumo && !erro && <Loader2 className="w-5 h-5 animate-spin text-red-500" />}
            {erro && <p className="text-sm font-bold text-red-600">{erro}</p>}
            {resumo && (
              <>
                <p className="text-sm font-bold text-slate-700">
                  Vai chegar para <b>{resumo.pessoasComAviso} pessoa(s)</b> ({resumo.aparelhos} aparelho(s)) de {resumo.pessoas} do grupo: {destinoResumo}.
                </p>
                {resumo.pessoasSemAviso > 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-800 normal-case">
                    {resumo.pessoasSemAviso} pessoa(s) ainda não ativaram os avisos e NÃO vão receber:
                    {" "}{resumo.nomesSemAviso?.join(", ")}{resumo.pessoasSemAviso > (resumo.nomesSemAviso?.length || 0) ? "..." : ""}
                  </div>
                )}
                {!resumo.aparelhos && <p className="text-sm font-bold text-red-600">Ninguém desse grupo ativou os avisos ainda.</p>}
              </>
            )}
          </div>
        </PopupFlutuante>
      )}
    </div>
  );
}
