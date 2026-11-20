// Foto de certificado (ou PDF, que vira imagem da 1ª página): reduz a imagem no próprio aparelho e devolve um JPEG em texto base64 ("data:image/jpeg;base64,...").
// O plano gratuito do Firebase não tem Storage, então a foto vai dentro do documento do Firestore (limite de 1 MiB);
// por isso o alvo é caber em ~600 mil caracteres (o banco aceita até 700 mil, ver regra certificados_professor).
export const LIMITE_FOTO = 600000;
export const LIMITE_FOTO_BANCO = 700000;
const LADOS = [1600, 1400, 1200, 1000, 800];
const QUALIDADES = [0.8, 0.7, 0.6, 0.5, 0.4];

export const ehFotoJpegValida = (s) =>
  typeof s === "string" && s.startsWith("data:image/jpeg;base64,") && s.length >= 200 && s.length <= LIMITE_FOTO_BANCO;

// Data no formato AAAA-MM-DD, existente, de 2000 em diante e que não seja no futuro.
export function dataDoWorkshopValida(texto, hoje = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto || ""));
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (ano < 2000) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return false;
  const limite = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return d.getTime() <= limite;
}

const carregarImagem = (arquivo) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(arquivo);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("IMAGEM_INVALIDA")); };
  img.src = url;
});

const ehPdf = (arquivo) => String(arquivo?.type || "") === "application/pdf" || /\.pdf$/i.test(String(arquivo?.name || ""));

// PDF: desenha a 1ª página numa imagem (o leitor de PDF só é baixado quando alguém escolhe um PDF).
async function pdfParaImagem(arquivo) {
  const [pdfjs, { default: worker }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  try {
    const pagina = await pdf.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: LADOS[0] / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  } finally { pdf.destroy(); }
}

/** Foto (JPG, PNG, print) ou PDF do certificado -> JPEG em base64 (data URL) que cabe no limite.
 * @param {File} arquivo @returns {Promise<string>} */
export async function comprimirImagem(arquivo) {
  const pdf = ehPdf(arquivo);
  if (!arquivo || (!pdf && !String(arquivo.type || "").startsWith("image/"))) throw new Error("NAO_E_IMAGEM");
  let img;
  if (pdf) {
    try { img = await pdfParaImagem(arquivo); } catch (e) { console.error(e); throw new Error("PDF_INVALIDO"); }
  } else img = await carregarImagem(arquivo);
  for (const lado of LADOS) {
    const escala = Math.min(1, lado / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * escala));
    canvas.height = Math.max(1, Math.round(img.height * escala));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // PNG com fundo transparente não pode ficar preto no JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of QUALIDADES) {
      const saida = canvas.toDataURL("image/jpeg", q);
      if (saida.length <= LIMITE_FOTO) return saida;
    }
  }
  throw new Error("FOTO_GRANDE_DEMAIS");
}
