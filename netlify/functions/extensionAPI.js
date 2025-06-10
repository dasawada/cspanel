// ===== 重要提醒 =====
// 1. 必須設置 BITRIX_WEBHOOK_URL 環境變數
// 2. Webhook URL 格式: https://{your-domain}.bitrix24.com/rest/{user-id}/{webhook-token}
// 3. URL 結尾不要加 "/"
// 4. 確保 Webhook 具有適當的 CRM 權限

const admin = require('firebase-admin');
const fetch = require('node-fetch');

// 初始化 Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
    });
}

exports.handler = async (event, context) => {
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

    let parsedBody;
    try {
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Request body is missing.' }) };
        }
        parsedBody = JSON.parse(event.body);
    } catch (e) {
        console.error("JSON Parsing Error:", e.message);
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Malformed JSON in request body.' }) };
    }

    try {
        const { token, action, data } = parsedBody;

        if (!token) {
            return {
                statusCode: 401, // Unauthorized
                headers,
                body: JSON.stringify({ success: false, error: 'Firebase token is missing in request.' })
            };
        }
        if (!action) {
            return {
                statusCode: 400, // Bad Request
                headers,
                body: JSON.stringify({ success: false, error: 'Action is missing in request.' })
            };
        }

        // 驗證 Firebase token
        const decodedToken = await admin.auth().verifyIdToken(token);

        let result; // This variable will hold the final object to be stringified for the response body.
        switch (action) {
            case 'searchBitrixContact':
                result = await searchBitrixContact(data); // Returns {success: ..., data: ...} or {success: ..., error: ...}
                break;
            case 'searchBitrixContactAdvanced': // 新增：多格式電話搜尋
                result = await searchBitrixContactAdvanced(data); // Returns {success: ..., data: ...} or {success: ..., error: ...}
                break;
            case 'getJwtToken':
                result = await getJwtToken(); // Returns {success: ..., data: ...} or {success: ..., error: ...}
                break;
            case 'getCourseInfo':
                result = await getCourseInfo(data); // Returns {success: ..., data: ...} or {success: ..., error: ...}
                break;
            case 'verifyCourseIds':
                result = await verifyCourseIds(data); // Returns {success: ..., data: ...} or {success: ..., error: ...}
                break;
            case 'getParentInfo':
                result = await getParentInfo(data); // Returns {success: ..., data: ...} or {success: ..., error: ...}
                break;
            case 'fetchCompleteClassInfo':
                result = await fetchCompleteClassInfo(data); // Returns {success: ..., data: ...} or {success: ..., error: ...}
                break;
            case 'checkAndProcessCourseInfo':
                const processedCourseData = await checkAndProcessCourseInfo(data); // This returns {html: ..., redirectUrl: ...}
                // Wrap the result of checkAndProcessCourseInfo to match client expectations
                result = { success: true, data: processedCourseData };
                break;
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Invalid action provided.' })
                };
        }

        // The 'result' variable now holds the correctly structured response for all actions.
        // If an action handler (like Bitrix ones or fetchCompleteClassInfo) already sets 'success: false',
        // that will be preserved. For checkAndProcessCourseInfo, we've wrapped it with 'success: true'.
        return {
            statusCode: 200, // Client will check the 'success' field in the JSON body
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        // Log the original error for server-side debugging
        console.error('Handler Execution Error:', error.message, error.stack ? error.stack : error);

        if (error.code && error.code.startsWith('auth/')) {
            // Firebase authentication specific errors
            return {
                statusCode: 401, // Unauthorized
                headers,
                body: JSON.stringify({ success: false, error: `Authentication error: ${error.message}` })
            };
        }
        // Generic error handler for other types of errors
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Internal server error. Please check server logs for more details.' })
        };
    }
};

// ===== 修正 JWT Token 取得函數 =====
async function getJwtToken() {
    try {
        // 直接使用環境變數 ONE_CLUB_JWT，或呼叫 coffeeshoplist function
        if (process.env.ONE_CLUB_JWT) {
            if (process.env.ONE_CLUB_JWT.trim() === '') {
                console.warn('ONE_CLUB_JWT environment variable is set but empty. Proceeding to fetch from remote function.');
                // Fall through to fetch from coffeeshoplist if env var is empty
            } else {
                console.log('Using ONE_CLUB_JWT from environment variable');
                return { success: true, data: { token: process.env.ONE_CLUB_JWT } };
            }
        } else {
            console.log('ONE_CLUB_JWT not found in environment variables. Fetching from remote function.');
        }
        
        // 使用環境變數作為URL來源，避免硬編碼URL
        const coffeeshopListUrl = process.env.COFFEESHOP_LIST_FUNCTION_URL || 'https://stirring-pothos-28253d.netlify.app/.netlify/functions/coffeeshoplist';
        
        console.log(`Fetching JWT from remote function: ${coffeeshopListUrl}`);

        const response = await fetch(coffeeshopListUrl);
        
        if (!response.ok) {
            const errorBody = await response.text().catch(() => "Could not retrieve error body");
            console.error(`Fetch from coffeeshoplist failed with status: ${response.status}. Response: ${errorBody}`);
            throw new Error(`Failed to fetch token from coffeeshoplist. Status: ${response.status}.`);
        }
        
        const result = await response.json();
        
        if (!result || typeof result.token !== 'string' || result.token.trim() === '') {
            console.error('Invalid token structure or empty token received from coffeeshoplist:', result);
            throw new Error('Invalid or empty token received from coffeeshoplist.');
        }
        return { success: true, data: { token: result.token } };
        
    } catch (error) {
        console.error('getJwtToken error:', error.message, error.stack ? error.stack : error);
        // Ensure the returned error message is helpful for the client and includes success status
        return { success: false, error: `JWT token fetch failed: ${error.message}` };
    }
}

// ===== Bitrix 相關 API =====
async function searchBitrixContact(data) {
    const { phone } = data;
    const bitrixUrl = process.env.BITRIX_WEBHOOK_URL;
    
    try {
        const response = await fetch(`${bitrixUrl}/crm.contact.list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filter: { "PHONE": phone },
                select: ["ID", "NAME", "LAST_NAME", "PHONE", "EMAIL", "UF_CRM_1688023476"]
            })
        });
        
        const result = await response.json();
        return { success: true, data: result };
    } catch (error) {
        console.error('Bitrix search error:', error);
        return { success: false, error: 'Contact search failed' };
    }
}

// ===== 新增：進階 Bitrix 搜尋（包含多格式電話號碼） =====
async function searchBitrixContactAdvanced(data) {
    const { phone } = data;
    const bitrixUrl = process.env.BITRIX_WEBHOOK_URL;
    
    try {
        // 生成多種電話格式
        const phoneFormats = generatePhoneFormats(phone);
        let allResults = new Map();
        
        // 對每種格式進行搜尋
        for (const formattedPhone of phoneFormats) {
            let retryCount = 0;
            while (retryCount < 3) {
                try {
                    const response = await fetch(`${bitrixUrl}/crm.contact.list`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filter: { PHONE: formattedPhone },
                            select: ["ID", "NAME", "LAST_NAME", "PHONE", "EMAIL"],
                            start: 0
                        })
                    });

                    if (!response.ok) throw new Error('Network response was not ok');
                    
                    const result = await response.json();
                    if (result && result.result && result.result.length > 0) {
                        result.result.forEach(contact => {
                            if (!allResults.has(contact.ID)) {
                                allResults.set(contact.ID, contact);
                            }
                        });
                    }
                    break; // 成功就跳出重試迴圈
                } catch (err) {
                    retryCount++;
                    if (retryCount === 3) {
                        console.error('搜尋失敗:', err);
                    } else {
                        await new Promise(r => setTimeout(r, 1000)); // 延遲1秒後重試
                    }
                }
            }
        }

        const results = Array.from(allResults.values());
        return { 
            success: true, 
            data: { 
                result: results,
                total: results.length,
                searchFormats: phoneFormats
            } 
        };
        
    } catch (error) {
        console.error('Advanced Bitrix search error:', error);
        return { success: false, error: 'Advanced contact search failed' };
    }
}

// 電話格式生成函數
function generatePhoneFormats(phone) {
    const rawPhone = phone.replace(/\D/g, ""); // 移除非數字字符
    return [
        rawPhone,
        rawPhone.replace(/(\d{4})(\d{3})(\d{3})/, "$1-$2-$3"),
        rawPhone.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3")
    ].filter(Boolean); // 過濾掉空值
}

// ===== OneClass 相關 API =====
async function getCourseInfo(data) {
    const { courseId } = data;
    const apiUrl = "https://api-new.oneclass.co/mms/course/UseAggregate";
    
    try {
        const jwtResult = await getJwtToken();
        if (!jwtResult.success) {
            throw new Error('Failed to get JWT token');
        }
        
        const response = await fetch(`${apiUrl}/${courseId}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: jwtResult.data.token,
            },
        });
        
        const result = await response.json();
        return { success: true, data: result };
    } catch (error) {
        console.error('Course info error:', error);
        return { success: false, error: 'Course info fetch failed' };
    }
}

async function verifyCourseIds(data) {
    const { courseIds } = data;
    const apiUrl = "https://api-new.oneclass.co/mms/course/UseAggregate";
    
    try {
        const jwtResult = await getJwtToken();
        if (!jwtResult.success) {
            throw new Error('Failed to get JWT token');
        }

        const verificationPromises = courseIds.map(id => {
            return fetch(`${apiUrl}/${id}`, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    Authorization: jwtResult.data.token,
                },
            })
            .then((response) => response.json())
            .then((data) => {
                if (data && data.status === "success") {
                    return { id, valid: true };
                }
                return { id, valid: false };
            })
            .catch(() => ({ id, valid: false }));
        });

        const results = await Promise.all(verificationPromises);
        return { success: true, data: results };
    } catch (error) {
        console.error('Course verification error:', error);
        return { success: false, error: 'Course verification failed' };
    }
}

async function getParentInfo(data) {
    const { parentOneClubId } = data;
    const parentApiUrl = "https://api.oneclass.co/staff/customers/";
    
    try {
        const response = await fetch(`${parentApiUrl}${parentOneClubId}`);
        const result = await response.json();
        return { success: true, data: result };
    } catch (error) {
        console.error('Parent info error:', error);
        return { success: false, error: 'Parent info fetch failed' };
    }
}

// ===== 完整課程資訊查詢 =====
async function fetchCompleteClassInfo(data) {
    const { courseId } = data;
    
    try {
        const courseResult = await getCourseInfo({ courseId });
        if (!courseResult.success || courseResult.data.status !== "success") {
            throw new Error("查詢失敗");
        }
        
        const courseData = courseResult.data.data;
        const students = courseData.students || [];
        const teacher = courseData.teacher || {};

        const typeLabels = {
            individualLiveCourse: "（家教）",
            individualLearningBarPlusCourse: "（學霸）",
            groupLiveCourse: "（家教團）",
            individualTutorialCenterPlusCourse: "（補教）",
            groupTutorialCenterPlusCourse: "（補教團）",
            groupLearningBarPlusCourse: "（學霸團）"
        };

        const typeLabel = courseData.isAudition ? "（試聽）" : (typeLabels[courseData.type] || "（不明）");
        const dateRange = formatCustomDateRange(courseData.startAt, courseData.endAt) + typeLabel +
           `<div style="color:#41535b;font-size:12px;">${courseId}</div>`;

        let studentInfo = "(無資料)";
        let tutorName = "(無資料)";
        let contactId = "#";

        if (students.length > 0) {
            const student = students[0];
            const parentResult = await getParentInfo({ parentOneClubId: student.parentOneClubId });
            
            if (parentResult.success && parentResult.data.data) {
                contactId = parentResult.data.data.contactId || "#";
                const bxButton = `<a href="https://oneclass.bitrix24.com/crm/contact/details/${contactId}/" target="_blank" rel="noopener noreferrer" style="display:inline-block; background-color:#0078D7; color:white; padding:1px 5px; border-radius:15px; cursor:pointer; font-size: 10px; text-decoration:none;">Bitix24</a>`;
                studentInfo = `<strong>${student.name}</strong> (${student.parentOneClubId}) ${bxButton}`;
                tutorName = parentResult.data.data.tutor?.name || "(無資料)";
            }
        }

            const completeInfo = {
                dateRange,
                studentInfo,
                teacher: {
                    fullName: teacher.fullName,
                    oneClubId: teacher.oneClubId,
                    mobile: teacher.mobile
                },
                // 在輔導欄位下方新增顯示教室ID
                tutorName: tutorName,
                contactId,
                rawData: { courseData, students }
            };

        return { success: true, data: completeInfo };
        
    } catch (error) {
        console.error('Complete class info fetch failed:', error);
        return { success: false, error: error.message || 'Complete class info fetch failed' };
    }
}

// Helper function to generate HTML for class info
function generateClassInfoHtml(info) {
    if (!info) {
        return '<p style="color:orange;">未找到課程詳細資訊。</p>';
    }
    // Ensure teacher object and its properties exist to avoid 'undefined'
    const teacherFullName = info.teacher?.fullName || '(無資料)';
    const teacherOneClubId = info.teacher?.oneClubId || 'N/A';
    const teacherMobile = info.teacher?.mobile ? `0${info.teacher.mobile}` : 'N/A'; // Corrected template literal usage
    const tutorName = info.tutorName || '(無資料)';

    return `
        <div class="class-info-header">${info.dateRange || '(日期無資料)'}</div>
        <div class="class-info-row">
            學生：${info.studentInfo || '(無資料)'}
        </div>
        <div class="class-info-row">
            老師：<strong>${teacherFullName}</strong> (ID：${teacherOneClubId})
        </div>
        <div class="class-info-row class-info-footer">
            <div class="class-info-flex">
                <div>師電：${teacherMobile}</div>
                <div>輔導：<strong>${tutorName}</strong></div>
            </div>
        </div>
    `;
}

// ===== 課程檢查與處理邏輯 (Modified) =====
async function checkAndProcessCourseInfo(data) {
    const { content } = data;
    try {
        function extractCourseId(input) {
            // Use 'g' flag for multiple matches and ensure unique IDs
            const matches = input.match(/([0-9a-fA-F]{24})/g);
            return matches ? Array.from(new Set(matches)) : [];
        }

        let courseIds = extractCourseId(content);

        if (courseIds.length === 0) {
            const message = '非課程ID/教室ID，將改為搜尋客戶列表';
            return { // This object becomes the 'data' field in the final successful response
                html: `<p style="color:red;">${message}</p>`,
                redirectUrl: `https://oneclub.backstage.oneclass.com.tw/customer/customerlist/${content}`
            };
        }

        let courseInfoResult;
        let finalCourseIdToFetch;

        if (courseIds.length === 1) {
            finalCourseIdToFetch = courseIds[0];
            courseInfoResult = await fetchCompleteClassInfo({ courseId: finalCourseIdToFetch });
        } else {
            const verificationResult = await verifyCourseIds({ courseIds });
            if (!verificationResult.success) {
                const errorMessage = verificationResult.error || '多課程ID驗證失敗';
                return { html: `<p style="color:red;">${errorMessage}</p>` };
            }

            const validResult = verificationResult.data.find(r => r.valid);
            if (validResult) {
                finalCourseIdToFetch = validResult.id;
                courseInfoResult = await fetchCompleteClassInfo({ courseId: finalCourseIdToFetch });
            } else {
                const message = '查詢失敗，提供的多個ID中無有效的課程資料';
                return { html: `<p style="color:red;">${message}</p>` };
            }
        }

        if (courseInfoResult && courseInfoResult.success && courseInfoResult.data) {
            const html = generateClassInfoHtml(courseInfoResult.data);
            return { html: html };
        } else {
            const errorMessage = (courseInfoResult && courseInfoResult.error) 
                               ? courseInfoResult.error 
                               : `無法獲取課程ID ${finalCourseIdToFetch || '未知'} 的詳細資訊。`;
            return { html: `<p style="color:red;">${errorMessage}</p>` };
        }
    } catch (error) {
        // This catch is for unexpected errors within checkAndProcessCourseInfo itself.
        console.error('Critical Error in checkAndProcessCourseInfo:', error.message, error.stack);
        // Re-throw to be caught by the main handler, which will return a generic 500 error.
        // The client will display its generic error message for this.
        throw error;
    }
}

// ===== 時間格式化函數 =====
function formatCustomDateRange(startIso, endIso) {
    if (!startIso) return "(無資料)";
    
    const wMap = {
        "週日": "(日)", "週一": "(一)", "週二": "(二)", "週三": "(三)",
        "週四": "(四)", "週五": "(五)", "週六": "(六)",
    };
    
    const start = new Date(startIso);
    const end = endIso ? new Date(endIso) : null;

    const optionsDate = {
        timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", 
        day: "2-digit", weekday: "short",
    };
    const optionsTime = {
        timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    };

    const dateFormatter = new Intl.DateTimeFormat("zh-TW", optionsDate);
    const timeFormatter = new Intl.DateTimeFormat("zh-TW", optionsTime);

    const startParts = dateFormatter.formatToParts(start);
    const sYear = startParts.find((x) => x.type === "year").value;
    const sMonth = startParts.find((x) => x.type === "month").value.padStart(2, "0");
    const sDay = startParts.find((x) => x.type === "day").value.padStart(2, "0");
    const sWeekday = startParts.find((x) => x.type === "weekday").value;
    const sWeekAbbr = wMap[sWeekday] || "";
    const sTime = timeFormatter.format(start);

    let eTime = "";
    if (end) eTime = timeFormatter.format(end);

    return `${sYear}-${sMonth}-${sDay} ${sWeekAbbr} ${sTime} - ${eTime}`;
}