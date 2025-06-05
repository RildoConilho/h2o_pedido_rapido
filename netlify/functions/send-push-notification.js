// netlify/functions/send-push-notification.js

const admin = require('firebase-admin');

// --- INICIALIZAÇÃO DO FIREBASE ADMIN SDK ---
try {
    if (admin.apps.length === 0) {
        admin.initializeApp(); // Credenciais inferidas da variável de ambiente
        console.log('[send-push-notification.js] Firebase Admin SDK inicializado com sucesso.');
    }
} catch (e) {
    console.error('[send-push-notification.js] Falha ao inicializar Firebase Admin SDK:', e);
}
// --- FIM DA INICIALIZAÇÃO ---

let db;
let messaging;
try {
    db = admin.firestore();
    messaging = admin.messaging();
} catch (e) {
    console.error('[send-push-notification.js] Falha ao obter instância do Firestore ou Messaging:', e);
}


exports.handler = async (event, context) => {
    console.log('[send-push-notification.js] Função acionada.');

    if (!db || !messaging) { // Verifica se db e messaging foram inicializados
        return { statusCode: 500, body: JSON.stringify({ message: 'Servidor com erro na inicialização do Firebase Admin.'}) };
    }
    
    // Opcional: Adicionar uma verificação de segurança se o cron job enviar um segredo no header
    // const expectedSecret = process.env.CRON_JOB_SECRET;
    // if (event.headers && event.headers['x-cron-secret'] !== expectedSecret) {
    //     console.warn("[send-push-notification.js] Chamada não autorizada.");
    //     return { statusCode: 401, body: 'Unauthorized' };
    // }

    try {
        const tokensSnapshot = await db.collection('fcmTokens').get();
        if (tokensSnapshot.empty) {
            console.log('[send-push-notification.js] Nenhum token FCM encontrado no Firestore.');
            return { statusCode: 200, body: JSON.stringify({ message: 'Nenhum token encontrado para envio.' }) };
        }

        const tokens = [];
        tokensSnapshot.forEach(doc => {
            if (doc.data() && doc.data().token) {
                tokens.push(doc.data().token);
            }
        });

        if (tokens.length === 0) {
            console.log('[send-push-notification.js] Array de tokens vazio após processamento.');
            return { statusCode: 200, body: JSON.stringify({ message: 'Nenhum token válido para envio.' }) };
        }

        const messagePayload = {
            notification: {
                title: 'Precisa de Água? 💧 (H2O)',
                body: 'Não deixe a sua água acabar! Peça agora no h2O.',
                // Substitua pela URL completa e pública do seu ícone
                icon: 'https://h2opediraguafacil.netlify.app/icones/android-launchericon-192-192.png' 
            },
            data: { 
                // Substitua pela URL completa do seu PWA ou página de pedido
                url: 'https://h2opediraguafacil.netlify.app/index.html' 
            }
        };
        
        console.log(`[send-push-notification.js] Tentando enviar notificação para ${tokens.length} token(s).`);

        const response = await messaging.sendEachForMulticast({ tokens, ...messagePayload });
        
        let successes = response.successCount;
        let failures = response.failureCount;
        console.log(`[send-push-notification.js] Notificações enviadas: ${successes} com sucesso, ${failures} falharam.`);

        if (failures > 0) {
            const tokensToRemove = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorCode = resp.error.code;
                    console.error(`[send-push-notification.js] Falha ao enviar para token ${tokens[idx]}: ${errorCode} - ${resp.error.message}`);
                    if (errorCode === 'messaging/registration-token-not-registered' ||
                        errorCode === 'messaging/invalid-registration-token' ||
                        errorCode === 'messaging/mismatched-credential' || // Pode indicar problema com senderId ou VAPID
                        errorCode === 'messaging/unregistered') { // FCM mais recente
                        tokensToRemove.push(tokens[idx]);
                    }
                }
            });

            if (tokensToRemove.length > 0) {
                console.log('[send-push-notification.js] Removendo tokens inválidos:', tokensToRemove);
                const removePromises = tokensToRemove.map(async (token) => {
                    const snapshot = await db.collection('fcmTokens').where('token', '==', token).get();
                    if (!snapshot.empty) {
                        const batch = db.batch();
                        snapshot.docs.forEach(doc => {
                            batch.delete(doc.ref);
                        });
                        await batch.commit();
                        console.log(`[send-push-notification.js] Token ${token} removido do Firestore.`);
                    }
                });
                await Promise.allSettled(removePromises);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Processo de envio de notificações concluído.', successes, failures }),
        };

    } catch (error) {
        console.error('[send-push-notification.js] Erro geral:', error.message, error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Erro interno do servidor ao enviar notificações.', error: error.message }),
        };
    }
};