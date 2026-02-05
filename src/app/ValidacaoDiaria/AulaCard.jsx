import React from 'react';
import { 
  Calendar, Clock, MapPin, User, ArrowRightLeft, 
  CircleCheck, CircleX, TriangleAlert, Lock 
} from 'lucide-react';

// Helpers internos para formatação visual
const formatDateBr = (dateStr) => {
  if(!dateStr) return "-";
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

// Componente Badge (interno do Card)
const StatusBadge = ({ status }) => {
    if (status === 'realizada') {
        return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm">
                <CircleCheck className="w-3 h-3 flex-shrink-0" /> <span>Realizada</span>
            </div>
        );
    }
    if (status === 'cancelada') {
        return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-rose-100 text-rose-700 border border-rose-200 shadow-sm">
                <CircleX className="w-3 h-3 flex-shrink-0" /> <span>Cancelada</span>
            </div>
        );
    }
    return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">
            <TriangleAlert className="w-3 h-3 flex-shrink-0" /> <span>Pendente</span>
        </div>
    );
};

export function AulaCard({ item, onValidar, onCancelar, verificarFuturo }) {
    const isFuture = verificarFuturo(item.data);
    const status = item.status; 
    const isSub = item.professor?.isSubstituto;

    return (
        <div className="group bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            {/* Barra Colorida no Topo */}
            <div className={`absolute top-0 left-0 w-full h-1.5 ${status === 'realizada' ? 'bg-emerald-500' : status === 'cancelada' ? 'bg-rose-500' : 'bg-amber-400'}`}></div>

            {/* Cabeçalho do Card */}
            <div className="flex justify-between items-start mb-4 pt-2">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1">
                        <Calendar className="w-3 h-3"/> {item.diaSemana}, {formatDateBr(item.data)}
                    </span>
                    <h3 className="font-black text-lg text-slate-800 dark:text-white leading-tight">{item.modalidade?.nome}</h3>
                </div>
                <div className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg text-sm font-mono font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                    <Clock className="w-3.5 h-3.5 text-emerald-500"/> {item.aulaBase.hora}
                </div>
            </div>

            {/* Detalhes (Local e Professor) */}
            <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-400 border border-slate-100 dark:border-slate-600">
                        <MapPin className="w-4 h-4"/>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Unidade</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{item.unidade?.nome}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isSub ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 border-slate-100 dark:border-slate-600'}`}>
                        {isSub ? <ArrowRightLeft className="w-4 h-4"/> : <User className="w-4 h-4"/>}
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase flex justify-between items-center">
                            Professor 
                            {isSub && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 rounded font-black tracking-wide">SUBSTITUTO</span>}
                        </p>
                        <div className="flex flex-col">
                            {isSub && (
                                <span className="text-[10px] text-slate-400 line-through decoration-red-400 decoration-2">
                                    {item.professorTitular?.nome}
                                </span>
                            )}
                            <p className={`text-sm font-bold truncate max-w-[200px] ${isSub ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                {item.professor?.nome || "Sem Professor"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Barra de Status e Info Extra */}
            <div className="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <StatusBadge status={status} />
                
                {status === 'realizada' && (
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5"/> {item.validacao?.alunos} Alunos
                    </div>
                )}
                {status === 'cancelada' && (
                    <div className="text-[10px] font-bold text-rose-600 max-w-[100px] truncate text-right" title={item.validacao?.motivoCancelamento}>
                        {item.validacao?.motivoCancelamento || "Recesso"}
                    </div>
                )}
            </div>

            {/* Botões de Ação */}
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => onValidar(item)} 
                    disabled={isFuture || status === 'cancelada'}
                    className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                    ${status === 'realizada' 
                        ? 'bg-white border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50' 
                        : (isFuture || status === 'cancelada')
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 hover:shadow-emerald-500/40 hover:-translate-y-0.5'}`}
                >
                    {status === 'realizada' ? 'Editar' : 'Validar'}
                </button>

                <button 
                    onClick={() => onCancelar(item)} 
                    disabled={isFuture} 
                    className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                    ${status === 'cancelada' 
                        ? 'bg-white text-rose-600 border-2 border-rose-500 hover:bg-rose-50' 
                        : isFuture 
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            : 'bg-white text-rose-500 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600'}`}
                >
                    {status === 'cancelada' ? 'Detalhes' : 'Cancelar'}
                </button>
            </div>

            {/* Overlay de Bloqueio (Futuro) */}
            {isFuture && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-xl border border-slate-200 dark:border-slate-600 flex items-center gap-2">
                        <Lock className="w-3 h-3 text-slate-400"/>
                        <span className="text-xs font-bold text-slate-500">Aguarde a data</span>
                    </div>
                </div>
            )}
        </div>
    );
}