// Sub-aba "Workshops" da Loja & Eventos: cadastro (nome, modalidade, data, local, situação, titular),
// duplicar, cadastro rápido do histórico, filtros. Participantes e financeiro ficam em outras etapas.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Loader2, Plus, X, Copy, Edit, Trash2, Users, ListPlus, Search, Upload, Award, UserCheck, ShoppingBag, MapPin, UserRound } from 'lucide-react';
import { useCatalogs } from '../../contexts/CatalogContext';
import { useAuth } from '../../contexts/AuthContext';
import ModalWorkshop from './ModalWorkshop';
import { CabecalhoDaAba, CaixaDeNumeros, BotaoPrincipal, BotaoSecundario } from '../Configuracoes/ui/CabecalhoDaAba';
import { MenuDeAcoes } from '../Configuracoes/ui/MenuDeAcoes';
import { temaDaAba } from '../Configuracoes/ui/temas';
import { planejarCompletarModalidade } from '../../utils/completarModalidade';
import { gravarWorkshopsCompletados } from '../../services/certificadoService';
import ImportarLista from './ImportarLista';
import ParticipantesWorkshop from './ParticipantesWorkshop';
import QuemFez from './QuemFez';
import {
  ouvirWorkshops, criarWorkshop, atualizarWorkshop, duplicarWorkshop, excluirWorkshop,
  criarWorkshopsEmLote, buscarTitularPorDocumento,
} from '../../services/workshopCadastroService';
import {
  MODALIDADES_WORKSHOP, STATUS_WORKSHOP, dataBr, errosDoWorkshop, chaveWorkshop, ordenarWorkshops,
} from '../../utils/workshopCadastro';
import { documentoValido, limparDocumento, tipoDocumentoPadrao } from '../../utils/documento';

const FORM_VAZIO = { nome: '', modalidade: 'Power Core', data: '', local: '', status: 'agendado', titularNome: '', titularProfessorId: '' };
// Cores só de status: verde = realizado, âmbar = agendado (pendente), vermelho = cancelado.
const STATUS_ESTILO = {
  realizado: { chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300', ponto: 'bg-emerald-500' },
  agendado: { chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300', ponto: 'bg-amber-500' },
  cancelado: { chip: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300', ponto: 'bg-red-500' },
};
// Campos e rótulos das janelas: o visual do Cronograma (regra do sistema).
const input = 'w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm font-bold uppercase outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100';
const rotulo = 'text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block';
const botao = 'px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all';
// Filtros da lista: campos cinza-claros, sem borda pesada (igual aos filtros das outras abas).
const campoFiltro = 'rounded-xl bg-slate-100 dark:bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300';

// Dia / mês / ano para o "calendarinho" de cada linha.
function partesDaData(data, idioma) {
  const d = new Date(`${data}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return { dia: String(d.getDate()).padStart(2, '0'), mes: d.toLocaleDateString(idioma, { month: 'short' }).replace('.', ''), ano: String(d.getFullYear()) };
}

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
  const [verQuem, setVerQuem] = useState(false);
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
    if (!window.confirm(t('shop.ws.deleteAsk', { name: w.nome }))) return;
    try { await excluirWorkshop(w.id); toast.success(t('shop.ws.deleted')); }
    catch (err) { toast.error(err?.code === 'tem-participantes' ? t('shop.ws.deleteBlocked') : t('shop.ws.deleteError')); }
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

  const tema = temaDaAba('workshops');
  const filtrosAtivos = filtroStatus !== 'todos' || busca || fModal || fAno;
  const limparFiltros = () => { setFiltroStatus('todos'); setBusca(''); setFModal(''); setFAno(''); };
  const itensMais = [
    { id: 'rapido', rotulo: t('shop.ws.quick'), icone: ListPlus, onClick: abrirRapido, oculto: !podeEditar },
    { id: 'completar', rotulo: t('shop.ws.fillModality'), icone: Award, onClick: completarModalidades, oculto: !souAdmin, desabilitado: salvando },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <CabecalhoDaAba abaId="workshops" icone={ShoppingBag} titulo={t('shop.ws.title')} subtitulo={t('shop.ws.subtitle')}
        numeros={<CaixaDeNumeros abaId="workshops" itens={[
          { id: 'todos', rotulo: t('shop.ws.stAll'), valor: contagem.todos, onClick: () => setFiltroStatus('todos'), ativo: filtroStatus === 'todos' },
          { id: 'realizado', rotulo: t('shop.ws.stRealizado'), valor: contagem.realizado, cor: 'text-emerald-600', onClick: () => setFiltroStatus('realizado'), ativo: filtroStatus === 'realizado' },
          { id: 'agendado', rotulo: t('shop.ws.stAgendado'), valor: contagem.agendado, cor: 'text-amber-600', onClick: () => setFiltroStatus('agendado'), ativo: filtroStatus === 'agendado' },
          { id: 'cancelado', rotulo: t('shop.ws.stCancelado'), valor: contagem.cancelado, cor: 'text-red-500', onClick: () => setFiltroStatus('cancelado'), ativo: filtroStatus === 'cancelado' },
        ]} />}>
        <BotaoSecundario icone={UserCheck} onClick={() => setVerQuem(true)}>{t('shop.ws.who.btn')}</BotaoSecundario>
        {itensMais.some((i) => !i.oculto) && <MenuDeAcoes itens={itensMais} />}
        {podeEditar && <BotaoPrincipal abaId="workshops" icone={Plus} onClick={abrirNovo}>{t('shop.ws.newBtn')}</BotaoPrincipal>}
      </CabecalhoDaAba>

      {erroCarga && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-bold">{t('shop.ws.loadError')}</div>}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] group">
          <Search className={`w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${tema.lupa}`} />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('shop.ws.search')} aria-label={t('shop.ws.search')}
            className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 ${tema.foco}`} />
        </div>
        <select value={fModal} onChange={(e) => setFModal(e.target.value)} className={`${campoFiltro} ${tema.foco}`} aria-label={t('shop.ws.modality')}>
          <option value="">{t('shop.ws.allModalities')}</option>
          {MODALIDADES_WORKSHOP.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fAno} onChange={(e) => setFAno(e.target.value)} className={`${campoFiltro} ${tema.foco}`} aria-label={t('shop.ws.date')}>
          <option value="">{t('shop.ws.allYears')}</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {filtrosAtivos && (
          <button type="button" onClick={limparFiltros} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-red-600 px-2 py-2">
            <X className="w-3.5 h-3.5" /> {t('filtroPadrao.clear')}
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {visiveis.map((w, i) => {
          const parte = partesDaData(w.data, i18n.language);
          const ano = String(w.data || '').slice(0, 4);
          const novoAno = i === 0 || ano !== String(visiveis[i - 1].data || '').slice(0, 4);
          const est = STATUS_ESTILO[w.status] || STATUS_ESTILO.agendado;
          const itens = [
            { id: 'importar', rotulo: t('shop.ws.importBtn'), icone: Upload, onClick: () => setImportando(w), oculto: !souAdmin },
            { id: 'duplicar', rotulo: t('shop.ws.duplicate'), icone: Copy, onClick: () => abrirDup(w), oculto: !podeEditar },
            { id: 'editar', rotulo: t('shop.ws.edit'), icone: Edit, onClick: () => abrirEditar(w), oculto: !podeEditar },
            { id: 'excluir', rotulo: t('shop.ws.delete'), icone: Trash2, onClick: () => excluir(w), tipo: 'perigo', oculto: !podeEditar },
          ];
          return (
            <React.Fragment key={w.id}>
              {novoAno && ano && <h3 className="pt-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">{ano}</h3>}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors px-4 py-3.5 flex items-center gap-4">
                <div className="w-12 shrink-0 text-center leading-none" title={dataBr(w.data)}>
                  {parte ? (
                    <>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{parte.mes}</p>
                      <p className="text-2xl font-black text-slate-700 dark:text-slate-200 my-0.5 tabular-nums">{parte.dia}</p>
                      <p className="text-[10px] font-semibold text-slate-400">{parte.ano}</p>
                    </>
                  ) : <p className="text-[10px] font-bold text-slate-400">{dataBr(w.data)}</p>}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="font-bold text-slate-800 dark:text-white break-words leading-snug">{w.nome}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold">{w.modalidade}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold ${est.chip}`}><span className={`w-1.5 h-1.5 rounded-full ${est.ponto}`} />{t(`shop.ws.status.${w.status}`)}</span>
                    {w.local && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {w.local}</span>}
                    <span className="inline-flex items-center gap-1"><UserRound className="w-3 h-3" /> {w.titularNome || t('shop.ws.noTitular')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {souAdmin ? (
                    <button type="button" onClick={() => setVerPart(w)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><Users className="w-3.5 h-3.5" /> {t('shop.ws.participantsBtn', { count: w.totalParticipantes || 0 })}</button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 px-2"><Users className="w-3.5 h-3.5" /> {w.totalParticipantes || 0}</span>
                  )}
                  {itens.some((x) => !x.oculto) && <MenuDeAcoes itens={itens} />}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {visiveis.length === 0 && <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">{t('shop.ws.none')}</div>}
      </div>

      {verQuem && <QuemFez workshops={lista || []} professores={professores || []} unidades={unidades || []} onClose={() => setVerQuem(false)} />}
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
