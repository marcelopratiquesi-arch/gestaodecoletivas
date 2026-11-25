// Service worker: (1) deixa o navegador aceitar instalar o sistema como aplicativo e (2) mostra os AVISOS do administrador.
// NÃO guarda telas nem dados em cache (o sistema muda toda hora); tudo continua vindo da internet.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// Chegou um aviso (o servidor manda só titulo, texto e link).
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data?.json() || {}; } catch { d = {}; }
  const dados = d.data || d; // o Firebase entrega os campos dentro de "data"
  const titulo = dados.titulo || "Coletivas Pratique";
  e.waitUntil(self.registration.showNotification(titulo, {
    body: dados.texto || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { link: dados.link || "/app" },
  }));
});

// Tocou no aviso: abre (ou traz para frente) o sistema na tela do link.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data?.link || "/app", self.location.origin).href;
  e.waitUntil((async () => {
    const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const aba of abas) {
      if (new URL(aba.url).origin === self.location.origin && "focus" in aba) {
        await aba.focus();
        if ("navigate" in aba) await aba.navigate(destino).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(destino);
  })());
});
