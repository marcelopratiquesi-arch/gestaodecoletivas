import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Faixa "Nova versão disponível". Confere /versao.json a cada 5 minutos e ao voltar para a aba.
// NÃO recarrega sozinho: quem está no meio de uma validação não perde o que digitou.
const INTERVALO_MS = 5 * 60 * 1000;

export default function AvisoNovaVersao() {
    const { t } = useTranslation();
    const [temNova, setTemNova] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line no-undef
        const versaoAtual = typeof __ID_DA_VERSAO__ !== 'undefined' ? __ID_DA_VERSAO__ : null;
        if (!versaoAtual) return;

        let ativo = true;
        const conferir = async () => {
            try {
                const resp = await fetch(`/versao.json?t=${Date.now()}`, { cache: 'no-store' });
                if (!resp.ok) return;
                // No servidor, páginas inexistentes devolvem o index.html; só vale JSON de verdade.
                const dados = await resp.json();
                if (ativo && dados?.versao && dados.versao !== versaoAtual) setTemNova(true);
            } catch {
                // sem internet ou arquivo ausente: não incomoda o usuário
            }
        };

        const timer = setInterval(conferir, INTERVALO_MS);
        const aoVoltar = () => { if (document.visibilityState === 'visible') conferir(); };
        document.addEventListener('visibilitychange', aoVoltar);
        return () => {
            ativo = false;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', aoVoltar);
        };
    }, []);

    if (!temNova) return null;

    return (
        <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl border border-slate-700 max-w-[calc(100vw-2rem)]">
            <RefreshCw size={16} className="shrink-0 text-emerald-400" />
            <span>{t('updateNotice.mensagem')}</span>
            <button
                type="button"
                onClick={() => window.location.reload()}
                className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 transition-colors"
            >
                {t('updateNotice.botao')}
            </button>
        </div>
    );
}
