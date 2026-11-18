import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { useAuth } from "../../../contexts/AuthContext"; // Importado para Auditoria
import { useCatalogs } from '../../../contexts/CatalogContext';
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  writeBatch, query, where, serverTimestamp
} from 'firebase/firestore';
import { Calendar, Plus, Trash2, Loader2, CalendarDays, MapPin, Search, CheckSquare, Square, Check, X, Inbox } from 'lucide-react';
import { formatDate as formatarData } from '../../../utils/formatters';
import { ESCOPOS_FERIADO, escopoDoFeriado, normalizarPais, normalizarTexto, ehCancelamentoAutomaticoDeFeriado } from '../../../utils/feriados';
import { montarFeriado, feriadoDaProposta, ESCOPOS_DO_MENTOR, STATUS_PROPOSTA } from '../../../utils/feriadosProposta';
import { useTranslation } from 'react-i18next';
import { CabecalhoDaAba } from '../ui/CabecalhoDaAba';
import { BotaoDeLinha } from '../ui/BotaoDeLinha';

// Tipo gravado no banco (português) -> chave de tradução.
const TIPOS_FERIADO = { 'Recesso': 'recess', 'Feriado Nacional': 'national', 'Feriado Municipal': 'municipal' };
const PAISES = ['BR', 'AR', 'US'];

const FORM_INICIAL = { nome: '', dataInicio: '', dataFim: '', tipo: 'Recesso', escopo: 'rede', pais: 'BR', estado: '', cidade: '', unidadeIds: [] };

export function FeriadosTab() {
  const { userData } = useAuth(); // Pegando dados do Admin para Auditoria
  const { catalogs } = useCatalogs();
  const { t } = useTranslation();
  const userId = userData?.id || userData?.uid;
  // Só o admin cria feriado de verdade. O mentor envia uma PROPOSTA (feriados_propostas) e o admin aprova ou recusa.
  const ehAdmin = String(userData?.role || '').trim().toLowerCase() === 'admin';
  const escoposDisponiveis = ehAdmin ? ESCOPOS_FERIADO : ESCOPOS_DO_MENTOR;

  const [feriados, setFeriados] = useState([]);
  const [propostas, setPropostas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [buscaUnidade, setBuscaUnidade] = useState('');

  const [form, setForm] = useState(ehAdmin ? FORM_INICIAL : { ...FORM_INICIAL, escopo: 'unidades' });
  const formVazio = () => (ehAdmin ? FORM_INICIAL : { ...FORM_INICIAL, escopo: 'unidades' });

  // O mentor só enxerga (e propõe para) as unidades dele.
  const unidades = useMemo(
      () => (catalogs?.unidades || [])
          .filter(u => ehAdmin || u.mentorId === userId)
          .sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
      [catalogs?.unidades, ehAdmin, userId]
  );
  const estadosDisponiveis = useMemo(
      () => [...new Set(unidades.map(u => u.estado).filter(Boolean))].sort(),
      [unidades]
  );

  // ==========================================
  // 0. MOTOR DE AUDITORIA (CÂMERA INVISÍVEL)
  // ==========================================
  const registrarLogAuditoria = async (tipoAcao, descricao, nomeFeriado, detalhes = "") => {
      try {
          const nomeUsuario = userData?.nome || userData?.email || 'Administrador do Sistema';
          await addDoc(collection(db, 'auditoria_cronograma'), {
              tipoAcao,
              descricao: `Calendário: ${descricao}`,
              diffExtras: detalhes,
              modulo: 'CONFIGURACOES',
              unidadeNome: 'Rede Global',
              professorNome: '-',
              modalidadeNome: nomeFeriado || '-',
              usuarioAcaoNome: nomeUsuario,
              usuarioAcaoId: userId,
              dataAcao: serverTimestamp()
          });
      } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
  };

  useEffect(() => { loadFeriados(); loadPropostas(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admin: só as pendentes (as decididas já viraram feriado ou foram recusadas). Mentor: as dele, com o resultado.
  async function loadPropostas() {
    try {
      const q = ehAdmin
        ? query(collection(db, 'feriados_propostas'), where('status', '==', STATUS_PROPOSTA.PENDENTE))
        : query(collection(db, 'feriados_propostas'), where('propostoPor', '==', userId));
      const snap = await getDocs(q);
      setPropostas(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.dataInicio || '').localeCompare(String(a.dataInicio || ''))));
    } catch (e) { console.error('Erro ao carregar propostas de feriado', e); }
  }

  async function loadFeriados() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "feriados"));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                             .sort((a, b) => String(a.dataInicio || '').localeCompare(String(b.dataInicio || '')));
      setFeriados(lista);
    } catch (e) {
      console.error("Erro ao carregar feriados", e);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (date) => (date ? formatarData(date) : "");

  // Texto da abrangência, usado na lista, na confirmação e na auditoria.
  const descreverAbrangencia = (feriado) => {
      const escopo = escopoDoFeriado(feriado);
      const qtdUnidades = (feriado.unidadeIds || (feriado.unidadeId ? [feriado.unidadeId] : [])).length;
      if (escopo === 'pais') return t('holidaysTab.scopeLabel.pais', { value: t(`common.countries.${normalizarPais(feriado.pais)}`) });
      if (escopo === 'estado') return t('holidaysTab.scopeLabel.estado', { value: feriado.estado });
      if (escopo === 'cidade') return t('holidaysTab.scopeLabel.cidade', { value: feriado.cidade, count: qtdUnidades });
      if (escopo === 'unidades') return t('holidaysTab.scopeLabel.unidades', { count: qtdUnidades });
      return t('holidaysTab.scopeLabel.rede');
  };

  // Na abrangência "cidade", sugere as unidades que têm a cidade no cadastro ou no endereço (a pessoa confere e ajusta).
  const sugerirUnidadesDaCidade = (cidade) => {
      const alvo = normalizarTexto(cidade);
      if (alvo.length < 3) return [];
      return unidades
          .filter(u => normalizarTexto(u.cidade) === alvo || normalizarTexto(u.enderecoCompleto).includes(alvo))
          .map(u => String(u.id));
  };

  const alterarEscopo = (escopo) => setForm(prev => ({ ...prev, escopo, estado: '', cidade: '', unidadeIds: [] }));

  const alterarCidade = (cidade) => setForm(prev => ({ ...prev, cidade, unidadeIds: sugerirUnidadesDaCidade(cidade) }));

  const alternarUnidade = (id) => setForm(prev => ({
      ...prev,
      unidadeIds: prev.unidadeIds.includes(id) ? prev.unidadeIds.filter(x => x !== id) : [...prev.unidadeIds, id]
  }));

  const unidadesFiltradas = useMemo(() => {
      const termo = normalizarTexto(buscaUnidade);
      if (!termo) return unidades;
      return unidades.filter(u => normalizarTexto(`${u.nome} ${u.estado || ''} ${u.enderecoCompleto || ''}`).includes(termo));
  }, [unidades, buscaUnidade]);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.nome.trim() || !form.dataInicio || !form.dataFim) return alert(t('holidaysTab.messages.fillRequired'));
    if (form.dataFim < form.dataInicio) return alert(t('holidaysTab.messages.invalidRange'));
    if ((form.escopo === 'estado' && !form.estado) ||
        (form.escopo === 'cidade' && (!form.cidade.trim() || form.unidadeIds.length === 0)) ||
        (form.escopo === 'unidades' && form.unidadeIds.length === 0)) {
        return alert(t('holidaysTab.messages.selectScopeTarget'));
    }

    const novoFeriado = montarFeriado(form);
    const abrangencia = descreverAbrangencia(novoFeriado);

    if (!ehAdmin) return enviarProposta(novoFeriado, abrangencia);

    if (!window.confirm(t('holidaysTab.messages.confirmCreate', { scope: abrangencia, start: formatDate(form.dataInicio), end: formatDate(form.dataFim) }))) {
      return;
    }

    setProcessando(true);
    try {
      // O feriado é calculado na hora por todas as telas (src/utils/feriados.js): não grava mais cancelamentos em massa.
      const feriadoDoc = await addDoc(collection(db, "feriados"), { ...novoFeriado, criadoPor: userId || null, criadoEm: serverTimestamp() });

      await registrarLogAuditoria(
          'NOVA',
          `Novo ${form.tipo} agendado.`,
          form.nome,
          `Período: ${formatDate(form.dataInicio)} até ${formatDate(form.dataFim)} | Abrangência: ${abrangencia}`
      );

      setFeriados(prev => [...prev, { id: feriadoDoc.id, ...novoFeriado }].sort((a, b) => String(a.dataInicio).localeCompare(String(b.dataInicio))));
      setForm(formVazio());
      setBuscaUnidade('');
      alert(t('holidaysTab.messages.created', { scope: abrangencia }));

    } catch (e) {
      console.error(e);
      alert(t('holidaysTab.messages.saveError'));
    } finally {
      setProcessando(false);
    }
  }

  // MENTOR: envia a proposta. Não afeta nenhuma aula até o admin aprovar.
  async function enviarProposta(novoFeriado, abrangencia) {
    if (!window.confirm(t('holidaysTab.proposals.confirmSend', { scope: abrangencia, start: formatDate(form.dataInicio), end: formatDate(form.dataFim) }))) return;
    setProcessando(true);
    try {
      const dados = {
        ...novoFeriado, status: STATUS_PROPOSTA.PENDENTE,
        propostoPor: userId, propostoPorNome: userData?.nome || userData?.email || '', criadoEm: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'feriados_propostas'), dados);
      await registrarLogAuditoria('NOVA', 'Proposta de feriado enviada pelo mentor.', novoFeriado.nome,
        `Período: ${formatDate(form.dataInicio)} até ${formatDate(form.dataFim)} | Abrangência: ${abrangencia}`);
      setPropostas(prev => [{ id: ref.id, ...dados, criadoEm: null }, ...prev]);
      setForm(formVazio());
      setBuscaUnidade('');
      alert(t('holidaysTab.proposals.sent'));
    } catch (e) {
      console.error(e);
      alert(t('holidaysTab.proposals.sendError'));
    } finally { setProcessando(false); }
  }

  // ADMIN: aprovar cria o feriado de verdade e fecha a proposta, tudo numa gravação só.
  async function aprovarProposta(proposta) {
    const abrangencia = descreverAbrangencia(proposta);
    if (!window.confirm(t('holidaysTab.proposals.confirmApprove', { scope: abrangencia, start: formatDate(proposta.dataInicio), end: formatDate(proposta.dataFim), name: proposta.nome }))) return;
    setProcessando(true);
    try {
      const feriado = { ...feriadoDaProposta(proposta), criadoPor: userId || null, criadoEm: serverTimestamp() };
      const lote = writeBatch(db);
      const feriadoRef = doc(collection(db, 'feriados'));
      lote.set(feriadoRef, feriado);
      lote.update(doc(db, 'feriados_propostas', proposta.id), {
        status: STATUS_PROPOSTA.APROVADA, decididoPor: userId || null, decididoEm: serverTimestamp(), feriadoId: feriadoRef.id,
      });
      await lote.commit();
      await registrarLogAuditoria('NOVA', `Proposta de feriado aprovada (de ${proposta.propostoPorNome || 'mentor'}).`, proposta.nome,
        `Período: ${formatDate(proposta.dataInicio)} até ${formatDate(proposta.dataFim)} | Abrangência: ${abrangencia}`);
      setPropostas(prev => prev.filter(p => p.id !== proposta.id));
      setFeriados(prev => [...prev, { id: feriadoRef.id, ...feriado, criadoEm: null }].sort((a, b) => String(a.dataInicio).localeCompare(String(b.dataInicio))));
      alert(t('holidaysTab.proposals.approvedMsg', { scope: abrangencia }));
    } catch (e) {
      console.error(e);
      alert(t('holidaysTab.proposals.decideError'));
    } finally { setProcessando(false); }
  }

  async function recusarProposta(proposta) {
    const motivo = window.prompt(t('holidaysTab.proposals.refuseReason', { name: proposta.nome }));
    if (motivo === null) return; // desistiu de recusar
    setProcessando(true);
    try {
      await updateDoc(doc(db, 'feriados_propostas', proposta.id), {
        status: STATUS_PROPOSTA.RECUSADA, motivoRecusa: motivo.trim(), decididoPor: userId || null, decididoEm: serverTimestamp(),
      });
      await registrarLogAuditoria('EXCLUÍDA', `Proposta de feriado recusada (de ${proposta.propostoPorNome || 'mentor'}).`, proposta.nome, motivo.trim() || '-');
      setPropostas(prev => prev.filter(p => p.id !== proposta.id));
    } catch (e) {
      console.error(e);
      alert(t('holidaysTab.proposals.decideError'));
    } finally { setProcessando(false); }
  }

  // MENTOR: desiste de uma proposta que ainda está pendente.
  async function desistirDaProposta(proposta) {
    if (!window.confirm(t('holidaysTab.proposals.confirmWithdraw', { name: proposta.nome }))) return;
    try {
      await deleteDoc(doc(db, 'feriados_propostas', proposta.id));
      setPropostas(prev => prev.filter(p => p.id !== proposta.id));
    } catch (e) {
      console.error(e);
      alert(t('holidaysTab.proposals.decideError'));
    }
  }

  async function handleDelete(feriado) {
    if (!ehAdmin) return;
    if (!window.confirm(t('holidaysTab.messages.confirmDelete', { name: feriado.nome }))) return;

    try {
      // Feriados antigos gravavam um "cancelamento" por aula no banco. Ao excluir o feriado, apaga só esses
      // cancelamentos automáticos dele; validações feitas por pessoas nunca são apagadas.
      const snap = await getDocs(query(collection(db, 'validacoes'), where('feriadoId', '==', feriado.id)));
      const automaticos = snap.docs.filter(d => ehCancelamentoAutomaticoDeFeriado(d.data()));
      for (let i = 0; i < automaticos.length; i += 450) {
          const batch = writeBatch(db);
          automaticos.slice(i, i + 450).forEach(d => batch.delete(d.ref));
          await batch.commit();
      }

      await deleteDoc(doc(db, "feriados", feriado.id));

      // 🟢 AUDITORIA
      await registrarLogAuditoria('EXCLUÍDA', 'Evento removido do calendário.', feriado.nome, `O recesso/feriado foi deletado do sistema. Cancelamentos automáticos removidos: ${automaticos.length}`);

      setFeriados(prev => prev.filter(f => f.id !== feriado.id));
    } catch (e) {
      console.error(e);
      alert(t('holidaysTab.messages.deleteError'));
    }
  }

  const inputClass = "w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500";
  const labelClass = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block";

  return (
    <div className="p-6 animate-fade-in space-y-8">

      <CabecalhoDaAba abaId="feriados" icone={CalendarDays} titulo={t('settingsPage.tabs.feriados', 'Feriados')} subtitulo={ehAdmin ? t('holidaysTab.desc') : t('holidaysTab.proposals.mentorDesc')} />

      {/* CARD DE CADASTRO */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-pink-600"></div>
        <div className="flex items-center gap-2 mb-6">
          <CalendarDays className="w-6 h-6 text-pink-600" />
          <h3 className="font-bold text-slate-700 dark:text-white uppercase text-sm">{ehAdmin ? t('holidaysTab.title') : t('holidaysTab.proposals.formTitle')}</h3>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="flex flex-col xl:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className={labelClass}>{t('holidaysTab.eventName')}</label>
              <input className={inputClass} value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder={t('holidaysTab.eventPlaceholder')} />
            </div>

            <div className="w-full xl:w-40">
              <label className={labelClass}>{t('holidaysTab.startDate')}</label>
              <input type="date" className={`${inputClass} text-slate-600`} value={form.dataInicio} onChange={e => setForm({...form, dataInicio: e.target.value, dataFim: form.dataFim || e.target.value})} />
            </div>

            <div className="w-full xl:w-40">
              <label className={labelClass}>{t('holidaysTab.endDate')}</label>
              <input type="date" className={`${inputClass} text-slate-600`} min={form.dataInicio || undefined} value={form.dataFim} onChange={e => setForm({...form, dataFim: e.target.value})} />
            </div>

            <div className="w-full xl:w-44">
              <label className={labelClass}>{t('holidaysTab.type')}</label>
              <select className={inputClass} value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                <option value="Recesso">{t('holidaysTab.types.recess')}</option>
                <option value="Feriado Nacional">{t('holidaysTab.types.national')}</option>
                <option value="Feriado Municipal">{t('holidaysTab.types.municipal')}</option>
              </select>
            </div>
          </div>

          {/* 🟢 ABRANGÊNCIA */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-4">
            <div>
              <label className={`${labelClass} flex items-center gap-1`}><MapPin className="w-3.5 h-3.5"/> {t('holidaysTab.scope')}</label>
              <div className="flex flex-wrap gap-2">
                {escoposDisponiveis.map(escopo => (
                  <button
                    key={escopo}
                    type="button"
                    onClick={() => alterarEscopo(escopo)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase border transition-colors ${form.escopo === escopo ? 'bg-pink-600 text-white border-pink-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-pink-300'}`}
                  >
                    {t(`holidaysTab.scopes.${escopo}`)}
                  </button>
                ))}
              </div>
            </div>

            {form.escopo === 'pais' && (
              <div className="w-full md:w-64">
                <label className={labelClass}>{t('holidaysTab.country')}</label>
                <select className={inputClass} value={form.pais} onChange={e => setForm({...form, pais: e.target.value})}>
                  {PAISES.map(p => <option key={p} value={p}>{t(`common.countries.${p}`)}</option>)}
                </select>
              </div>
            )}

            {form.escopo === 'estado' && (
              <div className="w-full md:w-64">
                <label className={labelClass}>{t('holidaysTab.state')}</label>
                <select className={inputClass} value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                  <option value="">{t('common.actions.select')}</option>
                  {estadosDisponiveis.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            )}

            {form.escopo === 'cidade' && (
              <div className="w-full md:w-80">
                <label className={labelClass}>{t('holidaysTab.city')}</label>
                <input className={inputClass} value={form.cidade} onChange={e => alterarCidade(e.target.value)} placeholder={t('holidaysTab.cityPlaceholder')} />
                <p className="text-[11px] text-slate-400 mt-1.5">{t('holidaysTab.cityHint')}</p>
              </div>
            )}

            {(form.escopo === 'cidade' || form.escopo === 'unidades') && (
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className={`${labelClass} mb-0`}>{t('holidaysTab.units')}</label>
                  <span className="text-xs font-bold text-pink-600">{t('holidaysTab.selectedUnits', { count: form.unidadeIds.length })}</span>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                  <input className={`${inputClass} pl-9`} value={buscaUnidade} onChange={e => setBuscaUnidade(e.target.value)} placeholder={t('holidaysTab.searchUnits')} />
                </div>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                  {unidadesFiltradas.map(u => {
                    const marcada = form.unidadeIds.includes(String(u.id));
                    return (
                      <button key={u.id} type="button" onClick={() => alternarUnidade(String(u.id))} className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${marcada ? 'bg-pink-50 dark:bg-pink-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}>
                        {marcada ? <CheckSquare className="w-4 h-4 text-pink-600 shrink-0 mt-0.5"/> : <Square className="w-4 h-4 text-slate-300 shrink-0 mt-0.5"/>}
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{u.nome}</span>
                          <span className="block text-[11px] text-slate-400 truncate">{[u.estado, u.enderecoCompleto].filter(Boolean).join(' · ')}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button disabled={processando} className="w-full xl:w-auto px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {processando ? t('holidaysTab.processing') : (ehAdmin ? t('holidaysTab.create') : t('holidaysTab.proposals.send'))}
            </button>
          </div>
        </form>
      </div>

      {/* PROPOSTAS: o admin decide as pendentes; o mentor acompanha as dele */}
      {(ehAdmin ? propostas.length > 0 : true) && (
        <div>
          <h4 className="font-bold text-slate-700 dark:text-white text-sm uppercase mb-4 pl-1 flex items-center gap-2">
            <Inbox className="w-4 h-4"/> {ehAdmin ? t('holidaysTab.proposals.pendingTitle', { count: propostas.length }) : t('holidaysTab.proposals.mineTitle')}
          </h4>
          {propostas.length === 0 ? (
            <p className="text-sm text-slate-400 pl-1">{t('holidaysTab.proposals.none')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {propostas.map(p => (
                <div key={p.id} className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/50 rounded-xl p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${p.status === STATUS_PROPOSTA.APROVADA ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : p.status === STATUS_PROPOSTA.RECUSADA ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                      {t(`holidaysTab.proposals.status.${p.status || 'pendente'}`)}
                    </span>
                    <span className="px-2 py-1 text-[10px] font-bold uppercase rounded border bg-slate-50 text-slate-600 border-slate-200 flex items-center gap-1">
                      <MapPin className="w-3 h-3"/> {descreverAbrangencia(p)}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-lg mb-1">{p.nome}</h4>
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4"/> {t('holidaysTab.range', { start: formatDate(p.dataInicio), end: formatDate(p.dataFim) })}
                  </div>
                  {ehAdmin && <p className="text-xs text-slate-400 mt-2">{t('holidaysTab.proposals.by', { name: p.propostoPorNome || '-' })}</p>}
                  {p.status === STATUS_PROPOSTA.RECUSADA && p.motivoRecusa && <p className="text-xs text-rose-600 mt-2">{t('holidaysTab.proposals.reason', { reason: p.motivoRecusa })}</p>}
                  {(ehAdmin || p.status === STATUS_PROPOSTA.PENDENTE) && (
                    <div className="flex gap-2 mt-4">
                      {ehAdmin ? (
                        <>
                          <button disabled={processando} onClick={() => aprovarProposta(p)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 disabled:opacity-50"><Check className="w-4 h-4"/> {t('holidaysTab.proposals.approve')}</button>
                          <button disabled={processando} onClick={() => recusarProposta(p)} className="flex-1 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 disabled:opacity-50"><X className="w-4 h-4"/> {t('holidaysTab.proposals.refuse')}</button>
                        </>
                      ) : (
                        <button onClick={() => desistirDaProposta(p)} className="py-2 px-3 text-slate-500 hover:text-rose-600 text-xs font-bold uppercase underline">{t('holidaysTab.proposals.withdraw')}</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LISTA DE FERIADOS */}
      <div>
        <h4 className="font-bold text-slate-700 dark:text-white text-sm uppercase mb-4 pl-1 flex items-center gap-2">
            <Calendar className="w-4 h-4"/> {t('holidaysTab.calendar')}
        </h4>

        {loading ? (
            <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400"/></div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feriados.map(f => (
                <div key={f.id} className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-md transition-all relative">
                <div className="flex justify-between items-start">
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${String(f.tipo || '').includes('Feriado') ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                        {TIPOS_FERIADO[f.tipo] ? t(`holidaysTab.types.${TIPOS_FERIADO[f.tipo]}`) : f.tipo}
                        </span>
                        <span className="px-2 py-1 text-[10px] font-bold uppercase rounded border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700 flex items-center gap-1">
                          <MapPin className="w-3 h-3"/> {descreverAbrangencia(f)}
                        </span>
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-lg mb-1">{f.nome}</h4>
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4"/>
                        {t('holidaysTab.range', { start: formatDate(f.dataInicio), end: formatDate(f.dataFim) })}
                    </div>
                    </div>
                    {ehAdmin && <BotaoDeLinha abaId="feriados" tipo="perigo" icone={Trash2} onClick={() => handleDelete(f)} />}
                </div>
                </div>
            ))}
            {feriados.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                {t('holidaysTab.none')}
                </div>
            )}
            </div>
        )}
      </div>
    </div>
  );
}
