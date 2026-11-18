import { useTranslation } from 'react-i18next';
import { variacao } from '../contasUnidade';

// ▲ verde / ▼ vermelho ao lado do número, comparando com as mesmas datas do mês passado.
// Sem base de comparação (ou sem mudança) não mostra nada.
// `inverter`: para números em que subir é ruim (ex.: gasto), a seta que sobe fica vermelha.
export default function Variacao({ atual, anterior, inverter = false }) {
  const { t } = useTranslation();
  const v = variacao(atual, anterior);
  if (!v || v.direcao === 'igual') return null;
  const sobe = v.direcao === 'sobe';
  const bom = inverter ? !sobe : sobe;
  return (
    <span
      title={t('centrais.comparacao')}
      className={`text-[10px] font-extrabold whitespace-nowrap ${bom ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
    >
      {sobe ? '▲' : '▼'} {v.percentual}%
    </span>
  );
}
