// Service worker mínimo: existe só para o navegador aceitar instalar o sistema como aplicativo.
// NÃO guarda telas nem dados em cache (o sistema muda toda hora); tudo continua vindo da internet.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
