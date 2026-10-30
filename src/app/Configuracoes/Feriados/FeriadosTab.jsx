import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { useAuth } from "../../../contexts/AuthContext"; // Importado para Auditoria
import { useCatalogs } from '../../../contexts/CatalogContext';
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  writeBatch, query, where, serverTimestamp
} from 'firebase/firestore';
import { Calendar, Plus, Trash2, Loader2, CalendarDays, MapPin, Search, CheckSquare, Square } from 'lucide-react';
import { formatDate as formatarData } from '../../../utils/formatters';
import { ESCOPOS_FERIADO, escopoDoFeriado, normalizarPais, normalizarTexto, ehCancelamentoAutomaticoDeFeriado } from '../../../utils/feriados';
import { useTranslation } from 'react-i18next';

// Tipo gravado no banco (português) -> chave de tradução.
const TIPOS_FERIADO = { 'Recesso': 'recess', 'Feriado Nacional': 'national', 'Feriado Municipal': 'municipal' };
const PAISES = ['BR', 'AR', 'US'];

const FORM_INICIAL = { nome: '', dataInicio: '', dataFim: '', tipo: 'Recesso', escopo: 'rede', pais: 'BR', estado: '', cidade: '', unidadeIds: [] };

export function FeriadosTab() {
  const { userData } = useAuth(); // Pegando dados do Admin para Auditoria
  const { catalogs } = useCatalogs();
  const { t } = useTranslation();
  const userId = userData?.id || userData?.uid;

  const [feriados, setFeriados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [buscaUnidade, setBuscaUnidade] = useState('');

  const [form, setForm] = useState(FORM_INICIAL);

  const unidades = useMemo(
      () => [...(catalogs?.unidades || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
      [catalogs?.unidades]
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

  useEffect(() => { loadFeriados(); }, []);

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

  // Só grava os campos que fazem sentido para a abrangência escolhida.
  const montarFeriado = () => {
      const base = { nome: form.nome.trim(), dataInicio: form.dataInicio, dataFim: form.dataFim, tipo: form.tipo, escopo: form.escopo };
      if (form.escopo === 'pais') return { ...base, pais: form.pais };
      if (form.escopo === 'estado') return { ...base, estado: form.estado };
      if (form.escopo === 'cidade') return { ...base, cidade: form.cidade.trim(), unidadeIds: form.unidadeIds };
      if (form.escopo === 'unidades') return { ...base, unidadeIds: form.unidadeIds };
      return base;
  };

  async function handleSave(e) {
    e.preventDefault();
    if (!form.nome.trim() || !form.dataInicio || !form.dataFim) return alert(t('holidaysTab.messages.fillRequired'));
    if (form.dataFim < form.dataInicio) return alert(t('holidaysTab.messages.invalidRange'));
    if ((form.escopo === 'estado' && !form.estado) ||
        (form.escopo === 'cidade' && (!form.cidade.trim() || form.unidadeIds.length === 0)) ||
        (form.escopo === 'unidades' && form.unidadeIds.length === 0)) {
        return alert(t('holidaysTab.messages.selectScopeTarget'));
    }

    const novoFeriado = montarFeriado();
    const abrangencia = descreverAbrangencia(novoFeriado);

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
      setForm(FORM_INICIAL);
      setBuscaUnidade('');
      alert(t('holidaysTab.messages.created', { scope: abrangencia }));

    } catch (e) {
      console.error(e);
      alert(t('holidaysTab.messages.saveError'));
    } finally {
      setProcessando(false);
    }
  }

  async function handleDelete(feriado) {
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

  const inputClass = "w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500";
  const labelClass = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block";

  return (
    <div className="p-6 animate-fade-in space-y-8">

      {/* CARD DE CADASTRO */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-red-600"></div>
        <div className="flex items-center gap-2 mb-6">
          <CalendarDays className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-bold text-slate-700 dark:text-white uppercase text-sm">{t('holidaysTab.title')}</h3>
            <p className="text-xs text-slate-400">{t('holidaysTab.desc')}</p>
          </div>
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
                {ESCOPOS_FERIADO.map(escopo => (
                  <button
                    key={escopo}
                    type="button"
                    onClick={() => alterarEscopo(escopo)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase border transition-colors ${form.escopo === escopo ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-red-300'}`}
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
                  <span className="text-xs font-bold text-red-600">{t('holidaysTab.selectedUnits', { count: form.unidadeIds.length })}</span>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                  <input className={`${inputClass} pl-9`} value={buscaUnidade} onChange={e => setBuscaUnidade(e.target.value)} placeholder={t('holidaysTab.searchUnits')} />
                </div>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                  {unidadesFiltradas.map(u => {
                    const marcada = form.unidadeIds.includes(String(u.id));
                    return (
                      <button key={u.id} type="button" onClick={() => alternarUnidade(String(u.id))} className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${marcada ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}>
                        {marcada ? <CheckSquare className="w-4 h-4 text-red-600 shrink-0 mt-0.5"/> : <Square className="w-4 h-4 text-slate-300 shrink-0 mt-0.5"/>}
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
            <button disabled={processando} className="w-full xl:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {processando ? t('holidaysTab.processing') : t('holidaysTab.create')}
            </button>
          </div>
        </form>
      </div>

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
                    <button onClick={() => handleDelete(f)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                    </button>
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
