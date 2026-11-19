import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Janela padrão da aba Workshops (cabeçalho roxo, corpo que rola, rodapé com os botões). */
export default function ModalWorkshop({ titulo, largo, onClose, children, rodape }) {
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className={`bg-white dark:bg-slate-800 w-full ${largo ? 'max-w-5xl' : 'max-w-xl'} rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]`}>
        <div className="p-5 bg-red-600 text-white flex justify-between items-center shrink-0 gap-3">
          <h3 className="font-black uppercase tracking-widest text-sm">{titulo}</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/20 rounded-full" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">{children}</div>
        <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end items-center gap-3 bg-slate-50 dark:bg-slate-900 shrink-0 flex-wrap">{rodape}</div>
      </div>
    </div>,
    document.body,
  );
}
