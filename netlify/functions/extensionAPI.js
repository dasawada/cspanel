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
        // admin.auth().verifyIdToken(token) will throw an error if the token is invalid.
        // This error will be caught by the catch block below.
        const decodedToken = await admin.auth().verifyIdToken(token);
        // The 'if (!decodedToken)' block that was here is removed as verifyIdToken throws on failure,
        // and auth errors are specifically handled in the catch block.

        let result;
        switch (action) {
            case 'searchBitrixContact':
                result = await searchBitrixContact(data);
                break;
            case 'searchBitrixContactAdvanced': // 新增：多格式電話搜尋
                result = await searchBitrixContactAdvanced(data);
                break;
            case 'getJwtToken':
                result = await getJwtToken();
                break;
            case 'getCourseInfo':
                result = await getCourseInfo(data);
                break;
            case 'verifyCourseIds':
                result = await verifyCourseIds(data);
                break;
            case 'getParentInfo':
                result = await getParentInfo(data);
                break;
            case 'fetchCompleteClassInfo':
                result = await fetchCompleteClassInfo(data);
                break;
            case 'checkAndProcessCourseInfo':
                result = await checkAndProcessCourseInfo(data);
                break;
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Invalid action provided.' })
                };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result) // Assumes 'result' from action handlers includes success status
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
        const dateRange = formatCustomDateRange(courseData.startAt, courseData.endAt) + typeLabel;

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
                    mobile: teacher.mobile + `<div style="margin-top:4px;color:#888;font-size:12px;">教室ID：${courseId}</div>`
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

// ===== 課程檢查與處理邏輯 =====
async function checkAndProcessCourseInfo(data) {
    const { content } = data;
    
    try {
        function extractCourseId(input) {
            const matches = input.match(/([0-9a-fA-F]{24})/);
            return matches || [];
        }

        let courseIds = extractCourseId(content);
        courseIds = Array.from(new Set(courseIds));

        if (courseIds.length === 0) {
            return {
                success: true,
                data: {
                    type: 'no_course_id',
                    redirectUrl: `https://oneclub.backstage.oneclass.com.tw/customer/customerlist/${content}`,
                    message: '非課程ID/教室ID，將改為搜尋客戶列表'
                }
            };
        }

        if (courseIds.length === 1) {
            const result = await fetchCompleteClassInfo({ courseId: courseIds[0] });
            return {
                success: true,
                data: {
                    type: 'single_course',
                    courseInfo: result.data,
                    courseId: courseIds[0]
                }
            };
        } else {
            const verificationResult = await verifyCourseIds({ courseIds });
            if (!verificationResult.success) {
                throw new Error('Course verification failed');
            }

            const validResult = verificationResult.data.find(r => r.valid);
            if (validResult) {
                const courseInfo = await fetchCompleteClassInfo({ courseId: validResult.id });
                return {
                    success: true,
                    data: {
                        type: 'multiple_course_found',
                        courseInfo: courseInfo.data,
                        courseId: validResult.id,
                        allResults: verificationResult.data
                    }
                };
            } else {
                return {
                    success: true,
                    data: {
                        type: 'no_valid_course',
                        message: '查詢失敗，無有效的課程資料',
                        allResults: verificationResult.data
                    }
                };
            }
        }
        
    } catch (error) {
        console.error('Check and process course info failed:', error);
        return { success: false, error: error.message || 'Check and process failed' };
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