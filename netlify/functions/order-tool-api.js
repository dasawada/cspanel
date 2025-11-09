const admin = require('firebase-admin');
const fetch = require('node-fetch');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
    });
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const { action, email, password, dealId, orderId, token } = JSON.parse(event.body);

        // === 登入 Action ===
        if (action === 'login') {
            if (!email || !password) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: '請提供 email 和 password' })
                };
            }

            try {
                const user = await admin.auth().getUserByEmail(email);
                const customToken = await admin.auth().createCustomToken(user.uid);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, token: customToken })
                };
            } catch (error) {
                let errorMessage = '登入失敗';
                if (error.code === 'auth/user-not-found') {
                    errorMessage = '找不到此使用者';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Email 格式錯誤';
                }
                
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ success: false, error: errorMessage })
                };
            }
        }

        // === 驗證 Token (其他 Actions) ===
        if (!token) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: '未提供驗證 token' })
            };
        }

        await admin.auth().verifyIdToken(token);

        // === 獲取 Deal 資訊 ===
        if (action === 'getDealInfo') {
            if (!dealId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: '請提供 dealId' })
                };
            }

            const bitrixUrl = `${process.env.BITRIX24_WEBHOOK_URL}/crm.deal.get?ID=${dealId}`;
            
            const response = await fetch(bitrixUrl);
            if (!response.ok) {
                throw new Error(`Bitrix API 錯誤: ${response.status}`);
            }

            const data = await response.json();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data })
            };
        }

        // === 獲取訂單資訊 ===
        if (action === 'getOrderData') {
            if (!orderId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: '請提供 orderId' })
                };
            }

            const orderUrl = `${process.env.ONECLASS_API_BASE_URL}/product/open/orders/${orderId}/`;
            const quotationUrl = `${process.env.ONECLASS_API_BASE_URL}/product/open/orders/${orderId}/quotation`;
            
            const [orderRes, quotationRes] = await Promise.all([
                fetch(orderUrl),
                fetch(quotationUrl)
            ]);

            if (!orderRes.ok) {
                throw new Error(`Order API 錯誤: ${orderRes.status}`);
            }

            const orderData = await orderRes.json();
            const quotationData = quotationRes.ok ? await quotationRes.json() : { data: [] };
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    orderData: orderData.data,
                    quotationData: quotationData.data
                })
            };
        }

        // === 獲取團隊資料 ===
        if (action === 'getTeamSheet') {
            const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/wtf?key=${process.env.GSHEET_API_KEY}`;
            
            const response = await fetch(sheetUrl);
            if (!response.ok) {
                throw new Error(`Google Sheets API 錯誤: ${response.status}`);
            }

            const data = await response.json();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data: data.values || [] })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: '未知的 action' })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};