// Valores gravados no banco (em português) -> chave em locales/<idioma>/shop.json.
// O banco continua igual; só o texto exibido é traduzido.
import i18n from '../../i18n';

const CATEGORIAS = {
  'Inscrições (Sympla)': 'signups',
  'Patrocínio': 'sponsorship',
  'Outra Receita': 'otherIncome',
  'Taxa Sympla': 'symplaFee',
  'Coffee Break / Lanche': 'coffee',
  'Staff / Equipe de Apoio': 'staff',
  'Aluguel (Cadeiras/Equipamentos)': 'rental',
  'Estrutura / Som': 'structure',
  'Gestão e Logística': 'logistics',
  'Outra Despesa': 'otherExpense',
  'Comissão de Camisas (%)': 'shirtCommission',
  'Comissão Extra / Outros (%)': 'extraCommission',
  '[ESTOQUE] Venda de Camisas': 'shirtSale',
  '[ESTOQUE] Compra de Camisas': 'shirtPurchase',
  'Repasse Professores (Evento)': 'teacherPayout',
};

export const MOTIVOS_SAIDA = {
  'Venda': 'sale',
  'Cortesia / Doação': 'courtesy',
  'Defeito de Fábrica': 'defect',
  'Uso Interno': 'internal',
  'Outros': 'other',
};

export const traduzirCategoria = (categoria) =>
  CATEGORIAS[categoria] ? i18n.t(`shop.categories.${CATEGORIAS[categoria]}`) : (categoria || '');

export const traduzirMotivoSaida = (motivo) =>
  MOTIVOS_SAIDA[motivo] ? i18n.t(`shop.exitReasons.${MOTIVOS_SAIDA[motivo]}`) : (motivo || '');

export const traduzirTipoEvento = (tipo) => i18n.t(`shop.eventTypes.${tipo || 'Workshop'}`, tipo || 'Workshop');
