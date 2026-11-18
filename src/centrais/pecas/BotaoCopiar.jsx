import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Botãozinho de copiar: o ícone vira ✓ verde por um instante.
export default function BotaoCopiar({ valor }) {
  const { t } = useTranslation();
  const [copiado, setCopiado] = useState(false);
  if (!valor) return null;

  const copiar = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(valor));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch (erro) {
      console.error('Não foi possível copiar:', erro);
    }
  };

  const rotulo = copiado ? t('centrais.copiado') : t('centrais.copiar');
  return (
    <button
      type="button"
      onClick={copiar}
      title={rotulo}
      aria-label={rotulo}
      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors shrink-0"
    >
      {copiado ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}
