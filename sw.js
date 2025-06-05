// sw.js

// Nome do cache ATUALIZADO para forçar a atualização.
// Sempre altere este nome quando fizer mudanças significativas no Service Worker para garantir que os usuários recebam a nova versão.
const CACHE_NAME = 'h2o-pedido-rapido-cache-v11'; // Cache name incrementado para forçar a atualização
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
    // Imagem do logo (se usada diretamente no index.html)
    'https://st4.depositphotos.com/20523700/25934/i/380/depositphotos_259345310-stock-photo-illustration-h2o-icon.jpg' 
];

self.addEventListener('install', event => {
    console.log(`[SW ${CACHE_NAME}] Evento de instalação.`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log(`[SW ${CACHE_NAME}] Cache aberto, cacheando URLs iniciais:`, CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log(`[SW ${CACHE_NAME}] Todos os arquivos foram cacheados com sucesso.`);
                self.skipWaiting(); // Força a ativação do novo SW imediatamente
            })
            .catch(error => {
                console.error(`[SW ${CACHE_NAME}] Falha ao cachear arquivos durante a instalação. Verifique se todos os URLs em urlsToCache são válidos. Erro:`, error);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request).catch(error => {
                    console.warn(`[SW ${CACHE_NAME}] Fetch falhou, provavelmente offline ou recurso não cacheado:`, event.request.url, error);
                });
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

// --- INÍCIO DA LÓGICA DO FIREBASE MESSAGING ---
try {
    // Importe e inicialize o SDK do Firebase
    // As versões DEVE SER AS MESMAS do seu index.html
    importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

    // SUAS CONFIGURAÇÕES DO FIREBASE AQUI
    const firebaseConfig = {
      apiKey: "AIzaSyCicQdcV7crJVSbVUX_OK5yNEO0ZjIg11Y",
      authDomain: "h2o-pedido-rapido-pwa.firebaseapp.com",
      projectId: "h2o-pedido-rapido-pwa",
      storageBucket: "h2o-pedido-rapido-pwa.firebasestorage.app",
      messagingSenderId: "878082690218",
      appId: "1:878082690218:web:e49ecc3154d570b5c714d3"
    };

    if (firebase.apps.length === 0) { 
        firebase.initializeApp(firebaseConfig);
        console.log(`[SW ${CACHE_NAME}] Firebase App inicializado no Service Worker.`);
    }
    
    const messaging = firebase.messaging();
    console.log(`[SW ${CACHE_NAME}] Firebase Messaging inicializado no Service Worker.`);

    // Lida com mensagens de push que chegam quando o app está em segundo plano ou fechado
    messaging.onBackgroundMessage((payload) => {
      console.log(`[SW ${CACHE_NAME}] Mensagem de fundo recebida: `, payload);
      
      const notificationTitle = payload.notification?.title || "H2O Pedido Rápido";
      const notificationOptions = {
        body: payload.notification?.body || "Você tem uma nova mensagem.",
        icon: payload.notification?.icon || '/icones/android-launchericon-192-192.png', // Ícone padrão
        data: {
            url: payload.data?.url || self.registration.scope 
        },
        actions: [ 
            { action: 'abrir_app', title: '💧 Pedir Água Agora' }
        ]
      };
      
      if (payload.data && payload.data.actions) {
          try {
              const actionsFromServer = JSON.parse(payload.data.actions);
              if (Array.isArray(actionsFromServer) && actionsFromServer.length > 0) {
                notificationOptions.actions = actionsFromServer;
              }
          } catch (e) {
              console.error(`[SW ${CACHE_NAME}] Erro ao parsear actions do payload: `, e);
          }
      }

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });

    self.addEventListener('notificationclick', event => {
        console.log(`[SW ${CACHE_NAME}] Clique na notificação recebido: `, event);
        event.notification.close(); 

        const urlParaAbrir = event.notification.data && event.notification.data.url ? event.notification.data.url : self.registration.scope;
        
        console.log(`[SW ${CACHE_NAME}] Ação do clique: ${event.action}. URL para abrir: ${urlParaAbrir}`);
        
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    // Se o PWA já estiver aberto e visível, foca nele
                    if (client.url === urlParaAbrir && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Se não estiver aberto, ou se não conseguiu focar, abre uma nova janela/aba
                if (clients.openWindow) {
                    return clients.openWindow(urlParaAbrir);
                }
            })
        );
    });
    console.log(`[SW ${CACHE_NAME}] Manipuladores de mensagem de fundo e clique da notificação configurados.`);

} catch (e) {
    console.error(`[SW ${CACHE_NAME}] Erro ao importar ou inicializar scripts do Firebase no Service Worker:`, e);
}
// --- FIM DA LÓGICA DO FIREBASE MESSAGING ---

// --- INÍCIO DA LÓGICA DE AGENDAMENTO DE NOTIFICAÇÕES LOCAIS (CLIENTE-SIDE) ---
// Usaremos IndexedDB para persistir as notificações agendadas e a Periodic Background Sync
// para tentar disparar o Service Worker em intervalos regulares (quando disponível).

const DB_NAME = 'h2o-app-db';
const DB_VERSION = 1;
const STORE_NAME = 'scheduled-notifications';

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = event => {
            const db = event.target.result;
            db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            console.log('[SW] IndexedDB: Object Store criado.');
        };

        request.onsuccess = event => {
            console.log('[SW] IndexedDB: Banco de dados aberto com sucesso.');
            resolve(event.target.result);
        };

        request.onerror = event => {
            console.error('[SW] IndexedDB: Erro ao abrir banco de dados:', event.target.error);
            reject(event.target.error);
        };
    });
}

async function addScheduledNotification(notificationData) {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.add(notificationData);
        request.onsuccess = () => {
            console.log('[SW] Notificação agendada salva no IndexedDB:', notificationData);
            resolve(request.result);
        };
        request.onerror = () => {
            console.error('[SW] Erro ao salvar notificação agendada no IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

async function getScheduledNotifications() {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            console.error('[SW] Erro ao obter notificações agendadas do IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

async function deleteScheduledNotification(id) {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => {
            console.log('[SW] Notificação agendada removida do IndexedDB:', id);
            resolve();
        };
        request.onerror = () => {
            console.error('[SW] Erro ao remover notificação agendada do IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

// Evento para receber mensagens do cliente (index.html)
self.addEventListener('message', async event => {
    if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
        const { delayInSeconds, title, body, tag, url } = event.data;
        const scheduledTime = Date.now() + (delayInSeconds * 1000); // Calcular o tempo absoluto
        
        const notificationData = {
            title: title,
            body: body,
            icon: '/icones/android-launchericon-192-192.png',
            tag: tag, // Usar uma tag para evitar notificações duplicadas do mesmo tipo
            data: { url: url || self.registration.scope },
            scheduledTime: scheduledTime 
        };
        
        await addScheduledNotification(notificationData);
        console.log(`[SW] Lembrete agendado para ${new Date(scheduledTime)}`);
        
        // Se houver suporte, tente agendar um Periodic Background Sync
        if ('periodicSync' in self.registration) {
            try {
                // Registra um Periodic Background Sync para verificar notificações
                // O mínimo é 12 horas, mas pode ser mais longo dependendo do navegador e uso.
                await self.registration.periodicSync.register('check-water-reminder', {
                    minInterval: 24 * 60 * 60 * 1000, // Tentar uma vez por dia (em milissegundos)
                });
                console.log('[SW] Periodic Background Sync registrado para check-water-reminder.');
            } catch (e) {
                console.warn('[SW] Periodic Background Sync não pôde ser registrado:', e);
            }
        } else {
             console.warn('[SW] Periodic Background Sync não suportado neste navegador.');
        }
    } else if (event.data && event.data.type === 'CANCEL_ALL_REMINDERS') {
        const db = await openDb();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear(); // Limpa todas as notificações agendadas
        console.log('[SW] Todas as notificações agendadas foram canceladas.');
        if ('periodicSync' in self.registration) {
             try {
                 await self.registration.periodicSync.unregister('check-water-reminder');
                 console.log('[SW] Periodic Background Sync para check-water-reminder desregistrado.');
             } catch (e) {
                 console.warn('[SW] Erro ao desregistrar Periodic Background Sync:', e);
             }
        }
    }
});

// Evento Periodic Background Sync
self.addEventListener('periodicsync', event => {
    if (event.tag === 'check-water-reminder') {
        console.log('[SW] Evento PeriodicSync acionado para check-water-reminder.');
        event.waitUntil(checkAndDisplayScheduledNotifications());
    }
});

// Função para verificar e exibir notificações agendadas
async function checkAndDisplayScheduledNotifications() {
    const notifications = await getScheduledNotifications();
    const now = Date.now();
    
    for (const notif of notifications) {
        if (now >= notif.scheduledTime) {
            console.log('[SW] Disparando notificação agendada:', notif.title);
            try {
                await self.registration.showNotification(notif.title, {
                    body: notif.body,
                    icon: notif.icon,
                    tag: notif.tag,
                    data: notif.data,
                    actions: [
                        { action: 'abrir_app', title: '💧 Pedir Água Agora' }
                    ]
                });
                // Após exibir, remove a notificação agendada para não ser disparada novamente
                await deleteScheduledNotification(notif.id);
            } catch (e) {
                console.error('[SW] Erro ao exibir notificação agendada:', e);
            }
        }
    }
}

// Também verificar notificações agendadas na ativação do SW (para pegar as que passaram offline)
self.addEventListener('activate', event => {
    console.log(`[SW ${CACHE_NAME}] Evento de ativação. Verificando notificações agendadas...`);
    event.waitUntil(checkAndDisplayScheduledNotifications());
    // ... restante do seu código de ativação
});

// --- FIM DA LÓGICA DE AGENDAMENTO DE NOTIFICAÇÕES LOCAIS ---