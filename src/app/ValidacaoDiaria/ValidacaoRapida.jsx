// Peças compartilhadas pelo cartão (pilhas) e pela linha (lista) da Validação Diária:
// - estadoDaAula (estadoDaAula.js): o que aquela aula permite agora
// - ValidacaoRapida: [−] número [+] [Validar] com sugestão da média e alerta de número fora do normal.
import React, { useState } from 'react';
import { CircleCheck, Minus, Plus, Loader2, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LIMITE_ALUNOS } from '../../utils/validacoes';
import { numeroEstranho } from '../../hooks/useMediaAlunos';


// Só dígitos, até 3 casas (o teto de alunos é conferido ao salvar).
const soDigitos = (valor) => String(valor || '').replace(/\D/g, '').slice(0, 3);

export function ValidacaoRapida({ item, onValidarRapido, salvando, compacto = false }) {
    const { t } = useTranslation();
    const media = item.mediaAlunos;
    const [valorDigitado, setValorDigitado] = useState(null); // null = ainda não mexeu (usa a sugestão)
    const valorTela = valorDigitado ?? (media ? String(media.media) : '');
    const numeroTela = valorTela === '' ? null : parseInt(valorTela, 10);
    const ajustar = (delta) => setValorDigitado(String(Math.min(LIMITE_ALUNOS, Math.max(0, (numeroTela ?? 0) + delta))));
    const foraDoNormal = numeroTela !== null && numeroTela > 0 && numeroEstranho(numeroTela, media);
    const validar = () => onValidarRapido(item, valorTela);

    const botaoAjuste = compacto ? 'w-9' : 'w-11';
    return (
        <div className={compacto ? 'space-y-1' : 'space-y-2'}>
            {!compacto && <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('dailyValidation.quick.howMany')}</label>}
            <div className="flex items-stretch gap-2">
                <div className="flex items-stretch rounded-xl border-2 border-slate-200 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-900 focus-within:border-emerald-500 transition-colors">
                    <button type="button" onClick={() => ajustar(-1)} disabled={salvando} aria-label={t('dailyValidation.quick.less')} className={`${botaoAjuste} flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 transition-colors`}>
                        <Minus className="w-4 h-4"/>
                    </button>
                    <input
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        value={valorTela}
                        onChange={(e) => setValorDigitado(soDigitos(e.target.value))}
                        onKeyDown={(e) => { if (e.key === 'Enter') validar(); }}
                        placeholder="0"
                        aria-label={t('dailyValidation.quick.howMany')}
                        className={`${compacto ? 'w-11 text-base' : 'w-14 text-xl'} text-center font-black text-slate-800 dark:text-white bg-transparent outline-none placeholder:text-slate-300`}
                    />
                    <button type="button" onClick={() => ajustar(1)} disabled={salvando} aria-label={t('dailyValidation.quick.more')} className={`${botaoAjuste} flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 transition-colors`}>
                        <Plus className="w-4 h-4"/>
                    </button>
                </div>
                <button
                    type="button"
                    onClick={validar}
                    disabled={salvando || valorTela === ''}
                    className={`${compacto ? 'px-3 min-h-[40px]' : 'flex-1 min-h-[48px]'} rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-500/30 flex items-center justify-center gap-1.5 transition-all active:scale-95`}
                >
                    {salvando ? <Loader2 className="w-4 h-4 animate-spin"/> : <CircleCheck className="w-4 h-4"/>} {t('dailyValidation.card.validate')}
                </button>
            </div>

            {foraDoNormal ? (
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <TriangleAlert className="w-3.5 h-3.5 shrink-0"/> {t('dailyValidation.quick.unusualHint', { media: media.media })}
                </p>
            ) : media && valorDigitado === null && !compacto ? (
                <p className="text-[11px] text-slate-400">{t('dailyValidation.quick.suggestionHint', { media: media.media, amostras: media.amostras })}</p>
            ) : null}
        </div>
    );
}
