const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    let courseId;

    // 支援 GET 請求從 URL 路徑取得 courseId
    if (event.httpMethod === 'GET') {
        // 從路徑中提取 courseId: /hash24/courseid
        const pathSegments = event.path.split('/').filter(segment => segment);
        
        // 路徑應該是 ['hash24', 'courseid']
        if (pathSegments.length >= 2) {
            courseId = pathSegments[pathSegments.length - 1]; // 取最後一段作為 courseId
        }
        
        if (!courseId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: '請在 URL 中提供課程編號，格式: /hash24/courseid' })
            };
        }
    }
    // 支援 POST 請求從 body 取得 courseId
    else if (event.httpMethod === 'POST') {
        let parsedBody;
        try {
            if (!event.body) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ success: false, error: '請求內容遺失' }) 
                };
            }
            parsedBody = JSON.parse(event.body);
            courseId = parsedBody.courseId;
        } catch (e) {
            console.error("JSON 解析錯誤:", e.message);
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ success: false, error: '請求內容格式錯誤' }) 
            };
        }
    }
    else {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: '不支援的請求方法，請使用 GET 或 POST' })
        };
    }

    try {
        if (!courseId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: '課程編號為必填欄位' })
            };
        }

        // 驗證 courseId 格式 (24位十六進制)
        if (!/^[0-9a-fA-F]{24}$/.test(courseId)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: '課程編號格式不正確，需為24位十六進制字串' })
            };
        }

        const result = await getCourseInfo(courseId);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('處理錯誤:', error.message, error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: '內部伺服器錯誤' })
        };
    }
};

// ===== JWT Token 取得函數 =====
async function getJwtToken() {
    try {
        // 優先使用環境變數中的 JWT Token
        if (process.env.ONE_CLUB_JWT && process.env.ONE_CLUB_JWT.trim() !== '') {
            return { success: true, token: process.env.ONE_CLUB_JWT };
        }
        
        // 如果環境變數沒有，則從遠端函數取得
        const coffeeshopListUrl = process.env.COFFEESHOP_LIST_FUNCTION_URL || 
            'https://stirring-pothos-28253d.netlify.app/.netlify/functions/coffeeshoplist';
        
        const response = await fetch(coffeeshopListUrl);
        
        if (!response.ok) {
            throw new Error(`取得 JWT Token 失敗，狀態碼: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result || typeof result.token !== 'string' || result.token.trim() === '') {
            throw new Error('JWT Token 格式無效或為空');
        }
        
        return { success: true, token: result.token };
        
    } catch (error) {
        return { success: false, error: `JWT Token 取得失敗: ${error.message}` };
    }
}

// ===== 取得課程資訊 =====
async function getCourseInfo(courseId) {
    const apiUrl = "https://api-new.oneclass.co/mms/course/UseAggregate";
    
    try {
        const jwtResult = await getJwtToken();
        if (!jwtResult.success) {
            throw new Error(jwtResult.error);
        }

        const response = await fetch(`${apiUrl}/${courseId}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${jwtResult.token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`API 回應錯誤: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.status !== "success") {
            return { 
                success: false, 
                error: "課程不存在或無法存取" 
            };
        }

        return { success: true, data: result.data };
        
    } catch (error) {
        console.error('取得課程資訊錯誤:', error.message);
        return { success: false, error: '課程資訊取得失敗' };
    }
}