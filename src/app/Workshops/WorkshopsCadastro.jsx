// Sub-aba "Workshops" da Loja & Eventos: cadastro (nome, modalidade, data, local, situação, titular),
// duplicar, cadastro rápido do histórico, filtros. Participantes e financeiro ficam em outras etapas.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Calendar, Loader2, Plus, X, Copy, Edit, Trash2, Users, ListPlus, Search, Upload, Award } from 'lucide-react';
import { useCatalogs } from '../../contexts/CatalogContext';
import { useAuth } from '../../contexts/AuthContext';
import ModalWorkshop from './ModalWorkshop';
import { planejarCompletarModalidade } from '../../utils/completarModalidade';
import { gravarWorkshopsCompletados } from '../../services/certificadoService';
import ImportarLista from './ImportarLista';
import ParticipantesWorkshop from './ParticipantesWorkshop';
import {
  ouvirWorkshops, criarWorkshop, atualizarWorkshop, duplicarWorkshop, excluirWorkshop,
  criarWorkshopsEmLote, buscarTitularPorDocumento,
} from '../../services/workshopCadastroService';
import {
  MODALIDADES_WORKSHOP, STATUS_WORKSHOP, dataBr, errosDoWorkshop, chaveWorkshop, ordenarWorkshops,
} from '../../utils/workshopCadastro';
import { documentoValido, limparDocumento, tipoDocumentoPadrao } from '../../utils/documento';

const FORM_VAZIO = { nome: '', modalidade: 'Power Core', data: '', local: '', status: 'agendado', titularNome: '', titularProfessorId: '' };
const COR_STATUS = {
  realizado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  agendado: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  cancelado: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
const input = 'w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:border-red-500 text-slate-800 dark:text-white';
const rotulo = 'text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 block';
const botao = 'px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all';

const Modal = ModalWorkshop;

export default function WorkshopsCadastro() {
  const { t, i18n } = useTranslation();
  // O contexto entrega { catalogs: { professores, unidades, ... } }. (Antes lia "professores" direto do contexto,
  // que não existe: a lista vinha vazia e a importação não achava ninguém no cadastro.)
  const { catalogs } = useCatalogs();
  const professores = catalogs?.professores;
  const unidades = catalogs?.unidades;
  const { userData } = useAuth();
  // Participantes e importação têm contato de gente que pode nem ser professor: só o admin.
  const souAdmin = ['admin', 'administrador', 'master'].includes(String(userData?.role || '').trim().toLowerCase());
  // Admin e mentor cadastram e editam; o líder só VÊ a lista (as regras do banco também barram a gravação dele).
  const podeEditar = souAdmin || String(userData?.role || '').trim().toLowerCase() === 'mentor';
  const [importando, setImportando] = useState(null); // workshop
  const [verPart, setVerPart] = useState(null); // workshop
  const [lista, setLista] = useState(null);
  const [erroCarga, setErroCarga] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');
  const [fModal, setFModal] = useState('');
  const [fAno, setFAno] = useState('');

  const [form, setForm] = useState(null); // { id|null, ...campos }
  const [dup, setDup] = useState(null); // { original, nome, data, status }
  const [rapido, setRapido] = useState(null); // [{...campos}]
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(null);

  // Admin: completa a modalidade dos workshops antigos que já estão nos professores (zero leituras: usa o que já está carregado).
  async function completarModalidades() {
    const plano = planejarCompletarModalidade(professores || [], lista || []);
    if (plano.gravar.length === 0) {
      toast(plano.semResposta.length ? t('shop.ws.fillModalityLeft', { n: plano.semResposta.length }) : t('shop.ws.fillModalityNothing'));
      return;
    }
    if (!window.confirm(t('shop.ws.fillModalityConfirm', { cadastro: plano.porCadastro, nome: plano.porNome, sem: plano.semResposta.length }))) return;
    setSalvando(true);
    try {
      await gravarWorkshopsCompletados(plano.gravar);
      toast.success(t('shop.ws.fillModalityDone', { n: plano.gravar.length }));
    } catch (e) { console.error(e); toast.error(t('shop.ws.fillModalityError')); } finally { setSalvando(false); }
  }

  const [cpf, setCpf] = useState('');
  const [cpfMsg, setCpfMsg] = useState(null); // { tipo: 'ok'|'aviso', texto }
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const parar = ouvirWorkshops(setLista, () => { setErroCarga(true); setLista([]); });
    return parar;
  }, []);

  const contagem = useMemo(() => {
    const c = { todos: 0, agendado: 0, realizado: 0, cancelado: 0 };
    (lista || []).forEach((w) => { c.todos += 1; if (c[w.status] !== undefined) c[w.status] += 1; });
    return c;
  }, [lista]);
  const anos = useMemo(() => [...new Set((lista || []).map((w) => String(w.data || '').slice(0, 4)).filter(Boolean))].sort().reverse(), [lista]);
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ordenarWorkshops((lista || []).filter((w) =>
      (filtroStatus === 'todos' || w.status === filtroStatus)
      && (!q || String(w.nome).toLowerCase().includes(q))
      && (!fModal || w.modalidade === fModal)
      && (!fAno || String(w.data).startsWith(fAno))));
  }, [lista, filtroStatus, busca, fModal, fAno]);

  const nomesProfessores = useMemo(() => (professores || []).map((p) => ({ id: String(p.id), nome: p.nome })).filter((p) => p.nome), [professores]);

  const msgErros = (erros) => erros.map((e) => t(`shop.ws.errors.${e}`)).join(', ');

  // ----- novo / editar -----
  const abrirNovo = () => { setForm({ id: null, ...FORM_VAZIO }); setCpf(''); setCpfMsg(null); };
  const abrirEditar = (w) => {
    setForm({ id: w.id, nome: w.nome || '', modalidade: w.modalidade, data: w.data || '', local: w.local || '', status: w.status, titularNome: w.titularNome || '', titularProfessorId: w.titularProfessorId || '' });
    setCpf(''); setCpfMsg(null);
  };
  const mudar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const buscarCpf = async () => {
    const tipo = tipoDocumentoPadrao(i18n.language);
    if (!documentoValido(tipo, cpf)) { setCpfMsg({ tipo: 'aviso', texto: t('shop.ws.cpfInvalid') }); return; }
    setBuscando(true); setCpfMsg(null);
    try {
      const r = await buscarTitularPorDocumento(tipo, limparDocumento(cpf), nomesProfessores);
      if (r === 'sem-permissao') setCpfMsg({ tipo: 'aviso', texto: t('shop.ws.cpfNoAccess') });
      else if (!r) setCpfMsg({ tipo: 'aviso', texto: t('shop.ws.cpfNotFound') });
      else if (r.semNome) setCpfMsg({ tipo: 'aviso', texto: t('shop.ws.cpfLinkedNoName') });
      else {
        setForm((f) => ({ ...f, titularNome: r.nome, titularProfessorId: r.professorId || '' }));
        setCpfMsg({ tipo: 'ok', texto: t('shop.ws.cpfFound', { name: r.nome }) });
      }
    } catch (e) { console.error(e); setCpfMsg({ tipo: 'aviso', texto: t('shop.ws.saveError') }); }
    setBuscando(false);
  };

  const escolherDaLista = (id) => {
    const p = nomesProfessores.find((x) => x.id === id);
    setForm((f) => ({ ...f, titularNome: p ? p.nome : '', titularProfessorId: p ? p.id : '' }));
  };

  const repetido = (dados, ignorarId) => (lista || []).some((w) => w.id !== ignorarId && chaveWorkshop(w.nome, w.data) === chaveWorkshop(dados.nome, dados.data));

  const salvarForm = async (e) => {
    e.preventDefault();
    const erros = errosDoWorkshop(form);
    if (erros.length) { toast.error(msgErros(erros)); return; }
    if (repetido(form, form.id)) { toast.error(t('shop.ws.alreadyExists')); return; }
    setSalvando(true);
    try {
      if (form.id) { await atualizarWorkshop(form.id, form); toast.success(t('shop.ws.updated')); }
      else { await criarWorkshop(form); toast.success(t('shop.ws.saved')); }
      setForm(null);
    } catch (err) { console.error(err); toast.error(t('shop.ws.saveError')); }
    setSalvando(false);
  };

  // ----- duplicar -----
  const abrirDup = (w) => setDup({ original: w, nome: w.nome, data: '', status: 'agendado' });
  const salvarDup = async (e) => {
    e.preventDefault();
    const dados = { ...dup.original, nome: dup.nome, data: dup.data, status: dup.status };
    const erros = errosDoWorkshop(dados);
    if (erros.length) { toast.error(msgErros(erros)); return; }
    if (repetido(dados)) { toast.error(t('shop.ws.alreadyExists')); return; }
    setSalvando(true);
    try { await duplicarWorkshop(dup.original, dup); toast.success(t('shop.ws.copied')); setDup(null); }
    catch (err) { console.error(err); toast.error(t('shop.ws.saveError')); }
    setSalvando(false);
  };

  // ----- excluir -----
  const excluir = async (w) => {
    if (Number(w.totalParticipantes || 0) > 0) { toast.error(t('shop.ws.deleteBlocked')); return; }
    if (confirmando !== w.id) { setConfirmando(w.id); setTimeout(() => setConfirmando((c) => (c === w.id ? null : c)), 3500); return; }
    try { await excluirWorkshop(w.id); toast.success(t('shop.ws.deleted')); }
    catch (err) { toast.error(err?.code === 'tem-participantes' ? t('shop.ws.deleteBlocked') : t('shop.ws.deleteError')); }
    setConfirmando(null);
  };

  // ----- cadastro rápido -----
  const linhaVazia = () => ({ nome: '', modalidade: 'Power Core', data: '', local: '', status: 'realizado' });
  const abrirRapido = () => setRapido([linhaVazia(), linhaVazia(), linhaVazia()]);
  const mudarLinha = (i, campo, valor) => setRapido((r) => r.map((l, k) => (k === i ? { ...l, [campo]: valor } : l)));
  const salvarRapido = async () => {
    const preenchidas = rapido.map((l, i) => ({ ...l, linha: i + 1 })).filter((l) => l.nome.trim() || l.data);
    if (!preenchidas.length) { toast.error(t('shop.ws.quickNothing')); return; }
    for (const l of preenchidas) {
      const erros = errosDoWorkshop(l);
      if (erros.length) { toast.error(t('shop.ws.quickRowError', { row: l.linha, fields: msgErros(erros) })); return; }
    }
    setSalvando(true);
    try {
      const r = await criarWorkshopsEmLote(preenchidas, lista || []);
      if (r.criados) toast.success(t('shop.ws.quickSaved', { count: r.criados }));
      if (r.jaExistiam) toast(t('shop.ws.quickSkipped', { count: r.jaExistiam }));
      setRapido(null);
    } catch (err) { console.error(err); toast.error(t('shop.ws.saveError')); }
    setSalvando(false);
  };

  if (lista === null) return <div className="flex py-20 justify-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400 rounded-xl"><Calendar className="w-6 h-6" /></div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase">{t('shop.ws.title')}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('shop.ws.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {souAdmin && <button type="button" onClick={completarModalidades} disabled={salvando || lista === null} className={`${botao} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60`}><Award className="w-4 h-4" /> {t('shop.ws.fillModality')}</button>}
          {podeEditar && <button type="button" onClick={abrirRapido} className={`${botao} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700`}><ListPlus className="w-4 h-4" /> {t('shop.ws.quick')}</button>}
          {podeEditar && <button type="button" onClick={abrirNovo} className={`${botao} bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-slate-500/20`}><Plus className="w-4 h-4" /> {t('shop.ws.newBtn')}</button>}
        </div>
      </div>

      {erroCarga && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-bold">{t('shop.ws.loadError')}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['todos', 'stAll'], ['realizado', 'stRealizado'], ['agendado', 'stAgendado'], ['cancelado', 'stCancelado']].map(([k, rot]) => (
          <button key={k} type="button" onClick={() => setFiltroStatus(k)}
            className={`text-left p-4 rounded-2xl border bg-white dark:bg-slate-800 transition-all ${filtroStatus === k ? 'border-slate-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
            <span className="block text-2xl font-black text-slate-800 dark:text-white tabular-nums">{contagem[k]}</span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t(`shop.ws.${rot}`)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('shop.ws.search')} aria-label={t('shop.ws.search')} className={`${input} pl-9`} />
        </div>
        <select value={fModal} onChange={(e) => setFModal(e.target.value)} className={`${input} !w-auto`} aria-label={t('shop.ws.modality')}>
          <option value="">{t('shop.ws.allModalities')}</option>
          {MODALIDADES_WORKSHOP.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fAno} onChange={(e) => setFAno(e.target.value)} className={`${input} !w-auto`} aria-label={t('shop.ws.date')}>
          <option value="">{t('shop.ws.allYears')}</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {visiveis.map((w) => (
          <div key={w.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-1 text-[9px] font-black uppercase rounded-md tracking-widest bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300">{w.modalidade}</span>
                <span className={`px-2 py-1 text-[9px] font-black uppercase rounded-md tracking-widest ${COR_STATUS[w.status] || ''}`}>{t(`shop.ws.status.${w.status}`)}</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md"><Calendar className="w-3 h-3" /> {dataBr(w.data)}</span>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight break-words">{w.nome}</h3>
              <p className="text-xs text-slate-500 flex flex-wrap gap-x-5 gap-y-1">
                <span>{t('shop.ws.place')}: <b className="text-slate-700 dark:text-slate-200">{w.local || '—'}</b></span>
                <span>{t('shop.ws.titular')}: <b className="text-slate-700 dark:text-slate-200">{w.titularNome || t('shop.ws.noTitular')}</b></span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {souAdmin ? (
                <>
                  <button type="button" onClick={() => setVerPart(w)} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-700"><Users className="w-3.5 h-3.5" /> {t('shop.ws.participantsBtn', { count: w.totalParticipantes || 0 })}</button>
                  <button type="button" onClick={() => setImportando(w)} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-black hover:bg-red-700"><Upload className="w-3.5 h-3.5" /> {t('shop.ws.importBtn')}</button>
                </>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 border border-dashed border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2"><Users className="w-3.5 h-3.5" /> {w.totalParticipantes || 0}</span>
              )}
              {podeEditar && <button type="button" onClick={() => abrirDup(w)} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 dark:text-slate-300 text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-900/30"><Copy className="w-3.5 h-3.5" /> {t('shop.ws.duplicate')}</button>}
              {podeEditar && <button type="button" onClick={() => abrirEditar(w)} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-700"><Edit className="w-3.5 h-3.5" /> {t('shop.ws.edit')}</button>}
              {podeEditar && <button type="button" onClick={() => excluir(w)} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-red-600 text-xs font-black hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /> {confirmando === w.id ? t('shop.ws.confirmDelete') : t('shop.ws.delete')}</button>}
            </div>
          </div>
        ))}
        {visiveis.length === 0 && <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">{t('shop.ws.none')}</div>}
      </div>

      {importando && (
        <ImportarLista workshop={importando} professores={professores || []} unidades={unidades || []} onClose={() => setImportando(null)} onVerParticipantes={() => { setVerPart(importando); setImportando(null); }} />
      )}
      {verPart && (
        <ParticipantesWorkshop workshop={lista.find((w) => w.id === verPart.id) || verPart} professores={professores || []} unidades={unidades || []} onClose={() => setVerPart(null)} onImportar={() => { setImportando(verPart); setVerPart(null); }} />
      )}

      {form && (
        <Modal titulo={form.id ? t('shop.ws.formEdit') : t('shop.ws.formNew')} onClose={() => setForm(null)}
          rodape={<>
            <button type="button" onClick={() => setForm(null)} className={`${botao} text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700`}>{t('shop.ws.cancel')}</button>
            <button type="submit" form="form-workshop" disabled={salvando} className={`${botao} bg-red-600 text-white hover:bg-red-700 disabled:opacity-60`}>{salvando ? t('shop.ws.saving') : t('shop.ws.save')}</button>
          </>}>
          <form id="form-workshop" onSubmit={salvarForm} className="space-y-4">
            <div><label className={rotulo} htmlFor="ws-nome">{t('shop.ws.name')}</label><input id="ws-nome" className={input} value={form.nome} onChange={(e) => mudar('nome', e.target.value)} placeholder={t('shop.ws.namePh')} maxLength={150} required /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={rotulo} htmlFor="ws-mod">{t('shop.ws.modality')}</label><select id="ws-mod" className={input} value={form.modalidade} onChange={(e) => mudar('modalidade', e.target.value)}>{MODALIDADES_WORKSHOP.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
              <div><label className={rotulo} htmlFor="ws-data">{t('shop.ws.date')}</label><input id="ws-data" type="date" className={input} value={form.data} onChange={(e) => mudar('data', e.target.value)} required /></div>
              <div><label className={rotulo} htmlFor="ws-local">{t('shop.ws.placeLabel')}</label><input id="ws-local" className={input} value={form.local} onChange={(e) => mudar('local', e.target.value)} placeholder={t('shop.ws.placePh')} maxLength={150} /></div>
              <div><label className={rotulo} htmlFor="ws-status">{t('shop.ws.situation')}</label><select id="ws-status" className={input} value={form.status} onChange={(e) => mudar('status', e.target.value)}>{STATUS_WORKSHOP.map((s) => <option key={s} value={s}>{t(`shop.ws.status.${s}`)}</option>)}</select></div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
              <div><span className={rotulo}>{t('shop.ws.titularLabel')}</span><p className="text-xs text-slate-500">{t('shop.ws.titularHint')}</p></div>
              <div className="flex flex-wrap gap-2">
                <input className={`${input} flex-1 min-w-[160px]`} inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder={t('shop.ws.cpfPh')} aria-label={t('shop.ws.cpfPh')} />
                <button type="button" onClick={buscarCpf} disabled={buscando} className={`${botao} border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white disabled:opacity-60`}>{buscando ? t('shop.ws.lookupBusy') : t('shop.ws.lookup')}</button>
              </div>
              {cpfMsg && <div className={`text-xs font-bold rounded-lg px-3 py-2 ${cpfMsg.tipo === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{cpfMsg.texto}</div>}
              <div className="flex flex-wrap gap-2">
                <select className={`${input} flex-1 min-w-[160px]`} value={form.titularProfessorId} onChange={(e) => escolherDaLista(e.target.value)} aria-label={t('shop.ws.pickFromList')}>
                  <option value="">{t('shop.ws.pickFromList')}</option>
                  {nomesProfessores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <input className={`${input} flex-1 min-w-[160px]`} value={form.titularProfessorId ? '' : form.titularNome} disabled={!!form.titularProfessorId} onChange={(e) => mudar('titularNome', e.target.value)} placeholder={t('shop.ws.typeName')} aria-label={t('shop.ws.typeName')} maxLength={150} />
              </div>
              {form.titularNome && (
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>{t('shop.ws.titularChosen', { name: form.titularNome })}</span>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, titularNome: '', titularProfessorId: '' }))} className="underline">{t('shop.ws.titularClear')}</button>
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}

      {dup && (
        <Modal titulo={t('shop.ws.duplicateTitle')} onClose={() => setDup(null)}
          rodape={<>
            <button type="button" onClick={() => setDup(null)} className={`${botao} text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700`}>{t('shop.ws.cancel')}</button>
            <button type="submit" form="form-dup" disabled={salvando} className={`${botao} bg-red-600 text-white hover:bg-red-700 disabled:opacity-60`}>{salvando ? t('shop.ws.saving') : t('shop.ws.createCopy')}</button>
          </>}>
          <form id="form-dup" onSubmit={salvarDup} className="space-y-4">
            <p className="text-sm text-slate-500">{t('shop.ws.duplicateHint')}</p>
            <div><label className={rotulo} htmlFor="dup-nome">{t('shop.ws.name')}</label><input id="dup-nome" className={input} value={dup.nome} onChange={(e) => setDup({ ...dup, nome: e.target.value })} maxLength={150} required /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={rotulo} htmlFor="dup-data">{t('shop.ws.newDate')}</label><input id="dup-data" type="date" className={input} value={dup.data} onChange={(e) => setDup({ ...dup, data: e.target.value })} required autoFocus /></div>
              <div><label className={rotulo} htmlFor="dup-status">{t('shop.ws.situation')}</label><select id="dup-status" className={input} value={dup.status} onChange={(e) => setDup({ ...dup, status: e.target.value })}>{STATUS_WORKSHOP.map((s) => <option key={s} value={s}>{t(`shop.ws.status.${s}`)}</option>)}</select></div>
            </div>
          </form>
        </Modal>
      )}

      {rapido && (
        <Modal largo titulo={t('shop.ws.quickTitle')} onClose={() => setRapido(null)}
          rodape={<>
            <button type="button" onClick={() => setRapido(null)} className={`${botao} text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700`}>{t('shop.ws.cancel')}</button>
            <button type="button" onClick={salvarRapido} disabled={salvando} className={`${botao} bg-red-600 text-white hover:bg-red-700 disabled:opacity-60`}>{salvando ? t('shop.ws.saving') : t('shop.ws.saveAll')}</button>
          </>}>
          <p className="text-sm text-slate-500">{t('shop.ws.quickHint')}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead><tr className="text-left">{['name', 'modality', 'date', 'placeLabel', 'situation'].map((c) => <th key={c} className={`${rotulo} p-1.5`}>{t(`shop.ws.${c}`)}</th>)}<th /></tr></thead>
              <tbody>
                {rapido.map((l, i) => (
                  <tr key={i}>
                    <td className="p-1"><input className={`${input} !p-2`} value={l.nome} onChange={(e) => mudarLinha(i, 'nome', e.target.value)} maxLength={150} aria-label={t('shop.ws.name')} /></td>
                    <td className="p-1"><select className={`${input} !p-2`} value={l.modalidade} onChange={(e) => mudarLinha(i, 'modalidade', e.target.value)} aria-label={t('shop.ws.modality')}>{MODALIDADES_WORKSHOP.map((m) => <option key={m} value={m}>{m}</option>)}</select></td>
                    <td className="p-1"><input type="date" className={`${input} !p-2`} value={l.data} onChange={(e) => mudarLinha(i, 'data', e.target.value)} aria-label={t('shop.ws.date')} /></td>
                    <td className="p-1"><input className={`${input} !p-2`} value={l.local} onChange={(e) => mudarLinha(i, 'local', e.target.value)} maxLength={150} aria-label={t('shop.ws.placeLabel')} /></td>
                    <td className="p-1"><select className={`${input} !p-2`} value={l.status} onChange={(e) => mudarLinha(i, 'status', e.target.value)} aria-label={t('shop.ws.situation')}>{STATUS_WORKSHOP.map((s) => <option key={s} value={s}>{t(`shop.ws.status.${s}`)}</option>)}</select></td>
                    <td className="p-1"><button type="button" onClick={() => setRapido((r) => r.filter((_, k) => k !== i))} className="p-2 text-slate-400 hover:text-red-500" aria-label={t('shop.ws.removeRow')}><X className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => setRapido((r) => [...r, linhaVazia()])} className={`${botao} border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white`}><Plus className="w-4 h-4" /> {t('shop.ws.addRow')}</button>
        </Modal>
      )}
    </div>
  );
}
