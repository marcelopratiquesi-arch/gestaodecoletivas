import React, { memo, useState, useRef, useEffect } from 'react';
import { Table, Plus, X, ArrowUpRight, ArrowDownRight, Edit, Trash2, Paperclip, DollarSign, Download, FileSignature, Building2, UserCheck, Move } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const DREModal = ({
    workshopDetalhe, setWorkshopDetalhe, transacoes, stockLedger,
    abrirModalNovaTransacao, abrirModalEditarTransacao, handleExcluirTransacao,
    abrirModalEditarStock, handleExcluirStock
}) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragRef = useRef({ isDragging: false, startX: 0, startY: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!dragRef.current.isDragging) return;
            setPosition({
                x: e.clientX - dragRef.current.startX,
                y: e.clientY - dragRef.current.startY
            });
        };
        const handleMouseUp = () => {
            dragRef.current.isDragging = false;
            document.body.style.userSelect = ''; 
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleMouseDown = (e) => {
        if (e.target.closest('button')) return; 
        dragRef.current.isDragging = true;
        dragRef.current.startX = e.clientX - position.x;
        dragRef.current.startY = e.clientY - position.y;
        document.body.style.userSelect = 'none'; 
    };

    if (!workshopDetalhe) return null;

    const dataFormatada = workshopDetalhe.data ? workshopDetalhe.data.split('-').reverse().join('/') : '';
    const tituloEvento = `${workshopDetalhe.nome} - ${dataFormatada} - ${workshopDetalhe.local || workshopDetalhe.estado}`;

    const transWS = transacoes.filter(t => t.workshopId === workshopDetalhe.id);
    const stockVendasWS = stockLedger.filter(s => s.tipo === 'saida' && s.motivoSaida.includes('Venda') && s.workshopId === workshopDetalhe.id);
    const stockComprasWS = stockLedger.filter(s => s.tipo === 'entrada' && s.workshopId === workshopDetalhe.id);
    
    const receitasCaixa = transWS.filter(t => t.tipo === 'receita').map(t => ({...t, isStock: false}));
    const despesasCaixa = transWS.filter(t => t.tipo === 'despesa').map(t => ({...t, isStock: false}));
    
    const receitasStock = stockVendasWS.map(s => ({
        id: s.id, tipo: 'receita', categoria: '[ESTOQUE] Venda de Camisas',
        descricao: `${s.quantidadeTotal}x ${s.modalidade}`, valor: s.valorVenda, isStock: true
    }));
    const despesasStock = stockComprasWS.map(s => ({
        id: s.id, tipo: 'despesa', categoria: '[ESTOQUE] Compra de Camisas',
        fornecedorServico: s.fornecedorNome || 'Fornecedor', descricao: `${s.quantidadeTotal}x ${s.modalidade} (Custo NF)`, valor: s.custoTotal, isStock: true
    }));

    const rEvento = receitasCaixa.reduce((sum, i) => sum + Number(i.valor), 0);
    const dEvento = despesasCaixa.reduce((sum, i) => sum + Number(i.valor), 0);
    const lucroBaseEvento = rEvento - dEvento;

    const rStock = receitasStock.reduce((sum, i) => sum + Number(i.valor), 0);
    const dStock = despesasStock.reduce((sum, i) => sum + Number(i.valor), 0);
    const lucroBaseCamisas = rStock - dStock;

    // 🟢 MATEMÁTICA INTELIGENTE DOS PROFESSORES
    const percUnipower = workshopDetalhe.lucroUnipower !== undefined ? Number(workshopDetalhe.lucroUnipower) : 50;
    const percProfessores = 100 - percUnipower;

    const comissaoEventoReal = lucroBaseEvento > 0 ? (lucroBaseEvento * percProfessores) / 100 : 0;
    
    // Comissão das camisas (ainda pega da transação manual, se houver)
    const pctComissaoCamisas = transWS.filter(t => t.tipo === 'comissao' && t.categoria === 'Comissão de Camisas (%)').reduce((sum, i) => sum + Number(i.valor), 0);
    const comissaoCamisasReal = lucroBaseCamisas > 0 ? (lucroBaseCamisas * pctComissaoCamisas) / 100 : 0;

    // 🟢 CRIA AS LINHAS DA TABELA DE FORMA AUTOMÁTICA
    const comissoesNaTabela = [];
    
    if (lucroBaseEvento > 0 && percProfessores > 0) {
        comissoesNaTabela.push({
            id: 'comissao-evento-auto', 
            tipo: 'comissao', 
            isStock: false,
            categoria: 'Repasse Professores (Evento)',
            descricao: `${percProfessores}% do Lucro Base (Configuração do Evento)`,
            fornecedorServico: workshopDetalhe.professor2 ? `${workshopDetalhe.professor} / ${workshopDetalhe.professor2}` : workshopDetalhe.professor,
            valor: comissaoEventoReal
        });
    }

    // Comissões manuais (Camisas e Extras)
    const comissoesManuais = transWS.filter(t => t.tipo === 'comissao').map(t => {
        let valorRealR$ = 0;
        if (t.categoria === 'Comissão de Camisas (%)' && lucroBaseCamisas > 0) {
            valorRealR$ = (lucroBaseCamisas * Number(t.valor)) / 100;
        } else if (t.categoria === 'Comissão Extra / Outros (%)' && (lucroBaseEvento + lucroBaseCamisas) > 0) {
            valorRealR$ = ((lucroBaseEvento + lucroBaseCamisas) * Number(t.valor)) / 100;
        } else {
            valorRealR$ = (lucroBaseEvento * Number(t.valor)) / 100; // Legacy
        }
        return { ...t, isStock: false, valor: valorRealR$, descricao: `${t.valor}% Acordado - ${t.descricao}` };
    });

    const receitasList = [...receitasCaixa, ...receitasStock];
    const saidasList = [...despesasCaixa, ...despesasStock, ...comissoesNaTabela, ...comissoesManuais];

    const rTotal = rEvento + rStock;
    const dTotalTabela = saidasList.reduce((sum, i) => sum + Number(i.valor), 0); 
    const totalComissoes = comissaoEventoReal + comissaoCamisasReal;

    const lucroBaseTotal = rTotal - (dEvento + dStock);
    const lucroEmpresa = lucroBaseTotal - totalComissoes;

    const gerarRecibo = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text("RECIBO DE PRESTAÇÃO DE CONTAS", 105, 25, { align: "center" });
            
            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");
            doc.text(`Referente a: ${tituloEvento}`, 20, 45);
            doc.text(`Professor(es): ${workshopDetalhe.professor}${workshopDetalhe.professor2 ? ' e ' + workshopDetalhe.professor2 : ''}`, 20, 52);

            doc.setFont("helvetica", "bold");
            doc.text("1. Operação do Evento / Inscrições", 20, 70);
            doc.setFont("helvetica", "normal");
            doc.text(`Receitas: ${formatCurrency(rEvento)}`, 25, 78);
            doc.text(`Despesas: ${formatCurrency(dEvento)}`, 25, 85);
            doc.text(`Lucro Base Evento: ${formatCurrency(lucroBaseEvento)}`, 25, 92);
            doc.setFont("helvetica", "italic");
            doc.text(`-> Repasse Acordado (${percProfessores}%): ${formatCurrency(comissaoEventoReal)}`, 25, 99);

            doc.setFont("helvetica", "bold");
            doc.text("2. Operação da Loja / Camisas", 20, 115);
            doc.setFont("helvetica", "normal");
            doc.text(`Arrecadação Vendas: ${formatCurrency(rStock)}`, 25, 123);
            doc.text(`Custo das Camisas: ${formatCurrency(dStock)}`, 25, 130);
            doc.text(`Lucro Base Loja: ${formatCurrency(lucroBaseCamisas)}`, 25, 137);
            doc.setFont("helvetica", "italic");
            doc.text(`-> Comissão Acordada (${pctComissaoCamisas}%): ${formatCurrency(comissaoCamisasReal)}`, 25, 144);

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(37, 99, 235);
            doc.text(`TOTAL LÍQUIDO A RECEBER (COMISSÕES): ${formatCurrency(totalComissoes)}`, 20, 165);

            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "normal");
            doc.text("Declaro ter recebido a quantia exata acima discriminada, referente ao repasse", 20, 185);
            doc.text("de lucros da operação, dando plena e geral quitação de todos os valores.", 20, 192);

            const dataHoje = new Date().toLocaleDateString('pt-BR');
            doc.text(`Belo Horizonte/MG, ${dataHoje}.`, 20, 210);

            doc.line(50, 240, 160, 240);
            doc.setFont("helvetica", "bold");
            doc.text(workshopDetalhe.professor || 'Assinatura do Professor', 105, 246, { align: "center" });

            doc.save(`Recibo_${workshopDetalhe.nome.replace(/\s+/g, '_')}.pdf`);
        } catch (error) { console.error(error); alert("Erro ao gerar o Recibo."); }
    };

    const exportarPDF = () => {
        try {
            const doc = new jsPDF();
            doc.text(`DRE Analítico: ${tituloEvento}`, 14, 15);
            doc.setFontSize(10);
            doc.text(`Professores: ${workshopDetalhe.professor} ${workshopDetalhe.professor2 ? '/ ' + workshopDetalhe.professor2 : ''}`, 14, 22);

            doc.text("ENTRADAS (Receitas)", 14, 32);
            autoTable(doc, {
                startY: 36, head: [['Categoria', 'Descrição', 'Valor']],
                body: receitasList.map(item => [item.categoria, item.descricao, formatCurrency(item.valor)]),
                theme: 'grid', headStyles: { fillColor: [16, 185, 129] },
                foot: [['TOTAL ENTRADAS', '', formatCurrency(rTotal)]], footStyles: { fillColor: [209, 250, 229], textColor: [4, 120, 87] }
            });

            let finalY = doc.lastAutoTable.finalY || 36;
            doc.text("SAÍDAS (Custos/Despesas e Comissões)", 14, finalY + 10);
            autoTable(doc, {
                startY: finalY + 14, head: [['Categoria', 'Favorecido / Descrição', 'Valor']],
                body: saidasList.map(item => [item.categoria, item.fornecedorServico || item.descricao, formatCurrency(item.valor)]),
                theme: 'grid', headStyles: { fillColor: [239, 68, 68] },
                foot: [['TOTAL SAÍDAS', '', formatCurrency(dTotalTabela)]], footStyles: { fillColor: [254, 226, 226], textColor: [185, 28, 28] }
            });

            finalY = doc.lastAutoTable.finalY || finalY + 14;
            doc.setFontSize(12);
            doc.setTextColor(15, 23, 42); 
            doc.text(`LUCRO BASE (Evento + Loja): ${formatCurrency(lucroBaseTotal)}`, 14, finalY + 15);
            doc.setTextColor(37, 99, 235);
            doc.text(`> Comissões Pagas aos Professores: ${formatCurrency(totalComissoes)}`, 14, finalY + 22);
            doc.setTextColor(4, 120, 87);
            doc.text(`> Lucro Caixa da Empresa (${percUnipower}%): ${formatCurrency(lucroEmpresa)}`, 14, finalY + 29);

            doc.save(`DRE_${workshopDetalhe.nome.replace(/\s+/g, '_')}.pdf`);
        } catch (error) { console.error("Erro no PDF:", error); alert("Erro ao gerar PDF do DRE."); }
    };

    const exportarExcel = () => {
        const wb = XLSX.utils.book_new();
        const wsReceitas = XLSX.utils.json_to_sheet(receitasList.map(item => ({ Categoria: item.categoria, Descricao: item.descricao, Valor: item.valor })));
        const wsSaidas = XLSX.utils.json_to_sheet(saidasList.map(item => ({ Categoria: item.categoria, Para: item.fornecedorServico, Descricao: item.descricao, Valor: item.valor })));
        XLSX.utils.book_append_sheet(wb, wsReceitas, "Entradas");
        XLSX.utils.book_append_sheet(wb, wsSaidas, "Saidas");
        XLSX.writeFile(wb, `DRE_${workshopDetalhe.nome.replace(/\s+/g, '_')}.xlsx`);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-hidden pointer-events-none">
            <div 
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px)`, 
                    resize: 'both', 
                    overflow: 'hidden',
                    width: '90vw', 
                    maxWidth: '1400px', 
                    height: '90vh',
                    minWidth: '320px',
                    minHeight: '500px'
                }}
                className="bg-slate-50 dark:bg-slate-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col pointer-events-auto"
            >
                
                {/* HEADER */}
                <div 
                    onMouseDown={handleMouseDown}
                    className="p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0 cursor-move"
                >
                    <div className="flex items-center gap-3">
                        <span className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Table className="w-6 h-6"/></span> 
                        <div>
                            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
                                Prestação de Contas
                            </h3>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded flex items-center gap-1 w-fit mt-1">
                                <Move className="w-3 h-3"/> Arraste a janela
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="hidden sm:flex gap-2 border-r border-slate-200 pr-4 mr-2">
                            <button onClick={gerarRecibo} className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-colors shadow-sm border border-blue-200"><FileSignature className="w-3 h-3"/> Gerar Recibo</button>
                            <button onClick={exportarPDF} className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition-colors shadow-sm"><Download className="w-3 h-3"/> DRE (PDF)</button>
                            <button onClick={exportarExcel} className="flex items-center gap-1 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100 transition-colors shadow-sm"><Download className="w-3 h-3"/> XLS</button>
                        </div>
                        <button onClick={() => { setWorkshopDetalhe(null); abrirModalNovaTransacao(); }} className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-900 transition-colors shadow-md">
                            <Plus className="w-3 h-3"/> Lançar
                        </button>
                        <button type="button" onClick={() => setWorkshopDetalhe(null)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><X className="w-6 h-6"/></button>
                    </div>
                </div>
                
                {/* CORPO DA PLANILHA */}
                <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-slate-200 dark:border-slate-700 rounded-t-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm flex-1">
                        
                        {/* RECEITAS */}
                        <div className="border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                            <div className="bg-emerald-500 text-white p-3 font-black uppercase tracking-widest text-center text-xs flex items-center justify-center gap-2 shrink-0"><ArrowUpRight className="w-4 h-4"/> Entradas (Receitas)</div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 bg-slate-50/30">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10"><tr><th className="p-3 font-black uppercase tracking-widest">Categoria</th><th className="p-3 font-black uppercase tracking-widest text-right">Valor</th><th className="p-3 text-center w-16"></th></tr></thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {receitasList.map(t => (
                                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                                                <td className="p-3"><p className={`font-bold uppercase ${t.isStock ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-white'}`}>{t.categoria}</p><p className="text-[10px] text-slate-400 mt-0.5">{t.descricao}</p></td>
                                                <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatCurrency(t.valor)}</td>
                                                <td className="p-3 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setWorkshopDetalhe(null); if(t.isStock){ const s = stockLedger.find(x=>x.id===t.id); if(s) abrirModalEditarStock(s); } else { const originalT = transacoes.find(x=>x.id===t.id); if(originalT) abrirModalEditarTransacao(originalT); } }} className="text-blue-500 hover:scale-110 mr-2"><Edit className="w-3.5 h-3.5"/></button>
                                                    <button onClick={() => { if(t.isStock) handleExcluirStock(t.id); else handleExcluirTransacao(t.id); }} className="text-red-500 hover:scale-110"><Trash2 className="w-3.5 h-3.5"/></button>
                                                </td>
                                            </tr>
                                        ))}
                                        {receitasList.length === 0 && <tr><td colSpan="3" className="p-6 text-center text-slate-300 font-bold uppercase text-[10px]">Sem registros</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 border-t border-emerald-200 dark:border-emerald-800 font-black flex justify-between items-center text-emerald-700 dark:text-emerald-400 shrink-0 mt-auto"><span className="uppercase tracking-widest text-[10px]">Total Entradas:</span><span className="text-lg">{formatCurrency(rTotal)}</span></div>
                        </div>

                        {/* SAÍDAS */}
                        <div className="flex flex-col overflow-hidden">
                            <div className="bg-red-500 text-white p-3 font-black uppercase tracking-widest text-center text-xs flex items-center justify-center gap-2 shrink-0"><ArrowDownRight className="w-4 h-4"/> Saídas (Custos e Repasses)</div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 bg-slate-50/30">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10"><tr><th className="p-3 font-black uppercase tracking-widest">Categoria</th><th className="p-3 font-black uppercase tracking-widest text-right">Valor</th><th className="p-3 text-center w-16"></th></tr></thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {saidasList.map(t => (
                                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                                                <td className="p-3">
                                                    <p className={`font-bold uppercase ${t.isStock ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>{t.categoria}</p>
                                                    <p className="text-[10px] text-slate-500 italic mt-0.5">{t.fornecedorServico}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{t.descricao}</p>
                                                </td>
                                                <td className={`p-3 text-right font-black whitespace-nowrap ${t.tipo === 'comissao' ? 'text-amber-600' : 'text-red-500'}`}>{formatCurrency(t.valor)}</td>
                                                <td className="p-3 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {t.id !== 'comissao-evento-auto' && (
                                                        <>
                                                            <button onClick={() => { setWorkshopDetalhe(null); if(t.isStock){ const s = stockLedger.find(x=>x.id===t.id); if(s) abrirModalEditarStock(s); } else { const originalT = transacoes.find(x=>x.id===t.id); if(originalT) abrirModalEditarTransacao(originalT); } }} className="text-blue-500 hover:scale-110 mr-2"><Edit className="w-3.5 h-3.5"/></button>
                                                            <button onClick={() => { if(t.isStock) handleExcluirStock(t.id); else handleExcluirTransacao(t.id); }} className="text-red-500 hover:scale-110"><Trash2 className="w-3.5 h-3.5"/></button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {saidasList.length === 0 && <tr><td colSpan="3" className="p-6 text-center text-slate-300 font-bold uppercase text-[10px]">Sem registros</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 border-t border-red-200 dark:border-red-800 font-black flex justify-between items-center text-red-700 dark:text-red-400 shrink-0 mt-auto"><span className="uppercase tracking-widest text-[10px]">Total Saídas:</span><span className="text-lg">{formatCurrency(dTotalTabela)}</span></div>
                        </div>
                    </div>

                    {/* PLACAR GIGANTE (SEMPRE FIXO NO FUNDO) */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                        <div className={`p-5 lg:p-6 rounded-b-2xl md:rounded-bl-2xl md:rounded-br-none border ${lucroBaseTotal >= 0 ? 'bg-slate-800 border-slate-900 text-white dark:bg-slate-900 dark:border-slate-800' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800'}`}>
                            <div className="flex items-center gap-3 mb-1">
                                <DollarSign className="w-5 h-5 opacity-70"/>
                                <span className="font-black uppercase tracking-widest text-xs">Lucro Base Total</span>
                            </div>
                            <span className="text-2xl lg:text-4xl font-black tracking-tighter block">{formatCurrency(lucroBaseTotal)}</span>
                            <div className="flex flex-wrap gap-2 mt-2 text-[9px] uppercase tracking-widest opacity-60 font-bold">
                                <span>Ev: {formatCurrency(lucroBaseEvento)}</span> | <span>Loja: {formatCurrency(lucroBaseCamisas)}</span>
                            </div>
                        </div>

                        <div className="p-5 lg:p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-none flex flex-col justify-center">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2"><UserCheck className="w-4 h-4"/><span className="font-black uppercase tracking-widest text-[10px]">Comissões (Parceiros)</span></div>
                            </div>
                            <span className="text-xl lg:text-2xl font-black tracking-tighter">{formatCurrency(totalComissoes)}</span>
                            <div className="flex gap-2 mt-1 text-[9px] uppercase tracking-widest opacity-70 font-bold">
                                <span>Ev: {percProfessores}%</span> | <span>Loja: {pctComissaoCamisas}%</span>
                            </div>
                        </div>

                        <div className="p-5 lg:p-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-b-2xl md:rounded-br-2xl md:rounded-bl-none flex flex-col justify-center">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2"><Building2 className="w-4 h-4"/><span className="font-black uppercase tracking-widest text-[10px]">Caixa da Empresa</span></div>
                            </div>
                            <span className="text-xl lg:text-2xl font-black tracking-tighter">{formatCurrency(lucroEmpresa)}</span>
                            <span className="text-[9px] uppercase tracking-widest opacity-70 font-bold mt-1">Lucro Livre ({percUnipower}% do Ev.)</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default memo(DREModal);