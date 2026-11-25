// Avisos (notificações) no celular e no computador.
// A pessoa liga UMA vez (toque no botão); o aparelho ganha um "endereço" (token) guardado em push_aparelhos/{uid}_{id}.
// Quem envia é o servidor (api/enviar-aviso.js), só para o admin. Aqui ficam: estado, ativar e o pedido de envio.
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, auth, db } from "./firebase";
import { VAPID_KEY } from "../config/push";

export const ehIphone = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
export const appInstalado = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

/** Estados: preparando | sem-suporte | instalar-iphone | bloqueado | desligado | ligado */
export async function estadoDosAvisos() {
  if (!VAPID_KEY) return "preparando";
  if (ehIphone() && !appInstalado()) return "instalar-iphone";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "sem-suporte";
  try {
    const { isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return "sem-suporte";
  } catch { return "sem-suporte"; }
  if (Notification.permission === "denied") return "bloqueado";
  return Notification.permission === "granted" ? "ligado" : "desligado";
}

// id curto e fixo para o mesmo aparelho (o mesmo token sempre cai no mesmo documento)
async function idDoToken(token) {
  const bytes = new TextEncoder().encode(token);
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(h)).slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function pegarToken() {
  const { getMessaging, getToken } = await import("firebase/messaging");
  const registro = (await navigator.serviceWorker.getRegistration("/sw.js")) || (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
}

async function guardarAparelho(uid, token) {
  const id = `${uid}_${await idDoToken(token)}`;
  const plataforma = ehIphone() ? "iphone" : /android/i.test(navigator.userAgent) ? "android" : "computador";
  await setDoc(doc(db, "push_aparelhos", id), { uid, token, plataforma, atualizadoEm: serverTimestamp() });
}

/** Chamar SÓ por toque do usuário (o navegador exige). Devolve o novo estado. */
export async function ativarAvisos(uid) {
  const estado = await estadoDosAvisos();
  if (estado !== "desligado" && estado !== "ligado") return estado;
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied" ? "bloqueado" : "desligado";
  const token = await pegarToken();
  if (!token) throw new Error("Não foi possível ligar os avisos neste aparelho.");
  await guardarAparelho(uid, token);
  return "ligado";
}

/** Quem já deu permissão: renova o endereço do aparelho em silêncio ao entrar (o token pode mudar). */
export async function renovarAparelho(uid) {
  if ((await estadoDosAvisos()) !== "ligado") return;
  const token = await pegarToken();
  if (token) await guardarAparelho(uid, token);
}

// Para o botão "sair": solta o endereço deste aparelho da conta que está saindo (outra pessoa pode entrar no mesmo aparelho).
export async function soltarAparelho(uid) {
  if ((await estadoDosAvisos()) !== "ligado") return;
  const token = await pegarToken();
  if (token) await deleteDoc(doc(db, "push_aparelhos", `${uid}_${await idDoToken(token)}`));
}

/** Pede ao servidor (só admin). Com somenteContar devolve quantas pessoas/aparelhos receberiam. */
export async function pedirEnvioDeAviso(corpo) {
  const idToken = await auth.currentUser?.getIdToken();
  const r = await fetch("/api/enviar-aviso", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(corpo),
  });
  let dados = {};
  try { dados = await r.json(); } catch { /* resposta sem corpo */ }
  if (!r.ok) {
    const e = new Error(dados.erro || "Não foi possível enviar agora.");
    e.dados = dados;
    throw e;
  }
  return dados;
}
