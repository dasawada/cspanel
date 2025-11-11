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
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const token = authHeader ? authHeader.split(' ')[1] : null;

        // === 驗證 Token (所有 Actions 都需要) ===
        if (!token) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: '未提供驗證 token' })
            };
        }

        try {
            await admin.auth().verifyIdToken(token);
        } catch (error) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Token 無效或已過期' })
            };
        }

        // 重要：確保正確解析 body
        let body;
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: '無效的請求格式' })
            };
        }

        const { action } = body;

        // === 獲取受保護的 Tabs 和 IP 內容 (新增) ===
        if (action === 'getProtectedTabs') {
            try {
                const docRef = admin.firestore().collection('protectedContent').doc('tabsAndIP');
                const docSnap = await docRef.get();
                
                if (!docSnap.exists) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ 
                            success: false, 
                            error: '受保護內容不存在' 
                        })
                    };
                }

                const data = docSnap.data();
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        success: true, 
                        tabsHTML: data.tabsHTML || '',
                        ipHTML: data.ipHTML || ''
                    })
                };
            } catch (firestoreError) {
                console.error('Firestore error:', firestoreError);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        error: '無法讀取受保護內容' 
                    })
                };
            }
        }

        // === 獲取 Chat 資訊 (新增) ===
        if (action === 'getChatInfo') {
            const { contactId } = body;
            if (!contactId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: '請提供 contactId' })
                };
            }

            const chatUrl = `https://stirring-pothos-28253d.netlify.app/classbxopchfetch?id=${encodeURIComponent(contactId)}`;
            
            const response = await fetch(chatUrl);
            
            if (!response.ok) {
                throw new Error(`Chat API 錯誤: ${response.status}`);
            }

            const data = await response.json();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data })
            };
        }

        // === 獲取家長資訊 (新) ===
        if (action === 'getParentInfo') {
            const { parentOneClubId } = body;
            if (!parentOneClubId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: '請提供 parentOneClubId' })
                };
            }

            if (!process.env.ONE_CLUB_JWT) {
                throw new Error('後端未設定 ONE_CLUB_JWT');
            }

            const parentApiUrl = `https://api.oneclass.co/staff/customers/${parentOneClubId}`;
            const response = await fetch(parentApiUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${process.env.ONE_CLUB_JWT}`
                }
            });

            if (!response.ok) {
                throw new Error(`OneClass Parent API 錯誤: ${response.status}`);
            }

            const data = await response.json();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, status: 'success', data: data })
            };
        }

        // === 獲取 Deal 資訊 ===
        if (action === 'getDealInfo') {
            const { dealId } = body;
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
            const { orderId } = body;
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