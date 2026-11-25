import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

// Faixa "Instalar aplicativo" (só no celular, só quando ainda não está instalado).
// Android/Chrome: botão instala direto. iPhone: mostra o passo a passo (Compartilhar > Adicionar à Tela de Início).
const CHAVE = 'instalarAppDispensadoEm';
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

const jaInstalado = () =>
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const ehIphone = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const ehCelular = () => window.matchMedia?.('(max-width: 767px)').matches;

const foiDispensado = () => {
    try { return Date.now() - (Number(localStorage.getItem(CHAVE)) || 0) < SEMANA_MS; } catch { return false; }
};

export default function BotaoInstalar() {
    const [evento, setEvento] = useState(null);
    const [mostrar, setMostrar] = useState(() => ehIphone() && ehCelular() && !jaInstalado() && !foiDispensado()); // o iPhone não avisa sozinho
    const [ajudaIphone, setAjudaIphone] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
        if (jaInstalado() || !ehCelular() || foiDispensado()) return;

        const aoOferecer = (e) => { e.preventDefault(); setEvento(e); setMostrar(true); };
        const aoInstalar = () => setMostrar(false);
        window.addEventListener('beforeinstallprompt', aoOferecer);
        window.addEventListener('appinstalled', aoInstalar);
        return () => {
            window.removeEventListener('beforeinstallprompt', aoOferecer);
            window.removeEventListener('appinstalled', aoInstalar);
        };
    }, []);

    const dispensar = () => {
        try { localStorage.setItem(CHAVE, String(Date.now())); } catch { /* sem armazenamento */ }
        setMostrar(false);
    };

    const instalar = async () => {
        if (evento) {
            evento.prompt();
            await evento.userChoice.catch(() => {});
            setEvento(null);
            setMostrar(false);
        } else {
            setAjudaIphone(true);
        }
    };

    if (!mostrar) return null;

    return (
        <div role="dialog" className="fixed top-0 inset-x-0 z-[9998] bg-red-600 text-white px-4 py-2.5 shadow-lg">
            <div className="flex items-center gap-3">
                <Download size={18} className="shrink-0" />
                <span className="flex-1 text-xs font-bold uppercase">Instale o Coletivas Pratique no seu celular</span>
                <button type="button" onClick={instalar} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-black uppercase text-red-600">
                    Instalar
                </button>
                <button type="button" onClick={dispensar} aria-label="Agora não" className="shrink-0 p-1">
                    <X size={18} />
                </button>
            </div>
            {ajudaIphone && (
                <p className="mt-2 flex items-center gap-1 text-[11px] font-bold normal-case">
                    No iPhone: toque em <Share size={14} className="inline" /> Compartilhar e depois em "Adicionar à Tela de Início".
                </p>
            )}
        </div>
    );
}
