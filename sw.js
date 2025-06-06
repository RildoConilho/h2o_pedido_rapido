// sw.js

// O NOME DO CACHE FOI ATUALIZADO PARA v14 PARA A VERSÃO FINAL E COMPLETA.
const CACHE_NAME = 'h2o-pedido-rapido-cache-v14'; 
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
            checkAndDisplayScheduledNotifications();
            return self.clients.claim(); 
        })
    );
});

// --- LÓGICA DO FIREBASE MESSAGING ---
try {
    importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

    // CONFIGURAÇÃO NOVA E CORRETA DO FIREBASE
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
        },
        actions: [ 
            { action: 'abrir_app', title: '💧 Pedir Água Agora' }
        ]
      };
      return self.registration.showNotification(notificationTitle, notificationOptions);
    });

    self.addEventListener('notificationclick', event => {
        console.log(`[SW ${CACHE_NAME}] Clique na notificação recebido: `, event);
        event.notification.close(); 
        const urlParaAbrir = event.notification.data?.url || self.registration.scope;
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url === urlParaAbrir && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlParaAbrir);
                }
            })
        );
    });
    console.log(`[SW ${CACHE_NAME}] Manipuladores de mensagem e clique configurados.`);

} catch (e) {
    console.error(`[SW ${CACHE_NAME}] Erro ao inicializar Firebase:`, e);
}


// --- LÓGICA DE AGENDAMENTO DE NOTIFICAÇÕES LOCAIS (CLIENT-SIDE) ---
const DB_NAME = 'h2o-app-db';
const DB_VERSION = 1;
const STORE_NAME = 'scheduled-notifications';

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        };
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

async function addScheduledNotification(notificationData) {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.add(notificationData);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getScheduledNotifications() {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteScheduledNotification(id) {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

self.addEventListener('message', async event => {
    if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
        const { delayInSeconds, title, body, tag, url } = event.data;
        const scheduledTime = Date.now() + (delayInSeconds * 1000);
        const notificationData = { title, body, icon: '/icones/android-launchericon-192-192.png', tag, data: { url: url || self.registration.scope }, scheduledTime };
        await addScheduledNotification(notificationData);
        if ('periodicSync' in self.registration) {
            try {
                await self.registration.periodicSync.register('check-water-reminder', { minInterval: 24 * 60 * 60 * 1000 });
            } catch (e) { console.warn('[SW] Periodic Background Sync não pôde ser registrado:', e); }
        }
    } else if (event.data && event.data.type === 'CANCEL_ALL_REMINDERS') {
        const db = await openDb();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).clear();
        if ('periodicSync' in self.registration) {
             try { await self.registration.periodicSync.unregister('check-water-reminder'); } catch (e) { console.warn('[SW] Erro ao desregistrar Periodic Background Sync:', e); }
        }
    }
});

async function checkAndDisplayScheduledNotifications() {
    const notifications = await getScheduledNotifications();
    const now = Date.now();
    for (const notif of notifications) {
        if (now >= notif.scheduledTime) {
            await self.registration.showNotification(notif.title, { body: notif.body, icon: notif.icon, tag: notif.tag, data: notif.data, actions: [{ action: 'abrir_app', title: '💧 Pedir Água Agora' }] });
            await deleteScheduledNotification(notif.id);
        }
    }
}

self.addEventListener('periodicsync', event => {
    if (event.tag === 'check-water-reminder') {
        event.waitUntil(checkAndDisplayScheduledNotifications());
    }
});