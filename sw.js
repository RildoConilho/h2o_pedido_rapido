// sw.js
const CACHE_NAME = 'h2o-pedido-rapido-cache-v11';
const urlsToCache = [
    '.',
    'index.html',
    'manifest.json',
    'icones/android-launchericon-192-192.png',
    'icones/android-launchericon-512-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// --- LÓGICA DO FIREBASE MESSAGING ---
try {
    importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

    // *** SUA NOVA E CORRETA CONFIGURAÇÃO DO FIREBASE ***
    const firebaseConfig = {
      apiKey: "AIzaSyCMnkyno22KbzIj6prAXtfDW2iTFPl-n84",
      authDomain: "h2o-pedido-rapido-pwa.firebaseapp.com",
      projectId: "h2o-pedido-rapido-pwa",
      storageBucket: "h2o-pedido-rapido-pwa.firebasestorage.app",
      messagingSenderId: "878082690218",
      appId: "1:878082690218:web:0f31add4553cf816c714d3"
    };

    if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
    }
    
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log(`[SW] Mensagem de fundo recebida: `, payload);
      const notificationTitle = payload.notification?.title || "H2O Pedido Rápido";
      const notificationOptions = {
        body: payload.notification?.body || "Você tem uma nova mensagem.",
        icon: payload.notification?.icon || '/icones/android-launchericon-192-192.png'
      };
      return self.registration.showNotification(notificationTitle, notificationOptions);
    });

} catch (e) {
    console.error(`[SW] Erro ao inicializar Firebase:`, e);
}

// (O restante do seu código do sw.js para notificações locais continua aqui, sem alterações)