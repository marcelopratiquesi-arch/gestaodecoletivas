import { ehDoMeuEscopo } from "../../../permissions.js";
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { useAuth } from "../../../contexts/AuthContext"; // Importado para Auditoria
import { useCatalogs } from '../../../contexts/CatalogContext';
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc, deleteField,
  writeBatch, query, where, serverTimestamp
} from 'firebase/firestore';
import { Calendar, Plus, Trash2, Loader2, CalendarDays, MapPin, Search, CheckSquare, Square, Check, X, Inbox, Pencil, RefreshCw, Hammer } from 'lucide-react';
import { formatDate as formatarData } from '../../../utils/formatters';
import { publicarReforma, removerReformaDaVitrine } from '../../../services/vitrinePublica';
import { ESCOPOS_FERIADO, escopoDoFeriado, normalizarPais, normalizarTexto, ehCancelamentoAutomaticoDeFeriado, feriadoAplicaNaUnidade, unidadesDeExcecao, TIPO_REFORMA, ehReforma, reformaEmAndamento } from '../../../utils/feriados';
import { impactoDoFeriado, comecaNoPassado, feriadosParecidos } from '../../../utils/feriadosImpacto';
import { montarFeriado, feriadoDaProposta, ESCOPOS_DO_MENTOR, STATUS_PROPOSTA, CAMPOS_DE_ABRANGENCIA } from '../../../utils/feriadosProposta';
import { useTranslation } from 'react-i18next';
import { FeriadosSugeridos } from './FeriadosSugeridos';
import { dataLocalStr } from '../../../utils/agendaAulas';
import { CabecalhoDaAba } from '../ui/CabecalhoDaAba';
import { BotaoDeLinha } from '../ui/BotaoDeLinha';

// Tipo gravado no banco (português) -> chave de tradução.
const TIPOS_FERIADO = { 'Recesso': 'recess', 'Feriado Nacional': 'national', 'Feriado Municipal': 'municipal', [TIPO_REFORMA]: 'renovation' };
const PAISES = ['BR', 'AR', 'US'];

const FORM_INICIAL = { nome: '', dataInicio: '', dataFim: '', tipo: 'Recesso', escopo: 'rede', pais: 'BR', estado: '', cidade: '', unidadeIds: [], unidadesExcecao: [] };

export function FeriadosTab() {
  const { userData } = useAuth(); // Pegando dados do Admin para Auditoria
  const { catalogs, loadingCatalogs } = useCatalogs();
  const { t } = useTranslation();
  const userId = userData?.id || userData?.uid;
  // Só o admin cria feriado de verdade. O mentor envia uma PROPOSTA (feriados_propostas) e o admin aprova ou recusa.
  const ehAdmin = String(userData?.role || '').trim().toLowerCase() === 'admin';
  const escoposDisponiveis = ehAdmin ? ESCOPOS_FERIADO : ESCOPOS_DO_MENTOR;

  // Os feriados vêm do catálogo global, que já é atualizado ao vivo: criar, editar ou apagar aparece sozinho (sem reler o banco).
  const feriados = useMemo(
      () => [...(catalogs?.feriados || [])].sort((a, b) => String(a.dataInicio || '').localeCompare(String(b.dataInicio || ''))),
      [catalogs?.feriados]
  );
  const loading = loadingCatalogs;
  const [propostas, setPropostas] = useState([]);
  // Filtros da lista
  const [filtroPeriodo, setFiltroPeriodo] = useState('proximos'); // proximos | passados | todos
  const [filtroAno, setFiltroAno] = useState('');
  const [filtroEscopo, setFiltroEscopo] = useState('');
  const [buscaLista, setBuscaLista] = useState('');
  const [soReformaAgora, setSoReformaAgora] = useState(false); // só as unidades fechadas para reforma hoje
  const [processando, setProcessando] = useState(false);
  const [buscaUnidade, setBuscaUnidade] = useState('');
  const [buscaExcecao, setBuscaExcecao] = useState('');
  const [editandoId, setEditandoId] = useState(null); // feriado que está sendo editado (admin)

  const [form, setForm] = useState(ehAdmin ? FORM_INICIAL : { ...FORM_INICIAL, escopo: 'unidades' });
  const formVazio = () => (ehAdmin ? FORM_INICIAL : { ...FORM_INICIAL, escopo: 'unidades' });

  // O mentor só enxerga (e propõe para) as unidades dele.
  const unidades = useMemo(
      () => (catalogs?.unidades || [])
          .filter(u => ehAdmin || ehDoMeuEscopo(userData, u.mentorId))
          .sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
      [catalogs?.unidades, ehAdmin, userData]
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

  useEffect(() => { loadPropostas(); // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const formatDate = (date) => (date ? formatarData(date) : "");

  // Texto da abrangência, usado na lista, na confirmação e na auditoria.
  const descreverAbrangencia = (feriado) => {
      const escopo = escopoDoFeriado(feriado);
      const qtdUnidades = (feriado.unidadeIds || (feriado.unidadeId ? [feriado.unidadeId] : [])).length;
      let texto;
      if (escopo === 'pais') texto = t('holidaysTab.scopeLabel.pais', { value: t(`common.countries.${normalizarPais(feriado.pais)}`) });
      else if (escopo === 'estado') texto = t('holidaysTab.scopeLabel.estado', { value: feriado.estado });
      else if (escopo === 'cidade') texto = t('holidaysTab.scopeLabel.cidade', { value: feriado.cidade, count: qtdUnidades });
      else if (escopo === 'unidades') texto = t('holidaysTab.scopeLabel.unidades', { count: qtdUnidades });
      else texto = t('holidaysTab.scopeLabel.rede');
      const excecoes = unidadesDeExcecao(feriado).length;
      return excecoes > 0 ? `${texto} · ${t('holidaysTab.except.label', { count: excecoes })}` : texto;
  };

  // Na abrangência "cidade", sugere as unidades que têm a cidade no cadastro ou no endereço (a pessoa confere e ajusta).
  const sugerirUnidadesDaCidade = (cidade) => {
      const alvo = normalizarTexto(cidade);
      if (alvo.length < 3) return [];
      return unidades
          .filter(u => (u.cidade ? normalizarTexto(u.cidade) === alvo : normalizarTexto(u.enderecoCompleto).includes(alvo)))
          .map(u => String(u.id));
  };

  // ADMIN: unidade nova na mesma cidade não entra sozinha no feriado de cidade; este botão acrescenta as que faltam.
  async function atualizarUnidadesDaCidade(feriado) {
      const atuais = (feriado.unidadeIds || []).map(String);
      const fora = unidadesDeExcecao(feriado);
      const faltam = sugerirUnidadesDaCidade(feriado.cidade).filter(id => !atuais.includes(id) && !fora.includes(id));
      if (faltam.length === 0) return alert(t('holidaysTab.cityActions.upToDate'));
      const nomes = faltam.map(id => unidades.find(u => String(u.id) === id)?.nome || id);
      if (!window.confirm(t('holidaysTab.cityActions.confirmAdd', { city: feriado.cidade, count: faltam.length, names: nomes.slice(0, 8).join(', ') }))) return;
      try {
          await updateDoc(doc(db, 'feriados', feriado.id), { unidadeIds: [...atuais, ...faltam], atualizadoPor: userId || null, atualizadoEm: serverTimestamp() });
          await registrarLogAuditoria('ALTERADA', 'Unidades da cidade atualizadas no feriado.', feriado.nome, `Cidade: ${feriado.cidade} | Acrescentadas: ${nomes.join(', ')}`);
          alert(t('holidaysTab.cityActions.done', { count: faltam.length }));
      } catch (e) {
          console.error(e);
          alert(t('holidaysTab.edit.error'));
      }
  }

  // Reforma só vale para unidades escolhidas (nunca rede, país, estado ou cidade inteiros).
  const alterarTipo = (tipo) => setForm(prev => (tipo === TIPO_REFORMA
      ? { ...prev, tipo, escopo: 'unidades', estado: '', cidade: '', unidadesExcecao: [], nome: prev.nome || 'Reforma' }
      : { ...prev, tipo }));
  const alterarEscopo = (escopo) => setForm(prev => ({ ...prev, escopo, estado: '', cidade: '', unidadeIds: [], unidadesExcecao: [] }));

  const alterarCidade = (cidade) => setForm(prev => ({ ...prev, cidade, unidadeIds: sugerirUnidadesDaCidade(cidade) }));

  const alternarUnidade = (id) => setForm(prev => ({
      ...prev,
      unidadeIds: prev.unidadeIds.includes(id) ? prev.unidadeIds.filter(x => x !== id) : [...prev.unidadeIds, id]
  }));

  // "Exceto estas unidades": só em rede, país e estado, e só entre as unidades que o feriado alcançaria.
  const aceitaExcecao = ehAdmin && ['rede', 'pais', 'estado'].includes(form.escopo);
  const unidadesDoAlcance = useMemo(() => {
      if (!aceitaExcecao || (form.escopo === 'estado' && !form.estado)) return [];
      const alvo = { escopo: form.escopo, pais: form.pais, estado: form.estado };
      const termo = normalizarTexto(buscaExcecao);
      return unidades
          .filter(u => feriadoAplicaNaUnidade(alvo, u))
          .filter(u => !termo || normalizarTexto(`${u.nome} ${u.estado || ''}`).includes(termo));
  }, [aceitaExcecao, form.escopo, form.pais, form.estado, unidades, buscaExcecao]);

  const alternarExcecao = (id) => setForm(prev => ({
      ...prev,
      unidadesExcecao: prev.unidadesExcecao.includes(id) ? prev.unidadesExcecao.filter(x => x !== id) : [...prev.unidadesExcecao, id]
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

    // Avisos antes de confirmar: quanto afeta, data que já passou e feriado parecido já cadastrado.
    const impacto = impactoDoFeriado({ feriado: novoFeriado, unidades: catalogs?.unidades || [], aulas: catalogs?.aulas || [] });
    const parecidos = feriadosParecidos(feriados, novoFeriado, catalogs?.unidades || [], editandoId);
    const avisos = [
        t('holidaysTab.impact', { units: impacto.unidades, classes: impacto.aulas }),
        comecaNoPassado(novoFeriado) ? t('holidaysTab.pastWarn') : null,
        parecidos.length > 0 ? t('holidaysTab.duplicateWarn', { names: parecidos.slice(0, 3).map(p => p.nome).join(', ') }) : null,
    ].filter(Boolean).join('\n\n');
    const pergunta = editandoId
        ? t('holidaysTab.edit.confirmSave', { name: novoFeriado.nome, scope: abrangencia, start: formatDate(form.dataInicio), end: formatDate(form.dataFim) })
        : t('holidaysTab.messages.confirmCreate', { scope: abrangencia, start: formatDate(form.dataInicio), end: formatDate(form.dataFim) });
    if (!window.confirm(`${pergunta}\n\n${avisos}`)) return;

    setProcessando(true);
    try {
      if (editandoId) {
        const antigo = feriados.find(x => x.id === editandoId) || {};
        // Campos de abrangência que não servem mais (ex.: trocou de estado para país) saem do documento.
        const limpar = Object.fromEntries(CAMPOS_DE_ABRANGENCIA.filter(c => !(c in novoFeriado)).map(c => [c, deleteField()]));
        await updateDoc(doc(db, 'feriados', editandoId), { ...novoFeriado, ...limpar, atualizadoPor: userId || null, atualizadoEm: serverTimestamp() });
        // Página pública: reforma editada atualiza o aviso; se deixou de ser reforma, tira o aviso.
        if (ehReforma(novoFeriado)) await publicarReforma(editandoId, novoFeriado);
        else if (ehReforma(antigo)) await removerReformaDaVitrine(editandoId);
        await registrarLogAuditoria('ALTERADA', `${form.tipo} editado.`, form.nome,
            `De: ${formatDate(antigo.dataInicio)} até ${formatDate(antigo.dataFim)} | ${descreverAbrangencia(antigo)}  ➔  Para: ${formatDate(form.dataInicio)} até ${formatDate(form.dataFim)} | ${abrangencia}`);
        setEditandoId(null);
        setForm(formVazio());
        setBuscaUnidade(''); setBuscaExcecao('');
        alert(t('holidaysTab.edit.saved'));
        return;
      }

      // O feriado é calculado na hora por todas as telas (src/utils/feriados.js): não grava mais cancelamentos em massa.
      const feriadoCriado = await addDoc(collection(db, "feriados"), { ...novoFeriado, criadoPor: userId || null, criadoEm: serverTimestamp() });
      // Página pública: unidade em reforma ganha o aviso "fechada para reforma" em /horarios.
      if (ehReforma(novoFeriado)) await publicarReforma(feriadoCriado.id, novoFeriado);

      await registrarLogAuditoria(
          'NOVA',
          `Novo ${form.tipo} agendado.`,
          form.nome,
          `Período: ${formatDate(form.dataInicio)} até ${formatDate(form.dataFim)} | Abrangência: ${abrangencia}`
      );

      setForm(formVazio());
      setBuscaUnidade(''); setBuscaExcecao('');
      alert(t('holidaysTab.messages.created', { scope: abrangencia }));

    } catch (e) {
      console.error(e);
      alert(editandoId ? t('holidaysTab.edit.error') : t('holidaysTab.messages.saveError'));
    } finally {
      setProcessando(false);
    }
  }

  // ADMIN: carrega o feriado no formulário para editar.
  function iniciarEdicao(feriado) {
    setEditandoId(feriado.id);
    setForm({
      nome: feriado.nome || '', dataInicio: feriado.dataInicio || '', dataFim: feriado.dataFim || feriado.dataInicio || '',
      tipo: feriado.tipo || 'Recesso', escopo: escopoDoFeriado(feriado), pais: feriado.pais || 'BR', estado: feriado.estado || '',
      cidade: feriado.cidade || '',
      unidadeIds: (feriado.unidadeIds || (feriado.unidadeId ? [feriado.unidadeId] : [])).map(String),
      unidadesExcecao: unidadesDeExcecao(feriado),
    });
    setBuscaUnidade(''); setBuscaExcecao('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(formVazio());
    setBuscaUnidade(''); setBuscaExcecao('');
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
      if (ehReforma(feriado)) await publicarReforma(feriadoRef.id, feriado);
      await registrarLogAuditoria('NOVA', `Proposta de feriado aprovada (de ${proposta.propostoPorNome || 'mentor'}).`, proposta.nome,
        `Período: ${formatDate(proposta.dataInicio)} até ${formatDate(proposta.dataFim)} | Abrangência: ${abrangencia}`);
      setPropostas(prev => prev.filter(p => p.id !== proposta.id));
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
      if (ehReforma(feriado)) await removerReformaDaVitrine(feriado.id);

      // 🟢 AUDITORIA
      await registrarLogAuditoria('EXCLUÍDA', 'Evento removido do calendário.', feriado.nome, `O recesso/feriado foi deletado do sistema. Cancelamentos automáticos removidos: ${automaticos.length}`);

      if (editandoId === feriado.id) cancelarEdicao();
    } catch (e) {
      console.error(e);
      alert(t('holidaysTab.messages.deleteError'));
    }
  }

  const hojeStr = dataLocalStr();
  const contagem = useMemo(() => ({
      proximos: feriados.filter(f => (f.dataFim || f.dataInicio) >= hojeStr).length,
      passados: feriados.filter(f => (f.dataFim || f.dataInicio) < hojeStr).length,
      todos: feriados.length,
      reformaAgora: feriados.filter(f => reformaEmAndamento(f, hojeStr)).length,
  }), [feriados, hojeStr]);
  const anosDosFeriados = useMemo(
      () => [...new Set(feriados.map(f => String(f.dataInicio || '').slice(0, 4)).filter(a => /^\d{4}$/.test(a)))].sort().reverse(),
      [feriados]
  );
  const feriadosVisiveis = useMemo(() => {
      const termo = normalizarTexto(buscaLista);
      const lista = feriados.filter(f => {
          const fim = f.dataFim || f.dataInicio || '';
          if (soReformaAgora) { if (!reformaEmAndamento(f, hojeStr)) return false; }
          else if (filtroPeriodo === 'proximos' && fim < hojeStr) return false;
          else if (filtroPeriodo === 'passados' && fim >= hojeStr) return false;
          if (filtroAno && String(f.dataInicio || '').slice(0, 4) !== filtroAno) return false;
          if (filtroEscopo && escopoDoFeriado(f) !== filtroEscopo) return false;
          return !termo || normalizarTexto(f.nome).includes(termo);
      });
      return filtroPeriodo === 'passados' ? [...lista].reverse() : lista; // passados: o mais recente primeiro
  }, [feriados, filtroPeriodo, filtroAno, filtroEscopo, buscaLista, hojeStr, soReformaAgora]);

  // Nomes das unidades de uma reforma (3 primeiras + quantas mais).
  const nomesDasUnidades = (f) => {
      const todas = catalogs?.unidades || [];
      const nomes = (f.unidadeIds || []).map(id => todas.find(u => String(u.id) === String(id))?.nome).filter(Boolean);
      return nomes.length > 3 ? `${nomes.slice(0, 3).join(', ')} +${nomes.length - 3}` : nomes.join(', ');
  };

  const inputClass = "w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500";
  const labelClass = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block";

  return (
    <div className="p-6 animate-fade-in space-y-8">

      <CabecalhoDaAba abaId="feriados" icone={CalendarDays} titulo={t('settingsPage.tabs.feriados', 'Feriados')} subtitulo={ehAdmin ? t('holidaysTab.desc') : t('holidaysTab.proposals.mentorDesc')} />

      {/* CARD DE CADASTRO */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-red-600"></div>
        <div className="flex items-center gap-2 mb-6">
          <CalendarDays className="w-6 h-6 text-red-600" />
          <h3 className="font-bold text-slate-700 dark:text-white uppercase text-sm">{editandoId ? t('holidaysTab.edit.title') : (ehAdmin ? t('holidaysTab.title') : t('holidaysTab.proposals.formTitle'))}</h3>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="flex flex-col xl:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className={labelClass}>{form.tipo === TIPO_REFORMA ? t('holidaysTab.renovation.nameLabel') : t('holidaysTab.eventName')}</label>
              <input className={inputClass} value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder={form.tipo === TIPO_REFORMA ? t('holidaysTab.renovation.namePlaceholder') : t('holidaysTab.eventPlaceholder')} />
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
              <select className={inputClass} value={form.tipo} onChange={e => alterarTipo(e.target.value)}>
                <option value="Recesso">{t('holidaysTab.types.recess')}</option>
                <option value="Feriado Nacional">{t('holidaysTab.types.national')}</option>
                <option value="Feriado Municipal">{t('holidaysTab.types.municipal')}</option>
                <option value={TIPO_REFORMA}>{t('holidaysTab.types.renovation')}</option>
              </select>
            </div>
          </div>

          {/* 🟢 ABRANGÊNCIA */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-4">
            {form.tipo === TIPO_REFORMA ? (
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 flex items-start gap-2"><Hammer className="w-4 h-4 shrink-0 mt-0.5"/> {t('holidaysTab.renovation.scopeNote')}</p>
            ) : (
              <div>
                <label className={`${labelClass} flex items-center gap-1`}><MapPin className="w-3.5 h-3.5"/> {t('holidaysTab.scope')}</label>
                <div className="flex flex-wrap gap-2">
                  {escoposDisponiveis.map(escopo => (
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
            )}

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

            {aceitaExcecao && unidadesDoAlcance.length + form.unidadesExcecao.length > 0 && (
              <div>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <label className={`${labelClass} mb-0`}>{t('holidaysTab.except.title')}</label>
                  <span className="text-xs font-bold text-red-600">{t('holidaysTab.except.label', { count: form.unidadesExcecao.length })}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">{t('holidaysTab.except.hint')}</p>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                  <input className={`${inputClass} pl-9`} value={buscaExcecao} onChange={e => setBuscaExcecao(e.target.value)} placeholder={t('holidaysTab.searchUnits')} />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                  {unidadesDoAlcance.map(u => {
                    const marcada = form.unidadesExcecao.includes(String(u.id));
                    return (
                      <button key={u.id} type="button" onClick={() => alternarExcecao(String(u.id))} className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors ${marcada ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}>
                        {marcada ? <CheckSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/> : <Square className="w-4 h-4 text-slate-300 shrink-0 mt-0.5"/>}
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

          <div className="flex justify-end gap-3">
            {editandoId && (
              <button type="button" onClick={cancelarEdicao} className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">{t('holidaysTab.edit.cancel')}</button>
            )}
            <button disabled={processando} className="w-full xl:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {processando ? t('holidaysTab.processing') : (editandoId ? t('holidaysTab.edit.save') : (ehAdmin ? t('holidaysTab.create') : t('holidaysTab.proposals.send')))}
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
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${p.status === STATUS_PROPOSTA.APROVADA ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : p.status === STATUS_PROPOSTA.RECUSADA ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                      {t(`holidaysTab.proposals.status.${p.status || 'pendente'}`)}
                    </span>
                    {ehReforma(p) && <span className="px-2 py-1 text-[10px] font-bold uppercase rounded border bg-amber-50 text-amber-700 border-amber-100 flex items-center gap-1"><Hammer className="w-3 h-3"/> {t('holidaysTab.types.renovation')}</span>}
                    <span className="px-2 py-1 text-[10px] font-bold uppercase rounded border bg-slate-50 text-slate-600 border-slate-200 flex items-center gap-1">
                      <MapPin className="w-3 h-3"/> {descreverAbrangencia(p)}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-lg mb-1">{p.nome}</h4>
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4"/> {t('holidaysTab.range', { start: formatDate(p.dataInicio), end: formatDate(p.dataFim) })}
                  </div>
                  {ehAdmin && <p className="text-xs text-slate-400 mt-2">{t('holidaysTab.proposals.by', { name: p.propostoPorNome || '-' })}</p>}
                  {p.status === STATUS_PROPOSTA.RECUSADA && p.motivoRecusa && <p className="text-xs text-red-600 mt-2">{t('holidaysTab.proposals.reason', { reason: p.motivoRecusa })}</p>}
                  {(ehAdmin || p.status === STATUS_PROPOSTA.PENDENTE) && (
                    <div className="flex gap-2 mt-4">
                      {ehAdmin ? (
                        <>
                          <button disabled={processando} onClick={() => aprovarProposta(p)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 disabled:opacity-50"><Check className="w-4 h-4"/> {t('holidaysTab.proposals.approve')}</button>
                          <button disabled={processando} onClick={() => recusarProposta(p)} className="flex-1 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 disabled:opacity-50"><X className="w-4 h-4"/> {t('holidaysTab.proposals.refuse')}</button>
                        </>
                      ) : (
                        <button onClick={() => desistirDaProposta(p)} className="py-2 px-3 text-slate-500 hover:text-red-600 text-xs font-bold uppercase underline">{t('holidaysTab.proposals.withdraw')}</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CALENDÁRIO SUGERIDO (só admin) */}
      {ehAdmin && <FeriadosSugeridos feriados={feriados} unidades={catalogs?.unidades || []} aulas={catalogs?.aulas || []} usuario={userData} />}

      {/* LISTA DE FERIADOS */}
      <div>
        <h4 className="font-bold text-slate-700 dark:text-white text-sm uppercase mb-4 pl-1 flex items-center gap-2">
            <Calendar className="w-4 h-4"/> {t('holidaysTab.calendar')}
        </h4>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[['proximos', contagem.proximos], ['passados', contagem.passados], ['todos', contagem.todos]].map(([chave, n]) => (
            <button key={chave} type="button" onClick={() => setFiltroPeriodo(chave)}
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase border transition-colors ${filtroPeriodo === chave ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-red-300'}`}>
              {t(`holidaysTab.filters.${chave}`)} ({n})
            </button>
          ))}
          <button type="button" onClick={() => setSoReformaAgora(v => !v)} aria-pressed={soReformaAgora}
            className={`px-3 py-2 rounded-lg text-xs font-bold uppercase border transition-colors flex items-center gap-1.5 ${soReformaAgora ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-amber-300'}`}>
            <Hammer className="w-3.5 h-3.5"/> {t('holidaysTab.renovation.nowFilter')} ({contagem.reformaAgora})
          </button>
          <select className={`${inputClass} !w-auto`} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
            <option value="">{t('holidaysTab.filters.allYears')}</option>
            {anosDosFeriados.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className={`${inputClass} !w-auto`} value={filtroEscopo} onChange={e => setFiltroEscopo(e.target.value)}>
            <option value="">{t('holidaysTab.filters.allScopes')}</option>
            {ESCOPOS_FERIADO.map(e => <option key={e} value={e}>{t(`holidaysTab.scopes.${e}`)}</option>)}
          </select>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <input className={`${inputClass} pl-9`} value={buscaLista} onChange={e => setBuscaLista(e.target.value)} placeholder={t('holidaysTab.filters.search')} />
          </div>
        </div>

        {loading ? (
            <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400"/></div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feriadosVisiveis.map(f => (
                <div key={f.id} className={`group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-md transition-all relative ${(f.dataFim || f.dataInicio) < hojeStr ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start">
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border flex items-center gap-1 ${String(f.tipo || '').includes('Feriado') ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        {ehReforma(f) && <Hammer className="w-3 h-3"/>}
                        {TIPOS_FERIADO[f.tipo] ? t(`holidaysTab.types.${TIPOS_FERIADO[f.tipo]}`) : f.tipo}
                        </span>
                        {reformaEmAndamento(f, hojeStr) && <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-amber-500 text-white">{t('holidaysTab.renovation.inProgress')}</span>}
                        <span className="px-2 py-1 text-[10px] font-bold uppercase rounded border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700 flex items-center gap-1">
                          <MapPin className="w-3 h-3"/> {descreverAbrangencia(f)}
                        </span>
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-lg mb-1">{f.nome}</h4>
                    {ehReforma(f) && nomesDasUnidades(f) && <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">{nomesDasUnidades(f)}</p>}
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4"/>
                        {t('holidaysTab.range', { start: formatDate(f.dataInicio), end: formatDate(f.dataFim) })}
                    </div>
                    </div>
                    {ehAdmin && (
                      <div className="flex gap-1.5 shrink-0">
                        {escopoDoFeriado(f) === 'cidade' && <BotaoDeLinha abaId="feriados" icone={RefreshCw} title={t('holidaysTab.cityActions.refresh')} onClick={() => atualizarUnidadesDaCidade(f)} />}
                        <BotaoDeLinha abaId="feriados" icone={Pencil} title={t('holidaysTab.edit.tooltip')} onClick={() => iniciarEdicao(f)} />
                        <BotaoDeLinha abaId="feriados" tipo="perigo" icone={Trash2} onClick={() => handleDelete(f)} />
                      </div>
                    )}
                </div>
                </div>
            ))}
            {feriadosVisiveis.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                {feriados.length === 0 ? t('holidaysTab.none') : t('holidaysTab.filters.none')}
                </div>
            )}
            </div>
        )}
      </div>
    </div>
  );
}
