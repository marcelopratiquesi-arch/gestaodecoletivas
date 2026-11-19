import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Pop-up flutuante: sem fundo escuro (a tela de trás continua visível e clicável), arrastável pela barra de título,
// redimensionável pelo canto, fecha com Esc. Tamanho e posição ficam lembrados no navegador (chaveMemoria).
// No celular (tela estreita) vira tela cheia, sem arrastar nem redimensionar.

const LARGURA_CELULAR = 768;
const MARGEM = 8;

const lerMemoria = (chave) => {
  if (!chave) return null;
  try {
    const bruto = JSON.parse(localStorage.getItem(chave) || 'null');
    if (bruto && [bruto.x, bruto.y, bruto.w, bruto.h].every(Number.isFinite)) return bruto;
  } catch { /* sem memória: usa o padrão */ }
  return null;
};

const gravarMemoria = (chave, valor) => {
  if (!chave) return;
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* navegador bloqueou: tudo bem */ }
};

const limitar = (caixa, minW, minH) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(Math.max(caixa.w, minW), vw - MARGEM * 2);
  const h = Math.min(Math.max(caixa.h, minH), vh - MARGEM * 2);
  const x = Math.min(Math.max(caixa.x, MARGEM), vw - w - MARGEM);
  const y = Math.min(Math.max(caixa.y, MARGEM), vh - h - MARGEM);
  return { x, y, w, h };
};

const caixaPadrao = (largura, altura) => {
  const w = Math.min(largura, window.innerWidth - MARGEM * 2);
  const h = Math.min(altura, window.innerHeight - 110);
  return { w, h, x: Math.max(MARGEM, window.innerWidth - w - 32), y: 16 };
};

export default function PopupFlutuante({
  titulo, onFechar, children, rodape, chaveMemoria, bloquearFechar = false,
  largura = 480, altura = 720, larguraMinima = 360, alturaMinima = 380, rotuloFechar = 'Fechar',
}) {
  const [celular, setCelular] = useState(() => window.innerWidth < LARGURA_CELULAR);
  const [caixa, setCaixa] = useState(() => limitar(lerMemoria(chaveMemoria) || caixaPadrao(largura, altura), larguraMinima, alturaMinima));
  const caixaRef = useRef(caixa);
  useEffect(() => { caixaRef.current = caixa; }, [caixa]);
  const gesto = useRef(null);

  // Esc fecha
  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape' && !bloquearFechar) onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar, bloquearFechar]);

  // Janela mudou de tamanho: mantém o pop-up dentro da tela
  useEffect(() => {
    const aoRedimensionar = () => {
      setCelular(window.innerWidth < LARGURA_CELULAR);
      setCaixa((c) => limitar(c, larguraMinima, alturaMinima));
    };
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, [larguraMinima, alturaMinima]);

  const iniciar = (tipo) => (e) => {
    if (celular || e.button !== 0) return;
    if (tipo === 'mover' && e.target.closest('button')) return;
    e.preventDefault();
    gesto.current = { tipo, px: e.clientX, py: e.clientY, inicio: { ...caixaRef.current } };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const mover = (e) => {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.px;
    const dy = e.clientY - g.py;
    setCaixa(g.tipo === 'mover'
      ? limitar({ ...g.inicio, x: g.inicio.x + dx, y: g.inicio.y + dy }, larguraMinima, alturaMinima)
      : limitar({ ...g.inicio, w: g.inicio.w + dx, h: g.inicio.h + dy }, larguraMinima, alturaMinima));
  };

  const soltar = () => {
    if (!gesto.current) return;
    gesto.current = null;
    gravarMemoria(chaveMemoria, caixaRef.current);
  };

  const estilo = celular ? undefined : { left: caixa.x, top: caixa.y, width: caixa.w, height: caixa.h };

  return (
    <div
      role="dialog"
      aria-label={titulo}
      style={estilo}
      className={`fixed z-[60] flex flex-col bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl overflow-hidden ${celular ? 'inset-0' : 'rounded-2xl'}`}
    >
      <div
        onPointerDown={iniciar('mover')} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
        className={`px-5 py-3.5 flex justify-between items-center bg-gradient-to-r from-red-600 to-red-700 shrink-0 select-none touch-none ${celular ? '' : 'cursor-move'}`}
      >
        <h3 className="font-black text-base text-white uppercase tracking-tight">{titulo}</h3>
        <button type="button" onClick={() => !bloquearFechar && onFechar()} disabled={bloquearFechar} aria-label={rotuloFechar} title={`${rotuloFechar} (Esc)`} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
      </div>

      {rodape && <div className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5">{rodape}</div>}

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar uppercase">{children}</div>

      {!celular && (
        <div
          onPointerDown={iniciar('redimensionar')} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
          aria-hidden="true"
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize touch-none"
          style={{ background: 'linear-gradient(135deg, transparent 55%, rgb(148 163 184) 55%, rgb(148 163 184) 62%, transparent 62%, transparent 72%, rgb(148 163 184) 72%, rgb(148 163 184) 79%, transparent 79%)' }}
        />
      )}
    </div>
  );
}
