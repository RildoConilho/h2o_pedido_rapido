// sw.js

// O NOME DO CACHE FOI ATUALIZADO AQUI PARA FORÇAR A ATUALIZAÇÃO EM TODOS OS DISPOSITIVOS
const CACHE_NAME = 'h2o-pedido-rapido-cache-v12'; 
const urlsToCache = [
    '.', // Representa a raiz, geralmente o index.html
    'index.html',
    'manifest.json',
    // Ícones
    'icones/android-launchericon-48-48.png',
    'icones/android-launchericon-72-72.png',
    'icones/android-launchericon-96-96.png',
    'icones/android-launchericon-144-144.png',
    'icones/android-launchericon-192-192.png',
    'icones/android-launchericon-512-512.png',
    'icones/apple-icon-180.png',
    // Imagem do logo
    'https://st4.depositphotos.com/20523700/25934/i/380/depositphotos_259345310-stock-photo-illustration-h2o-icon.jpg' 
];

self.addEventListener('install', event => {
    console.log(`[SW ${CACHE_NAME}] Evento de instalação.`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log(`[SW ${CACHE_NAME}] Cache aberto, cacheando URLs iniciais.`);
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log(`[SW ${CACHE_NAME}] Todos os arquivos foram cacheados com sucesso.`);
                self.skipWaiting();
            })
            .catch(error => {
                console.error(`[SW ${CACHE_NAME}] Falha ao cachear arquivos durante a instalação:`, error);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});

self.addEventListener('activate', event => {
    console.log(`[SW ${CACHE_NAME}] Evento de ativação.`);
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log(`[SW ${CACHE_NAME}] Deletando cache antigo:`, cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log(`[SW ${CACHE_NAME}] Service worker ativado e caches antigos limpos.`);
            return self.clients.claim(); 
        })
    );
});

// --- LÓGICA DO FIREBASE MESSAGING ---
try {
    importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

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
      console.log(`[SW ${CACHE_NAME}] Mensagem de fundo recebida: `, payload);
      const notificationTitle = payload.notification?.title || "H2O Pedido Rápido";
      const notificationOptions = {
        body: payload.notification?.body || "Você tem uma nova mensagem.",
        icon: payload.notification?.icon || '/icones/android-launchericon-192-192.png',
        data: {
            url: payload.data?.url || self.registration.scope 
        }
      };
      return self.registration.showNotification(notificationTitle, notificationOptions);
    });

} catch (e) {
    console.error(`[SW ${CACHE_NAME}] Erro ao inicializar Firebase:`, e);
}

// (O restante do seu código para notificações locais continua aqui)