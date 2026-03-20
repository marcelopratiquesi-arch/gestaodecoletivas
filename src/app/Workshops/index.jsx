import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';

import { 
  ShoppingBag, Calendar, Loader2, Users,
  X, LayoutDashboard, CreditCard, Package, MapPin, Trash2, Edit, Paperclip, Table, Plus, Shirt, FileText, Filter
} from 'lucide-react';

import toast, { Toaster } from 'react-hot-toast';

import PainelResumo from './PainelResumo';
import TabelaEstoque from './TabelaEstoque';
import DREModal from './DREModal';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatarNomeEvento = (w) => {
    if (!w) return '';
    const dataFormatada = w.data ? w.data.split('-').reverse().join('/') : '';
    return `${w.nome} - ${dataFormatada} - ${w.local || w.estado}`;
};

const TAMANHOS_PADRAO = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', '3G'];
const MODALIDADES_PRATIQUE = ['Power Dance', 'Power Training', 'Energy Jump', 'Power Bumbum', 'Power Core', 'Power Fight', 'Power Bike'];
const ESTADOS_BR = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const FORMA_ESTOQUE_INICIAL = { 
    dataLancamento: '', modalidade: '', tipo: 'entrada', workshopId: '',
    tamanhos: { PP: 0, P: 0, M: 0, G: 0, GG: 0, XG: 0, XGG: 0, '3G': 0 }, 
    valorUnitario: '', valorUnitarioVenda: '', valorVenda: '',
    fornecedorNome: '', fornecedorCNPJ: '', fornecedorEndereco: '', 
    fornecedorTelefone: '', fornecedorEmail: '', numeroNF: '', comprovanteUrl: '',
    motivoSaida: 'Venda'
};

// 🟢 NOVO FORMATO DE EVENTO COM PROFESSOR 2 E LUCRO UNIPOWER
const FORMA_EVENTO_INICIAL = { 
    nome: '', data: '', professor: '', professor2: '', gestor: '', auxiliar: '', 
    modalidade: 'Power Dance', estado: 'MG', local: '', inscritos: '', 
    tipoEvento: 'Workshop', lucroUnipower: 50 
};
const FORMA_TRANSACAO_INICIAL = { workshopId: '', tipo: 'receita', categoria: 'Inscrições (Sympla)', valor: '', descricao: '', comprovanteUrl: '', fornecedorServico: '' };

export default function WorkshopsTab() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [loading, setLoading] = useState(true);

  const [stockLedger, setStockLedger] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [transacoes, setTransacoes] = useState([]);

  const [filtroEstoque, setFiltroEstoque] = useState(''); 
  const [workshopDetalhe, setWorkshopDetalhe] = useState(null); 
  const [filtroTipoEvento, setFiltroTipoEvento] = useState('Todos');
  const [filtroUF, setFiltroUF] = useState('Todos');

  const [isStockModalOpen, setStockModalOpen] = useState(false);
  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  
  const [editingStockId, setEditingStockId] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [editingTransacaoId, setEditingTransacaoId] = useState(null);

  const [formStock, setFormStock] = useState(FORMA_ESTOQUE_INICIAL);
  const [formEvent, setFormEvent] = useState(FORMA_EVENTO_INICIAL);
  const [formTransacao, setFormTransacao] = useState(FORMA_TRANSACAO_INICIAL);

  useEffect(() => {
    setLoading(true);
    const unsubStock = onSnapshot(query(collection(db, 'unipower_stock'), orderBy('data', 'desc')), (snap) => setStockLedger(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubWorkshops = onSnapshot(query(collection(db, 'unipower_workshops'), orderBy('dataCriacao', 'desc')), (snap) => setWorkshops(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTransacoes = onSnapshot(query(collection(db, 'unipower_transacoes'), orderBy('data', 'desc')), (snap) => {
      setTransacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => { unsubStock(); unsubWorkshops(); unsubTransacoes(); };
  }, []);

  const fornecedoresUnicos = useMemo(() => {
      const map = {};
      stockLedger.forEach(item => {
          if (item.tipo === 'entrada' && item.fornecedorCNPJ && !map[item.fornecedorCNPJ]) {
              map[item.fornecedorCNPJ] = { nome: item.fornecedorNome, cnpj: item.fornecedorCNPJ, endereco: item.fornecedorEndereco, telefone: item.fornecedorTelefone, email: item.fornecedorEmail };
          }
      });
      return Object.values(map);
  }, [stockLedger]);

  const handleAutoFillFornecedor = (cnpj) => {
      const f = fornecedoresUnicos.find(x => x.cnpj === cnpj);
      if(f) setFormStock(prev => ({ ...prev, fornecedorCNPJ: f.cnpj, fornecedorNome: f.nome, fornecedorEndereco: f.endereco, fornecedorTelefone: f.telefone, fornecedorEmail: f.email }));
  };

  const estadosComEventos = useMemo(() => {
      const ufs = workshops.map(w => w.estado).filter(Boolean);
      return [...new Set(ufs)].sort(); 
  }, [workshops]);

  const kpis = useMemo(() => {
    let faturacaoBruta = 0, custosOperacionais = 0, repasses = 0;

    transacoes.forEach(t => {
      if (t.tipo === 'receita') faturacaoBruta += Number(t.valor);
      if (t.tipo === 'despesa') custosOperacionais += Number(t.valor);
      if (t.tipo === 'comissao') repasses += Number(t.valor); 
    });

    stockLedger.forEach(s => {
      if (s.tipo === 'entrada') custosOperacionais += Number(s.custoTotal || 0);
      if (s.tipo === 'saida' && s.motivoSaida.includes('Venda')) faturacaoBruta += Number(s.valorVenda || 0);
    });

    const lucroLiquido = faturacaoBruta - custosOperacionais - repasses;
    const saldoStock = {};
    let totalPecas = 0;

    stockLedger.forEach(item => {
      if (!saldoStock[item.modalidade]) saldoStock[item.modalidade] = { PP: 0, P: 0, M: 0, G: 0, GG: 0, XG: 0, XGG: 0, '3G': 0 };
      const tamanhosObj = item.tamanhos || {};
      TAMANHOS_PADRAO.forEach(tam => {
          const qtd = Number(tamanhosObj[tam]) || 0;
          if (item.tipo === 'entrada') { saldoStock[item.modalidade][tam] += qtd; totalPecas += qtd; }
          if (item.tipo === 'saida') { saldoStock[item.modalidade][tam] -= qtd; totalPecas -= qtd; }
      });
    });

    return { faturacaoBruta, custosOperacionais, repasses, lucroLiquido, saldoStock, totalPecas };
  }, [transacoes, stockLedger]);

  const stockLedgerFiltrado = useMemo(() => filtroEstoque ? stockLedger.filter(item => item.modalidade === filtroEstoque) : stockLedger, [stockLedger, filtroEstoque]);

  const custoUnitarioMedio = useMemo(() => {
      if (!formStock.modalidade || formStock.tipo !== 'saida') return 0;
      const entradas = stockLedger.filter(s => s.modalidade === formStock.modalidade && s.tipo === 'entrada');
      return entradas.length > 0 ? Number(entradas[0].valorUnitario) || 0 : 0;
  }, [formStock.modalidade, formStock.tipo, stockLedger]);

  const totalPecasForm = Object.values(formStock.tamanhos).reduce((a, b) => a + Number(b), 0);
  const custoTotalCalculado = Number(formStock.valorUnitario || 0) * totalPecasForm;
  const valorTotalVendaCalculado = Number(formStock.valorUnitarioVenda || 0) * totalPecasForm;
  const lucroDestaVenda = valorTotalVendaCalculado - (custoUnitarioMedio * totalPecasForm);

  const abrirModalNovoStock = () => { setEditingStockId(null); setFormStock(FORMA_ESTOQUE_INICIAL); setStockModalOpen(true); };
  const abrirModalNovoEvento = () => { setEditingEventId(null); setFormEvent(FORMA_EVENTO_INICIAL); setEventModalOpen(true); };
  const abrirModalNovaTransacao = () => { setEditingTransacaoId(null); setFormTransacao(FORMA_TRANSACAO_INICIAL); setTransactionModalOpen(true); };

  const abrirModalEditarStock = (item) => {
      setEditingStockId(item.id);
      let dataFormatoInput = '';
      if (item.data && item.data.toDate) dataFormatoInput = item.data.toDate().toISOString().split('T')[0];

      setFormStock({
          dataLancamento: dataFormatoInput,
          modalidade: item.modalidade || '', tipo: item.tipo || 'entrada', workshopId: item.workshopId || '',
          tamanhos: item.tamanhos || { PP: 0, P: 0, M: 0, G: 0, GG: 0, XG: 0, XGG: 0, '3G': 0 },
          valorUnitario: item.valorUnitario || '', valorUnitarioVenda: item.valorUnitarioVenda || '', valorVenda: item.valorVenda || '',
          fornecedorNome: item.fornecedorNome || '', fornecedorCNPJ: item.fornecedorCNPJ || '', fornecedorEndereco: item.fornecedorEndereco || '',
          fornecedorTelefone: item.fornecedorTelefone || '', fornecedorEmail: item.fornecedorEmail || '', numeroNF: item.numeroNF || '',
          motivoSaida: item.motivoSaida || 'Venda',
          comprovanteUrl: item.comprovanteUrl || ''
      });
      if(workshopDetalhe) setWorkshopDetalhe(null);
      setStockModalOpen(true);
  };

  const abrirModalEditarEvento = (evento) => {
      setEditingEventId(evento.id);
      setFormEvent({
          nome: evento.nome || '', data: evento.data || '', 
          professor: evento.professor || '', professor2: evento.professor2 || '', 
          gestor: evento.gestor || '', auxiliar: evento.auxiliar || '', 
          modalidade: evento.modalidade || '', estado: evento.estado || 'MG', local: evento.local || '', 
          inscritos: evento.inscritos || '', tipoEvento: evento.tipoEvento || 'Workshop',
          lucroUnipower: evento.lucroUnipower !== undefined ? evento.lucroUnipower : 50
      });
      setEventModalOpen(true);
  };

  const abrirModalEditarTransacao = (t) => {
      setEditingTransacaoId(t.id);
      setFormTransacao({
          workshopId: t.workshopId || '', tipo: t.tipo || 'receita', categoria: t.categoria || '',
          valor: t.valor || '', descricao: t.descricao || '', comprovanteUrl: t.comprovanteUrl || '', fornecedorServico: t.fornecedorServico || ''
      });
      if(workshopDetalhe) setWorkshopDetalhe(null); 
      setTransactionModalOpen(true);
  };

  const handleSalvarStock = async (e) => {
    e.preventDefault(); setSalvando(true);
    if (totalPecasForm <= 0) { toast.error("Preencha a quantidade de pelo menos um tamanho!"); setSalvando(false); return; }
    if (!formStock.modalidade) { toast.error("Selecione ou informe a modalidade das camisas!"); setSalvando(false); return; }

    let dataRegistro = serverTimestamp();
    if (formStock.dataLancamento) dataRegistro = new Date(`${formStock.dataLancamento}T12:00:00`); 

    const payload = {
        modalidade: formStock.modalidade, tipo: formStock.tipo,
        workshopId: ((formStock.tipo === 'saida' && formStock.motivoSaida.includes('Venda')) || formStock.tipo === 'entrada') ? formStock.workshopId : '',
        tamanhos: formStock.tamanhos, quantidadeTotal: totalPecasForm,
        valorUnitario: formStock.tipo === 'entrada' ? Number(formStock.valorUnitario) : 0,
        custoTotal: formStock.tipo === 'entrada' ? custoTotalCalculado : 0,
        valorUnitarioVenda: formStock.tipo === 'saida' ? Number(formStock.valorUnitarioVenda) : 0,
        valorVenda: formStock.tipo === 'saida' && formStock.motivoSaida.includes('Venda') ? valorTotalVendaCalculado : 0,
        lucroEstimado: formStock.tipo === 'saida' && formStock.motivoSaida.includes('Venda') ? lucroDestaVenda : 0,
        fornecedorNome: formStock.tipo === 'entrada' ? formStock.fornecedorNome : '', fornecedorCNPJ: formStock.tipo === 'entrada' ? formStock.fornecedorCNPJ : '',
        fornecedorEndereco: formStock.tipo === 'entrada' ? formStock.fornecedorEndereco : '', fornecedorTelefone: formStock.tipo === 'entrada' ? formStock.fornecedorTelefone : '',
        fornecedorEmail: formStock.tipo === 'entrada' ? formStock.fornecedorEmail : '', numeroNF: formStock.tipo === 'entrada' ? formStock.numeroNF : '',
        comprovanteUrl: formStock.tipo === 'entrada' ? formStock.comprovanteUrl : '', motivoSaida: formStock.tipo === 'saida' ? formStock.motivoSaida : '',
        registadoPor: userData?.id || 'admin',
        data: dataRegistro 
    };

    try {
      if (editingStockId) {
          await updateDoc(doc(db, 'unipower_stock', editingStockId), payload);
          toast.success("Movimento de estoque atualizado!");
      } else {
          await addDoc(collection(db, 'unipower_stock'), payload); 
          toast.success("Novo movimento registrado com sucesso!");
      }
      setStockModalOpen(false);
      if (editingStockId && formStock.workshopId) {
          const ws = workshops.find(w => w.id === formStock.workshopId);
          if(ws) setWorkshopDetalhe(ws);
      }
    } catch (error) { console.error(error); toast.error("Falha de comunicação com o banco de dados."); }
    setSalvando(false);
  };

  const handleSalvarEvento = async (e) => {
    e.preventDefault(); setSalvando(true);
    const payload = { 
        ...formEvent, 
        inscritos: Number(formEvent.inscritos) || 0,
        lucroUnipower: Number(formEvent.lucroUnipower) || 0
    };
    try {
      if (editingEventId) {
          await updateDoc(doc(db, 'unipower_workshops', editingEventId), payload);
          toast.success(`${payload.tipoEvento} atualizado com sucesso!`);
      } else {
          await addDoc(collection(db, 'unipower_workshops'), { ...payload, status: 'agendado', dataCriacao: serverTimestamp() });
          toast.success(`Novo ${payload.tipoEvento} criado!`);
      }
      setEventModalOpen(false);
    } catch (error) { console.error(error); toast.error("Erro ao guardar."); }
    setSalvando(false);
  };

  const handleSalvarTransacao = async (e) => {
    e.preventDefault(); setSalvando(true);
    const payload = {
        ...formTransacao, valor: Number(formTransacao.valor), 
        comprovanteUrl: (formTransacao.tipo === 'despesa' || formTransacao.tipo === 'comissao') ? formTransacao.comprovanteUrl : '',
        fornecedorServico: (formTransacao.tipo === 'despesa' || formTransacao.tipo === 'comissao') ? formTransacao.fornecedorServico : ''
    };
    try {
      if (editingTransacaoId) {
          await updateDoc(doc(db, 'unipower_transacoes', editingTransacaoId), payload);
          toast.success("Transação atualizada!");
      } else {
          await addDoc(collection(db, 'unipower_transacoes'), { ...payload, data: serverTimestamp() });
          toast.success("Finanças lançadas no caixa!");
      }
      setTransactionModalOpen(false);
      if (editingTransacaoId && formTransacao.workshopId) {
          const ws = workshops.find(w => w.id === formTransacao.workshopId);
          if(ws) setWorkshopDetalhe(ws);
      }
    } catch (error) { console.error(error); toast.error("Erro ao lançar finanças."); }
    setSalvando(false);
  };

  const handleExcluirStock = async (id) => { if(window.confirm("ATENÇÃO: Deseja realmente excluir este registro?")) { try { await deleteDoc(doc(db, 'unipower_stock', id)); toast.success("Registro removido!"); } catch (e) { toast.error("Erro ao excluir."); } } };
  const handleExcluirWorkshop = async (id) => { if(window.confirm("ATENÇÃO: Deseja excluir este evento? Todos os dados serão perdidos.")) { try { await deleteDoc(doc(db, 'unipower_workshops', id)); toast.success("Evento cancelado."); } catch (e) { toast.error("Erro ao excluir."); } } };
  const handleExcluirTransacao = async (id) => { if(window.confirm("Deseja excluir este lançamento financeiro?")) { try { await deleteDoc(doc(db, 'unipower_transacoes', id)); toast.success("Lançamento estornado."); } catch(e) { toast.error("Erro ao excluir."); } } };

  const handleTamanhoChange = (tamanho, valor) => setFormStock(prev => ({ ...prev, tamanhos: { ...prev.tamanhos, [tamanho]: Number(valor) || 0 } }));

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400"><Loader2 className="w-10 h-10 animate-spin"/></div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1920px] mx-auto animate-fade-in space-y-6">
      
      <Toaster position="bottom-right" reverseOrder={false} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 dark:border-slate-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="bg-red-600 text-white p-2 rounded-lg shadow-lg shadow-red-500/20"><ShoppingBag className="w-6 h-6" /></span>
            Loja & Eventos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">Controle de Estoque ERP e Tesouraria</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><LayoutDashboard className="w-4 h-4"/> Resumo</button>
          <button onClick={() => setActiveTab('estoque')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'estoque' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><Package className="w-4 h-4"/> Estoque</button>
          <button onClick={() => setActiveTab('eventos')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'eventos' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><Calendar className="w-4 h-4"/> Eventos</button>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <PainelResumo kpis={kpis} transacoes={transacoes} workshops={workshops} abrirModalNovaTransacao={abrirModalNovaTransacao} abrirModalEditarTransacao={abrirModalEditarTransacao} handleExcluirTransacao={handleExcluirTransacao} />
      )}

      {activeTab === 'estoque' && (
        <TabelaEstoque kpis={kpis} filtroEstoque={filtroEstoque} setFiltroEstoque={setFiltroEstoque} abrirModalNovoStock={abrirModalNovoStock} stockLedgerFiltrado={stockLedgerFiltrado} abrirModalEditarStock={abrirModalEditarStock} handleExcluirStock={handleExcluirStock} />
      )}

      {/* 🟢 ABA DE EVENTOS */}
      {activeTab === 'eventos' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
                  <div className="flex items-center gap-3">
                      <div className="p-3 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-xl"><Calendar className="w-6 h-6"/></div>
                      <div>
                          <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase">Gestão de Eventos</h2>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workshops e Eventos Especiais</p>
                      </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                      
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                          <Filter className="w-4 h-4 text-slate-400 mx-2" />
                          <select value={filtroUF} onChange={e => setFiltroUF(e.target.value)} className="bg-transparent text-slate-700 dark:text-white text-xs font-black uppercase outline-none cursor-pointer">
                              <option value="Todos">Todos os Estados</option>
                              {estadosComEventos.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                          </select>
                      </div>

                      <button onClick={abrirModalNovaTransacao} className="flex-1 sm:flex-none px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-xl font-black text-xs uppercase hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm flex items-center justify-center gap-2 transition-all">
                          <CreditCard className="w-4 h-4"/> Lançar Financeiro
                      </button>
                      <button onClick={abrirModalNovoEvento} className="flex-1 sm:flex-none px-5 py-3 bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-wide hover:bg-purple-700 shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95">
                          <Plus className="w-4 h-4"/> Novo Evento
                      </button>
                  </div>
              </div>

              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                  <button onClick={() => setFiltroTipoEvento('Todos')} className={`px-4 py-2 text-xs font-black uppercase rounded-lg transition-all ${filtroTipoEvento === 'Todos' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>Todos</button>
                  <button onClick={() => setFiltroTipoEvento('Workshop')} className={`px-4 py-2 text-xs font-black uppercase rounded-lg transition-all ${filtroTipoEvento === 'Workshop' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700'}`}>Workshops</button>
                  <button onClick={() => setFiltroTipoEvento('Evento')} className={`px-4 py-2 text-xs font-black uppercase rounded-lg transition-all ${filtroTipoEvento === 'Evento' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700'}`}>Eventos</button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                  {workshops
                      .filter(w => filtroTipoEvento === 'Todos' || w.tipoEvento === filtroTipoEvento)
                      .filter(w => filtroUF === 'Todos' || w.estado === filtroUF)
                      .map(w => {
                      const transWorkshop = transacoes.filter(t => t.workshopId === w.id);
                      const stockVendasWS = stockLedger.filter(s => s.tipo === 'saida' && s.motivoSaida.includes('Venda') && s.workshopId === w.id);
                      const stockComprasWS = stockLedger.filter(s => s.tipo === 'entrada' && s.workshopId === w.id);
                      
                      const recCaixa = transWorkshop.filter(t => t.tipo === 'receita').reduce((a,b) => a + Number(b.valor), 0);
                      const despCaixa = transWorkshop.filter(t => t.tipo === 'despesa').reduce((a,b) => a + Number(b.valor), 0);
                      const lucroEventoBase = recCaixa - despCaixa;

                      const recStock = stockVendasWS.reduce((a,b) => a + Number(b.valorVenda), 0);
                      const despStock = stockComprasWS.reduce((a,b) => a + Number(b.custoTotal), 0);
                      const lucroCamisasBase = recStock - despStock;

                      // 🟢 MATEMÁTICA INTELIGENTE DA UNIPOWER:
                      const percUnipower = w.lucroUnipower !== undefined ? Number(w.lucroUnipower) : 50;
                      const percProfessores = 100 - percUnipower;

                      const comissaoEventoReal = lucroEventoBase > 0 ? (lucroEventoBase * percProfessores) / 100 : 0;
                      const pctComissaoCamisas = transWorkshop.filter(t => t.tipo === 'comissao' && t.categoria === 'Comissão de Camisas (%)').reduce((a,b) => a + Number(b.valor), 0);
                      const comissaoCamisasReal = lucroCamisasBase > 0 ? (lucroCamisasBase * pctComissaoCamisas) / 100 : 0;

                      const lucroFinal = (lucroEventoBase - comissaoEventoReal) + (lucroCamisasBase - comissaoCamisasReal);
                      const comissaoTotalPaga = comissaoEventoReal + comissaoCamisasReal;
                      const despTotalVisual = despCaixa + despStock;
                      const recTotalVisual = recCaixa + recStock;

                      return (
                      <div key={w.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 hover:shadow-md transition-all group relative overflow-hidden">
                          
                          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => abrirModalEditarEvento(w)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Editar">
                                  <Edit className="w-4 h-4"/>
                              </button>
                              <button onClick={() => handleExcluirWorkshop(w.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm" title="Excluir">
                                  <Trash2 className="w-4 h-4"/>
                              </button>
                          </div>

                          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                              <div className="space-y-2 pr-20">
                                  <div className="flex flex-wrap items-center gap-2">
                                      <span className={`px-2 py-1 text-[9px] font-black uppercase rounded-md tracking-widest ${w.tipoEvento === 'Evento' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{w.tipoEvento || 'Workshop'}</span>
                                      <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-black uppercase rounded-md tracking-widest">{w.modalidade}</span>
                                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded-md"><Calendar className="w-3 h-3"/> {w.data}</span>
                                  </div>
                                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{formatarNomeEvento(w)}</h3>
                                  <div className="flex flex-wrap items-center gap-4">
                                      <p className="text-xs font-bold text-slate-500 flex items-center gap-1"><Users className="w-3 h-3"/> Profs: {w.professor} {w.professor2 ? `& ${w.professor2}` : ''}</p>
                                      {w.gestor && <p className="text-xs font-bold text-slate-400 flex items-center gap-1">Gestor: {w.gestor}</p>}
                                  </div>
                              </div>
                              
                              <div onClick={() => setWorkshopDetalhe(w)} className="flex flex-wrap sm:flex-nowrap gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 w-full xl:w-auto mt-4 xl:mt-0 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
                                  <div className="flex-1 sm:flex-none">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Arrecadação</p>
                                      <p className="text-sm font-black text-emerald-500">{formatCurrency(recTotalVisual)}</p>
                                  </div>
                                  <div className="flex-1 sm:flex-none sm:border-l border-slate-200 sm:pl-4">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Despesas Fixas</p>
                                      <p className="text-sm font-black text-red-500">{formatCurrency(despTotalVisual)}</p>
                                  </div>
                                  <div className="flex-1 sm:flex-none sm:pl-4 sm:border-l border-slate-200 flex items-center gap-4 justify-between w-full">
                                      <div>
                                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lucro Final ({percUnipower}% UNIPOWER)</p>
                                          <p className={`text-lg font-black tracking-tighter ${lucroFinal >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(lucroFinal)}</p>
                                          {comissaoTotalPaga > 0 && <p className="text-[8px] font-bold text-amber-500 mt-0.5 uppercase">Comissões ({percProfessores}%): {formatCurrency(comissaoTotalPaga)}</p>}
                                      </div>
                                      <div className="hidden sm:flex bg-blue-100 text-blue-600 p-2 rounded-lg items-center justify-center"><Table className="w-5 h-5"/></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )})}
                  {workshops.filter(w => filtroTipoEvento === 'Todos' || w.tipoEvento === filtroTipoEvento).filter(w => filtroUF === 'Todos' || w.estado === filtroUF).length === 0 && <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-slate-200 rounded-3xl">Nenhum registo encontrado.</div>}
              </div>
          </div>
      )}

      <DREModal workshopDetalhe={workshopDetalhe} setWorkshopDetalhe={setWorkshopDetalhe} transacoes={transacoes} stockLedger={stockLedger} abrirModalNovaTransacao={abrirModalNovaTransacao} abrirModalEditarTransacao={abrirModalEditarTransacao} handleExcluirTransacao={handleExcluirTransacao} abrirModalEditarStock={abrirModalEditarStock} handleExcluirStock={handleExcluirStock} />

      {/* ==========================================
          MODAIS DE FORMULÁRIOS
      ========================================== */}
      
      {/* MODAL DE ESTOQUE */}
      {isStockModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <form onSubmit={handleSalvarStock} className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className={`p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center text-white shrink-0 ${editingStockId ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                      <h3 className="font-black uppercase tracking-widest flex items-center gap-2"><Package className="w-5 h-5"/> {editingStockId ? 'Editar Movimento' : 'Lançamento Estoque'}</h3>
                      <button type="button" onClick={() => setStockModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                      
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 flex items-center justify-between">
                          <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Data do Registro</label>
                              <input type="date" value={formStock.dataLancamento || ''} onChange={e=>setFormStock({...formStock, dataLancamento: e.target.value})} className="p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-emerald-500"/>
                          </div>
                          <span className="text-[9px] text-slate-400 font-bold max-w-[150px] text-right">Deixe em branco para usar a data e hora de hoje.</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Operação</label><select value={formStock.tipo} onChange={e=>setFormStock({...formStock, tipo: e.target.value, modalidade: ''})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-emerald-500"><option value="entrada">Entrada (Compra)</option><option value="saida">Saída (Venda/Uso)</option></select></div>
                          <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Modalidade</label>
                              {formStock.tipo === 'entrada' ? (
                                  <><input type="text" list="modalidades-pratique" value={formStock.modalidade} onChange={e=>setFormStock({...formStock, modalidade: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-emerald-500" placeholder="Digite..." required/><datalist id="modalidades-pratique">{MODALIDADES_PRATIQUE.map(mod => <option key={mod} value={mod} />)}</datalist></>
                              ) : (
                                  <select value={formStock.modalidade} onChange={e=>setFormStock({...formStock, modalidade: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-amber-500" required><option value="">Selecione...</option>{Object.keys(kpis.saldoStock).map(mod => <option key={mod} value={mod}>{mod}</option>)}</select>
                              )}
                          </div>
                      </div>

                      {formStock.tipo === 'entrada' && (
                          <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 space-y-4">
                              <div className="flex justify-between items-center">
                                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><FileText className="w-4 h-4"/> Dados da Nota</h4>
                                  {fornecedoresUnicos.length > 0 && (<select onChange={(e) => handleAutoFillFornecedor(e.target.value)} className="text-[10px] p-1.5 rounded border border-blue-200 text-blue-600 font-bold outline-none cursor-pointer"><option value="">+ Preencher c/ Salvo</option>{fornecedoresUnicos.map(f => <option key={f.cnpj} value={f.cnpj}>{f.nome}</option>)}</select>)}
                              </div>
                              <div className="mb-4">
                                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 block">Vincular Custo a Evento/Workshop? (Opcional)</label>
                                  <select value={formStock.workshopId} onChange={e=>setFormStock({...formStock, workshopId: e.target.value})} className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500">
                                      <option value="">Estoque Geral</option>
                                      {workshops.map(w => <option key={w.id} value={w.id}>{formatarNomeEvento(w)}</option>)}
                                  </select>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fornecedor</label><input type="text" value={formStock.fornecedorNome} onChange={e=>setFormStock({...formStock, fornecedorNome: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" /></div>
                                  <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">CNPJ</label><input type="text" value={formStock.fornecedorCNPJ} onChange={e=>setFormStock({...formStock, fornecedorCNPJ: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" /></div>
                                  <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Endereço</label><input type="text" value={formStock.fornecedorEndereco} onChange={e=>setFormStock({...formStock, fornecedorEndereco: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" /></div>
                                  <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Telefone</label><input type="text" value={formStock.fornecedorTelefone} onChange={e=>setFormStock({...formStock, fornecedorTelefone: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" /></div>
                                  <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">E-mail</label><input type="email" value={formStock.fornecedorEmail} onChange={e=>setFormStock({...formStock, fornecedorEmail: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" /></div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-blue-100">
                                  <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Nº NF</label><input type="text" value={formStock.numeroNF} onChange={e=>setFormStock({...formStock, numeroNF: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none" /></div>
                                  <div><label className="text-[10px] font-black text-blue-600 uppercase block mb-1">Custo Un (R$)</label><input type="number" step="0.01" value={formStock.valorUnitario} onChange={e=>setFormStock({...formStock, valorUnitario: e.target.value})} className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-sm font-black text-blue-600 outline-none focus:ring-2 focus:ring-blue-500" required/></div>
                                  <div><label className="text-[10px] font-black text-red-600 uppercase block mb-1">Custo Total</label><div className="w-full p-2.5 bg-red-100 border border-red-200 rounded-xl text-sm font-black text-red-600">{formatCurrency(custoTotalCalculado)}</div></div>
                                  <div className="md:col-span-3"><label className="text-[10px] font-black text-slate-500 uppercase block mb-1 flex items-center gap-1"><Paperclip className="w-3 h-3"/> Link do Anexo</label><input type="url" value={formStock.comprovanteUrl} onChange={e=>setFormStock({...formStock, comprovanteUrl: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none" /></div>
                              </div>
                          </div>
                      )}

                      {formStock.tipo === 'saida' && (
                          <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1 block">Motivo da Saída</label>
                                      <select value={formStock.motivoSaida} onChange={e=>setFormStock({...formStock, motivoSaida: e.target.value})} className="w-full p-3 bg-white border border-amber-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-amber-500">
                                          <option value="Venda">Venda (Direta ou p/ Evento)</option>
                                          <option value="Cortesia / Doação">Cortesia / Doação / Sorteio</option>
                                          <option value="Defeito de Fábrica">Defeito de Fábrica</option>
                                          <option value="Uso Interno">Uso Interno - Professores</option>
                                          <option value="Outros">Outros</option>
                                      </select>
                                  </div>
                                  {(formStock.motivoSaida === 'Venda' || formStock.motivoSaida === 'Venda no Evento') && (
                                      <div>
                                          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 block">Vincular Venda a Evento? (Opcional)</label>
                                          <select value={formStock.workshopId} onChange={e=>setFormStock({...formStock, workshopId: e.target.value})} className="w-full p-3 bg-white border border-blue-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-blue-500">
                                              <option value="">Estoque Geral (Sem Vínculo)</option>
                                              {workshops.map(w => <option key={w.id} value={w.id}>{formatarNomeEvento(w)}</option>)}
                                          </select>
                                      </div>
                                  )}
                              </div>
                              {(formStock.motivoSaida === 'Venda' || formStock.motivoSaida === 'Venda no Evento') && (
                                  <div className="pt-4 border-t border-amber-200 space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                          <div><label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 block">Valor Venda</label><input type="number" step="0.01" value={formStock.valorUnitarioVenda} onChange={e=>setFormStock({...formStock, valorUnitarioVenda: e.target.value})} className="w-full p-3 bg-white border border-emerald-200 rounded-xl text-sm font-black text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500" required/></div>
                                          <div><label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1 block">Arrecadado</label><div className="w-full p-3 bg-emerald-100 border border-emerald-200 rounded-xl text-sm font-black text-emerald-700">{formatCurrency(valorTotalVendaCalculado)}</div></div>
                                          <div><label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 block">Lucro Venda</label><div className="w-full p-2.5 bg-blue-100 border border-blue-200 rounded-xl text-sm font-black text-blue-700 flex flex-col justify-center"><span>{formatCurrency(lucroDestaVenda)}</span><span className="text-[8px] font-bold text-blue-500 mt-0.5 uppercase">Custo: {formatCurrency(custoUnitarioMedio)}/un</span></div></div>
                                      </div>
                                  </div>
                              )}
                          </div>
                      )}

                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                          <div className="flex justify-between items-center mb-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Shirt className="w-4 h-4"/> Grade</label><span className="text-[10px] font-black uppercase text-blue-500 bg-blue-50 px-2 py-1 rounded">Total: {totalPecasForm}</span></div>
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                              {TAMANHOS_PADRAO.map(tam => {
                                  const itemSendoEditado = editingStockId ? stockLedger.find(s => s.id === editingStockId) : null;
                                  const qtdSendoEditada = (itemSendoEditado && itemSendoEditado.tamanhos && itemSendoEditado.tamanhos[tam]) || 0;
                                  const estoqueDisponivel = (kpis.saldoStock[formStock.modalidade] && kpis.saldoStock[formStock.modalidade][tam]) || 0;
                                  const limitMax = formStock.tipo === 'saida' ? (estoqueDisponivel + (editingStockId ? qtdSendoEditada : 0)) : undefined;
                                  return (
                                  <div key={tam}>
                                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5 text-center flex flex-col">{tam}{formStock.tipo === 'saida' && formStock.modalidade && <span className="text-[8px] text-emerald-500 font-black mt-0.5">(Max: {limitMax})</span>}</label>
                                      <input type="number" min="0" max={limitMax} value={formStock.tamanhos[tam]} onChange={e => handleTamanhoChange(tam, e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-center text-sm font-bold outline-none focus:border-blue-500" disabled={formStock.tipo === 'saida' && !formStock.modalidade}/>
                                  </div>
                              )})}
                          </div>
                      </div>
                  </div>
                  <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
                      <button type="button" onClick={() => setStockModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-200 transition-colors">Cancelar</button>
                      <button type="submit" disabled={salvando} className={`px-6 py-2.5 text-white rounded-xl font-black text-xs uppercase shadow-md transition-colors flex items-center gap-2 ${editingStockId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{salvando ? <Loader2 className="w-4 h-4 animate-spin"/> : "Gravar"}</button>
                  </div>
              </form>
          </div>
      )}

      {/* 🟢 MODAL DE EVENTOS: AGORA COM LUCRO DA UNIPOWER EDITÁVEL */}
      {isEventModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <form onSubmit={handleSalvarEvento} className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className={`p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center text-white shrink-0 ${editingEventId ? 'bg-blue-600' : 'bg-purple-600'}`}>
                      <h3 className="font-black uppercase tracking-widest flex items-center gap-2"><Calendar className="w-5 h-5"/> {editingEventId ? 'Editar Evento' : 'Novo Evento'}</h3>
                      <button type="button" onClick={() => setEventModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                      
                      <div className="grid grid-cols-2 gap-4 mb-2">
                          <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                              <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest mb-1 block">Tipo de Registo</label>
                              <select value={formEvent.tipoEvento} onChange={e=>setFormEvent({...formEvent, tipoEvento: e.target.value})} className="w-full p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold uppercase outline-none focus:border-purple-500 text-purple-700" required>
                                  <option value="Workshop">Workshop</option>
                                  <option value="Evento">Evento Especial</option>
                              </select>
                          </div>
                          
                          {/* 🟢 CAIXA VERDE: LUCRO UNIPOWER (%) */}
                          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                              <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1 block">Retenção UNIPOWER (%)</label>
                              <input 
                                  type="number" min="0" max="100" 
                                  value={formEvent.lucroUnipower} 
                                  onChange={e=>setFormEvent({...formEvent, lucroUnipower: e.target.value})} 
                                  className="w-full p-2 bg-white border border-emerald-200 rounded-lg text-sm font-black outline-none focus:border-emerald-500 text-emerald-700" 
                                  required
                              />
                              <p className="text-[8px] font-bold text-emerald-600 mt-1 uppercase leading-tight">
                                  Professores ganham: {100 - (Number(formEvent.lucroUnipower)||0)}%
                              </p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Título do Evento</label><input type="text" value={formEvent.nome} onChange={e=>setFormEvent({...formEvent, nome: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-purple-500" required/></div>
                          
                          {/* 🟢 DOIS PROFESSORES AQUI */}
                          <div><label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 block">Professor 1 (Principal)</label><input type="text" value={formEvent.professor} onChange={e=>setFormEvent({...formEvent, professor: e.target.value})} className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-blue-500" required/></div>
                          <div><label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 block">Professor 2 (Opcional)</label><input type="text" value={formEvent.professor2} onChange={e=>setFormEvent({...formEvent, professor2: e.target.value})} className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-blue-500" /></div>
                          
                          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Gestor (Opcional)</label><input type="text" value={formEvent.gestor} onChange={e=>setFormEvent({...formEvent, gestor: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-purple-500" /></div>
                          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Auxiliar (Opcional)</label><input type="text" value={formEvent.auxiliar} onChange={e=>setFormEvent({...formEvent, auxiliar: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-purple-500" /></div>
                          
                          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Modalidade Principal</label><input type="text" list="modalidades-pratique-evento" value={formEvent.modalidade} onChange={e=>setFormEvent({...formEvent, modalidade: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-purple-500" required/><datalist id="modalidades-pratique-evento">{MODALIDADES_PRATIQUE.map(mod => <option key={mod} value={mod} />)}</datalist></div>
                          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Data</label><input type="date" value={formEvent.data} onChange={e=>setFormEvent({...formEvent, data: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-purple-500" required/></div>
                          
                          <div className="md:col-span-2 grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">UF</label><select value={formEvent.estado} onChange={e=>setFormEvent({...formEvent, estado: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-purple-500">{ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select></div>
                              <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Local</label><input type="text" value={formEvent.local} onChange={e=>setFormEvent({...formEvent, local: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-purple-500" required/></div>
                          </div>
                      </div>
                  </div>
                  <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
                      <button type="button" onClick={() => setEventModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-200 transition-colors">Cancelar</button>
                      <button type="submit" disabled={salvando} className={`px-6 py-2.5 text-white rounded-xl font-black text-xs uppercase shadow-md transition-colors flex items-center gap-2 ${editingEventId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}>{salvando ? <Loader2 className="w-4 h-4 animate-spin"/> : "Gravar"}</button>
                  </div>
              </form>
          </div>
      )}

      {/* MODAL DE TRANSAÇÕES */}
      {isTransactionModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <form onSubmit={handleSalvarTransacao} className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className={`p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center text-white shrink-0 ${editingTransacaoId ? 'bg-blue-600' : 'bg-slate-800 dark:bg-slate-900'}`}>
                      <h3 className="font-black uppercase tracking-widest flex items-center gap-2"><CreditCard className="w-5 h-5"/> {editingTransacaoId ? 'Editar Lançamento' : 'Lançamento de Caixa'}</h3>
                      <button type="button" onClick={() => setTransactionModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Vincular a Qual Evento?</label><select value={formTransacao.workshopId} onChange={e=>setFormTransacao({...formTransacao, workshopId: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-blue-500" required><option value="">Selecione...</option>{workshops.map(w => <option key={w.id} value={w.id}>{formatarNomeEvento(w)}</option>)}</select></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tipo</label>
                              <select value={formTransacao.tipo} onChange={e=> {
                                  let defaultCat = '';
                                  if(e.target.value === 'receita') defaultCat = 'Inscrições (Sympla)';
                                  if(e.target.value === 'despesa') defaultCat = 'Taxa Sympla';
                                  // 🟢 Removida a comissão de evento, agora é só camisas ou extras
                                  if(e.target.value === 'comissao') defaultCat = 'Comissão de Camisas (%)';
                                  setFormTransacao({...formTransacao, tipo: e.target.value, categoria: defaultCat});
                              }} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-blue-500">
                                  <option value="receita">Receita</option>
                                  <option value="despesa">Despesa</option>
                                  <option value="comissao">Comissão (%)</option>
                              </select>
                          </div>
                          
                          <div>
                              <label className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${formTransacao.tipo === 'comissao' ? 'text-amber-600' : 'text-slate-400'}`}>
                                  {formTransacao.tipo === 'comissao' ? 'Porcentagem (%)' : 'Valor (R$)'}
                              </label>
                              <input type="number" step={formTransacao.tipo === 'comissao' ? "1" : "0.01"} min={formTransacao.tipo === 'comissao' ? "1" : "0.01"} max={formTransacao.tipo === 'comissao' ? "100" : undefined} value={formTransacao.valor} onChange={e=>setFormTransacao({...formTransacao, valor: e.target.value})} className={`w-full p-3 bg-white border rounded-xl text-sm font-black outline-none focus:ring-2 ${formTransacao.tipo === 'comissao' ? 'border-amber-300 focus:ring-amber-500 text-amber-600' : 'border-slate-200'}`} required/>
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Categoria</label>
                          <select value={formTransacao.categoria} onChange={e=>setFormTransacao({...formTransacao, categoria: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-blue-500">
                              {formTransacao.tipo === 'receita' && (<><option value="Inscrições (Sympla)">Inscrições (Sympla)</option><option value="Patrocínio">Patrocínio</option><option value="Outra Receita">Outra Receita</option></>)}
                              {formTransacao.tipo === 'despesa' && (
                                  <>
                                      <option value="Taxa Sympla">Taxa do Sympla</option>
                                      <option value="Coffee Break / Lanche">Coffee Break / Lanche</option>
                                      <option value="Staff / Equipe de Apoio">Staff / Equipe de Apoio</option>
                                      <option value="Aluguel (Cadeiras/Equipamentos)">Aluguel (Cadeiras/Equipamentos)</option>
                                      <option value="Estrutura / Som">Estrutura / Som</option>
                                      <option value="Gestão e Logística">Gestão e Logística</option>
                                      <option value="Outra Despesa">Outra Despesa</option>
                                  </>
                              )}
                              {formTransacao.tipo === 'comissao' && (
                                  <>
                                      {/* 🟢 O usuário agora lança apenas a de camisas aqui. A do evento é automática! */}
                                      <option value="Comissão de Camisas (%)">Comissão de Camisas (%)</option>
                                      <option value="Comissão Extra / Outros (%)">Comissão Extra / Outros (%)</option>
                                  </>
                              )}
                          </select>
                      </div>
                      {(formTransacao.tipo === 'despesa' || formTransacao.tipo === 'comissao') && (<div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Responsável / Recebedor</label><input type="text" value={formTransacao.fornecedorServico} onChange={e=>setFormTransacao({...formTransacao, fornecedorServico: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500" /></div>)}
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Detalhes Adicionais</label><input type="text" value={formTransacao.descricao} onChange={e=>setFormTransacao({...formTransacao, descricao: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-blue-500" required/></div>
                      {(formTransacao.tipo === 'despesa' || formTransacao.tipo === 'comissao') && (<div className="bg-red-50 p-4 rounded-xl border border-red-100"><label className="text-[10px] font-black text-red-600 uppercase block mb-1 flex items-center gap-1"><Paperclip className="w-3 h-3"/> Recibo (Link)</label><input type="url" value={formTransacao.comprovanteUrl} onChange={e=>setFormTransacao({...formTransacao, comprovanteUrl: e.target.value})} className="w-full p-2 bg-white border border-red-200 rounded-lg text-xs outline-none" /></div>)}
                  </div>
                  <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
                      <button type="button" onClick={() => setTransactionModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-200 transition-colors">Cancelar</button>
                      <button type="submit" disabled={salvando} className={`px-6 py-2.5 text-white rounded-xl font-black text-xs uppercase shadow-md transition-colors flex items-center gap-2 ${editingTransacaoId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'}`}>{salvando ? <Loader2 className="w-4 h-4 animate-spin"/> : "Gravar"}</button>
                  </div>
              </form>
          </div>
      )}

    </div>
  );
}