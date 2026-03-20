import React, { memo } from 'react';
import { Shirt, Plus, X, Tag, FileText, Filter, ExternalLink, Edit, Trash2, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const TAMANHOS_PADRAO = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', '3G'];

const TabelaEstoque = ({
    kpis, filtroEstoque, setFiltroEstoque, abrirModalNovoStock,
    stockLedgerFiltrado, abrirModalEditarStock, handleExcluirStock
}) => {

    const exportarPDF = () => {
        try {
            const doc = new jsPDF();
            doc.text("Relatório de Inventário ERP", 14, 15);
            
            const tableColumn = ["Data", "Operação", "Modalidade", "Qtd", "Fornecedor / Motivo", "Financeiro"];
            const tableRows = [];

            stockLedgerFiltrado.forEach(item => {
                const data = item.data?.toDate ? item.data.toDate().toLocaleDateString('pt-BR') : 'Hoje';
                const fornecedor = item.tipo === 'entrada' ? item.fornecedorNome : item.motivoSaida;
                const financeiro = item.tipo === 'entrada' ? `Custo: ${formatCurrency(item.custoTotal)}` : `Venda: ${formatCurrency(item.valorVenda)}`;
                tableRows.push([data, item.tipo.toUpperCase(), item.modalidade, item.quantidadeTotal, fornecedor, financeiro]);
            });

            autoTable(doc, {
                head: [tableColumn], body: tableRows, startY: 20, styles: { fontSize: 8 }, headStyles: { fillColor: [16, 185, 129] }
            });
            doc.save(`Inventario_${new Date().getTime()}.pdf`);
        } catch (error) { console.error("Erro ao gerar PDF:", error); alert("Erro ao gerar PDF. O motor falhou."); }
    };

    // 🟢 O NOVO MOTOR EXCEL (COMPLETO COM ENTRADAS E SAÍDAS SEPARADAS)
    const exportarExcel = () => {
        const dados = stockLedgerFiltrado.map(item => {
            const isEntrada = item.tipo === 'entrada';
            const isSaida = item.tipo === 'saida';
            
            // Pega a grade de tamanhos e formata (Ex: M:2, G:1)
            const detalhesTamanhos = Object.entries(item.tamanhos || {})
                .filter(([k, v]) => v > 0)
                .map(([k, v]) => `${k}(${v})`).join(', ');

            return {
                'Data Registo': item.data?.toDate ? item.data.toDate().toLocaleDateString('pt-BR') : 'Hoje',
                'Operação': item.tipo.toUpperCase(),
                'Modalidade (Produto)': item.modalidade,
                'Qtd. Peças': item.quantidadeTotal,
                'Grade / Tamanhos': detalhesTamanhos,
                'Origem / Motivo': isEntrada ? (item.fornecedorNome || 'S/ Fornecedor') : item.motivoSaida,
                'Nota Fiscal': item.numeroNF || '-',
                'Vinculado a Evento?': item.workshopId ? 'Sim (Evento)' : 'Estoque Geral',
                'Custo Unitário (R$)': isEntrada ? Number(item.valorUnitario || 0) : 0,
                'CUSTO TOTAL (R$)': isEntrada ? Number(item.custoTotal || 0) : 0,
                'Venda Unitária (R$)': isSaida ? Number(item.valorUnitarioVenda || 0) : 0,
                'ARRECADAÇÃO TOTAL (R$)': isSaida ? Number(item.valorVenda || 0) : 0,
                'Lucro Estimado Venda (R$)': isSaida ? Number(item.lucroEstimado || 0) : 0
            };
        });
        
        const worksheet = XLSX.utils.json_to_sheet(dados);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Inventário Consolidado");
        XLSX.writeFile(workbook, `Relatorio_Estoque_${new Date().getTime()}.xlsx`);
    };

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
            <div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl"><Shirt className="w-6 h-6"/></div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase">Inventário Consolidado</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpis.totalPecas} peças totais no armazém</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {filtroEstoque && (
                            <button onClick={() => setFiltroEstoque('')} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 hover:bg-slate-200">
                                <X className="w-3 h-3"/> Limpar Filtro
                            </button>
                        )}
                        
                        {stockLedgerFiltrado.length > 0 && (
                            <div className="flex gap-2 mr-2 border-r border-slate-200 pr-4">
                                <button onClick={exportarPDF} className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 hover:bg-red-100 transition-colors" title="Baixar PDF"><Download className="w-3 h-3"/> PDF</button>
                                <button onClick={exportarExcel} className="px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 hover:bg-emerald-100 transition-colors" title="Baixar Planilha Excel Completa"><Download className="w-3 h-3"/> XLS</button>
                            </div>
                        )}

                        <button onClick={abrirModalNovoStock} className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wide hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 w-full sm:w-auto">
                            <Plus className="w-4 h-4"/> Lançar Entrada/Saída
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {Object.entries(kpis.saldoStock).map(([modalidade, tamanhosObj]) => {
                        const totalModalidade = Object.values(tamanhosObj).reduce((a,b)=>a+b, 0);
                        const isFiltrado = filtroEstoque === modalidade;

                        return (
                        <div 
                            key={modalidade} 
                            onClick={() => setFiltroEstoque(isFiltrado ? '' : modalidade)}
                            className={`bg-white dark:bg-slate-800 p-6 rounded-2xl border shadow-sm flex flex-col cursor-pointer transition-all hover:scale-[1.01] ${isFiltrado ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'}`}
                        >
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                                <div className="flex items-center gap-2">
                                    <Tag className={`w-4 h-4 ${isFiltrado ? 'text-emerald-500' : 'text-slate-400'}`}/>
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase">{modalidade}</h3>
                                </div>
                                <span className={`px-3 py-1 text-xs font-black uppercase rounded-lg ${totalModalidade > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    Total: {totalModalidade}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                {TAMANHOS_PADRAO.map(tam => {
                                    const qtd = tamanhosObj[tam] || 0;
                                    return (
                                        <div key={tam} className={`flex flex-col items-center justify-center p-2 rounded-xl border ${qtd > 0 ? 'bg-slate-50 border-emerald-200 dark:bg-slate-900 dark:border-emerald-900/50' : 'bg-slate-50/50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-700 opacity-60'}`}>
                                            <span className="text-[10px] font-black text-slate-400 mb-1">{tam}</span>
                                            <span className={`text-sm font-black ${qtd > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>{qtd}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )})}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-600"/> 
                        Histórico de Movimentos (Estoque)
                        {filtroEstoque && <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-md flex items-center gap-1"><Filter className="w-3 h-3"/> Filtrado: {filtroEstoque}</span>}
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 dark:bg-slate-900/20">
                                <th className="p-4">Data</th>
                                <th className="p-4">Tipo</th>
                                <th className="p-4">Modalidade</th>
                                <th className="p-4 text-center">Peças</th>
                                <th className="p-4">Fornecedor / Financeiro</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {stockLedgerFiltrado.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                    <td className="p-4 text-xs font-bold text-slate-500 whitespace-nowrap">
                                        {item.data?.toDate ? item.data.toDate().toLocaleDateString('pt-BR') : 'Hoje'}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 text-[9px] font-black uppercase rounded-md ${item.tipo === 'entrada' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {item.tipo}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm font-black text-slate-700 dark:text-white uppercase whitespace-nowrap">
                                        {item.modalidade}
                                        {/* 🟢 Mostra se está vinculado no histórico visual */}
                                        {item.workshopId && <span className="block mt-1 text-[8px] text-blue-500 bg-blue-50 px-1 py-0.5 rounded border border-blue-200 w-fit">Vinc. Evento</span>}
                                    </td>
                                    <td className="p-4 text-center text-sm font-black text-slate-600 dark:text-slate-300">
                                        {item.quantidadeTotal}
                                    </td>
                                    <td className="p-4 text-xs font-bold text-slate-500">
                                        {item.tipo === 'entrada' ? (
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className="text-slate-700 dark:text-white truncate max-w-[250px]">{item.fornecedorNome ? `${item.fornecedorNome} (NF: ${item.numeroNF || 'S/N'})` : 'S/ Fornecedor'}</span>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[9px] text-red-500 font-black uppercase">Custo: {formatCurrency(item.custoTotal)}</span>
                                                    {item.comprovanteUrl && (
                                                        <a href={item.comprovanteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[9px] font-black uppercase bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors">
                                                            <ExternalLink className="w-3 h-3"/> Fatura
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className="text-slate-700 dark:text-white">{item.motivoSaida || 'Saída'}</span>
                                                {item.motivoSaida.includes('Venda') && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-emerald-600 font-black uppercase">Venda: {formatCurrency(item.valorVenda)}</span>
                                                        <span className="text-[8px] text-blue-500 font-bold uppercase">Lucro Est.: {formatCurrency(item.lucroEstimado)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                                        <button onClick={() => abrirModalEditarStock(item)} className="p-2 bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-colors" title="Editar Movimento">
                                            <Edit className="w-4 h-4"/>
                                        </button>
                                        <button onClick={() => handleExcluirStock(item.id)} className="p-2 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-colors" title="Excluir Movimento">
                                            <Trash2 className="w-4 h-4"/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {stockLedgerFiltrado.length === 0 && (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Sem registros encontrados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default memo(TabelaEstoque);