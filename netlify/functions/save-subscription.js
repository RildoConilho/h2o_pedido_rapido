// netlify/functions/save-subscription.js

// Importa o Firebase Admin SDK
const admin = require('firebase-admin');

// --- INICIALIZAÇÃO DO FIREBASE ADMIN SDK ---
// As credenciais são carregadas automaticamente da variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY
// que configuraste no Netlify (contendo o JSON da conta de serviço)
let db; // Declara db fora do try/catch para que seja acessível em todo o handler

try {
    if (admin.apps.length === 0) { // Evita reinicializar se já estiver inicializado
        admin.initializeApp({
            // A credential é automaticamente inferida das variáveis de ambiente se
            // FIREBASE_SERVICE_ACCOUNT_KEY (ou GOOGLE_APPLICATION_CREDENTIALS) estiver definida.
        });
        console.log('[save-subscription.js] Firebase Admin SDK inicializado com sucesso.');
    } else {
        console.log('[save-subscription.js] Firebase Admin SDK já estava inicializado.');
    }
    // Acede ao Firestore APENAS depois de garantir que o app está inicializado
    db = admin.firestore();
    console.log('[save-subscription.js] Instância do Firestore obtida.');
} catch (e) {
    console.error('[save-subscription.js] ERRO CRÍTICO: Falha na inicialização do Firebase Admin SDK ou ao obter Firestore:', e);
    // IMPORTANTE: Não retornamos um erro HTTP 500 diretamente aqui, pois estamos no escopo global
    // da função. O erro será capturado no handler e retornado lá.
}
// --- FIM DA INICIALIZAÇÃO ---

exports.handler = async (event, context) => {
    console.log('[save-subscription.js] Função handler iniciada.'); // Log para ver se a função está sendo invocada
    
    if (event.httpMethod !== 'POST') {
        console.warn('[save-subscription.js] Método não permitido:', event.httpMethod);
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    if (!db) { // Verifica se o db foi inicializado corretamente
        console.error('[save-subscription.js] Erro fatal: Instância do Firestore não disponível. Verifique as variáveis de ambiente e logs de inicialização.');
        return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Servidor não conseguiu conectar à base de dados. Verifique a configuração da chave de serviço.'}) };
    }

    try {
        const data = JSON.parse(event.body);
        const fcmToken = data.token; // Espera que o cliente envie { "token": "SEU_FCM_TOKEN" }

        if (!fcmToken) {
            console.warn('[save-subscription.js] Token FCM não fornecido no corpo da requisição.');
            return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Token FCM não fornecido.' }) };
        }

        console.log('[save-subscription.js] Token FCM recebido para guardar (primeiros 20 chars):', fcmToken.substring(0, 20) + '...'); // Log parcial para segurança

        const tokensRef = db.collection('fcmTokens'); // Nome da coleção no Firestore
        const q = tokensRef.where('token', '==', fcmToken);
        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
            await tokensRef.add({
                token: fcmToken,
                timestamp: admin.firestore.FieldValue.serverTimestamp() // Adiciona um timestamp do servidor
            });
            console.log('[save-subscription.js] Novo token FCM salvo no Firestore.');
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, message: 'Token FCM salvo com sucesso.' }),
            };
        } else {
            // Se o token já existe, atualiza o timestamp
            const existingDoc = querySnapshot.docs[0]; // Pega o primeiro documento encontrado
            await existingDoc.ref.update({
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('[save-subscription.js] Token FCM já existe no Firestore, timestamp atualizado.');
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, message: 'Token FCM já existente, timestamp atualizado.' }),
            };
        }

    } catch (error) {
        console.error('[save-subscription.js] Erro ao processar/guardar token FCM:', error.message, error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: 'Falha ao guardar token FCM.', error: error.message }),
        };
    }
};