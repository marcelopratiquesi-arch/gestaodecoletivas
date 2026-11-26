// Pedacinho técnico mostrado no fim da mensagem de erro de salvar (ex.: " (cadastro: permission-denied)"),
// para o administrador saber EM QUE PARTE o salvamento falhou. Nunca leva dado pessoal: só o nome do passo e o código.
const NOMES = { contato: "contato", documento: "documento", cadastro: "cadastro", nascimento: "nascimento" };

export function detalheDoErro(err) {
  const etapa = NOMES[err?.etapa] || "";
  const codigo = String(err?.code || "").replace(/^firestore\//, "") || (err?.message === "DOCUMENTO_EM_USO" ? "documento-em-uso" : "");
  if (!etapa && !codigo) return "";
  return ` (${[etapa, codigo].filter(Boolean).join(": ")})`;
}
