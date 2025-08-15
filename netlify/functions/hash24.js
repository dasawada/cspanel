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

    if (event.httpMethod === 'GET') {
        const pathSegments = event.path.split('/').filter(segment => segment);
        if (pathSegments.length >= 2) {
            courseId = pathSegments[pathSegments.length - 1];
        }
        if (!courseId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: '請在 URL 中提供課程編號，格式: /hash24/courseid' })
            };
        }
    } else if (event.httpMethod === 'POST') {
        try {
            if (!event.body) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ success: false, error: '請求內容遺失' }) 
                };
            }
            const parsedBody = JSON.parse(event.body);
            courseId = parsedBody.courseId;
        } catch (e) {
            console.error("JSON 解析錯誤:", e.message);
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ success: false, error: '請求內容格式錯誤' }) 
            };
        }
    } else {
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

        if (!/^[0-9a-fA-F]{24}$/.test(courseId)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: '課程編號格式不正確，需為24位十六進制字串' })
            };
        }

        const result = await getCourseInfo(courseId);
        if (!result.success) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ success: false, error: '課程不存在或無法存取' })
            };
        }

        const summary = await buildCourseSummary(courseId, result.data);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(summary)
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
        if (process.env.ONE_CLUB_JWT && process.env.ONE_CLUB_JWT.trim() !== '') {
            return { success: true, token: process.env.ONE_CLUB_JWT };
        }
        const coffeeshopListUrl = process.env.COFFEESHOP_LIST_FUNCTION_URL || 
            'https://stirring-pothos-28253d.netlify.app/.netlify/functions/coffeeshoplist';
        const response = await fetch(coffeeshopListUrl);
        if (!response.ok) throw new Error(`取得 JWT Token 失敗，狀態碼: ${response.status}`);
        const result = await response.json();
        if (!result || typeof result.token !== 'string' || result.token.trim() === '') {
            throw new Error('JWT Token 格式無效或為空');
        }
        return { success: true, token: result.token };
    } catch (error) {
        return { success: false, error: `JWT Token 取得失敗: ${error.message}` };
    }
}

// ====== 輔導對應組別快取與取得 ======
let _tutorGroupCache = null;
let _tutorGroupLastFetch = 0;
async function fetchTutorToGroup() {
    const url = process.env.GROUP_API_URL;
    if (!url) return {};
    // 10分鐘快取
    if (_tutorGroupCache && Date.now() - _tutorGroupLastFetch < 10 * 60 * 1000) {
        return _tutorGroupCache;
    }
    try {
        const resp = await fetch(url);
        if (!resp.ok) return {};
        const arr = await resp.json();
        const map = {};
        if (Array.isArray(arr)) {
            arr.forEach(row => {
                if (row.tutor && row.group) {
                    map[row.tutor.trim()] = String(row.group).trim();
                }
            });
        }
        _tutorGroupCache = map;
        _tutorGroupLastFetch = Date.now();
        return map;
    } catch {
        return {};
    }
}
async function getTutorGroup(tutorName) {
    if (!tutorName) return null;
    const map = await fetchTutorToGroup();
    return map[tutorName.trim()] || null;
}

// ===== 取得課程資訊 (保持原始結構) =====
async function getCourseInfo(courseId) {
    const apiUrl = "https://api-new.oneclass.co/mms/course/UseAggregate";
    try {
        const jwtResult = await getJwtToken();
        if (!jwtResult.success) throw new Error(jwtResult.error);
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
            return { success: false };
        }
        return { success: true, data: result.data };
    } catch (error) {
        console.error('取得課程資訊錯誤:', error.message);
        return { success: false };
    }
}

// ===== 取得輔導姓名（家長端資料） =====
async function getTutorName(parentOneClubId) {
    if (!parentOneClubId) return null;
    const url = `https://api.oneclass.co/staff/customers/${parentOneClubId}`;
    try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const json = await resp.json();
        return json?.data?.tutor?.name || null;
    } catch {
        return null;
    }
}

// ===== 起訖時間格式化 =====
function formatCustomDateRange(startIso, endIso) {
    if (!startIso) return "(無資料)";
    const wMap = {
        "週日": "(日)", "週一": "(一)", "週二": "(二)", "週三": "(三)",
        "週四": "(四)", "週五": "(五)", "週六": "(六)",
    };
    const start = new Date(startIso);
    const end = endIso ? new Date(endIso) : null;
    const optionsDate = { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" };
    const optionsTime = { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
    const dateFormatter = new Intl.DateTimeFormat("zh-TW", optionsDate);
    const timeFormatter = new Intl.DateTimeFormat("zh-TW", optionsTime);
    const startParts = dateFormatter.formatToParts(start);
    const sYear = startParts.find(x => x.type === "year").value;
    const sMonth = startParts.find(x => x.type === "month").value.padStart(2, "0");
    const sDay = startParts.find(x => x.type === "day").value.padStart(2, "0");
    const sWeekday = startParts.find(x => x.type === "weekday").value;
    const sWeekAbbr = wMap[sWeekday] || "";
    const sTime = timeFormatter.format(start);
    const eTime = end ? timeFormatter.format(end) : "";
    return `${sYear}-${sMonth}-${sDay} ${sWeekAbbr} ${sTime} - ${eTime}`;
}

// ===== 輔導姓名處理（3 個中文字截成前兩字） =====
function processTutorName(name) {
    if (!name) return "(無資料)";
    const threeChinese = /^[\u4e00-\u9fa5]{3}$/;
    if (threeChinese.test(name)) return name.slice(1, 3);
    return name;
}

// ===== 組裝摘要 =====
async function buildCourseSummary(courseId, courseData) {
    const typeLabels = {
        individualLiveCourse: "家教個人課",
        individualLearningBarPlusCourse: "學Bar個人課",
        groupLiveCourse: "家教團體課",
        individualTutorialCenterPlusCourse: "補教個人課",
        groupTutorialCenterPlusCourse: "補教團體課",
        groupLearningBarPlusCourse: "學Bar團體課"
    };

    const timeRange = formatCustomDateRange(courseData.startAt, courseData.endAt);
    const courseType = courseData.isAudition ? "（試聽）" : (typeLabels[courseData.type] || "（不明）");

    let studentName = "(無資料)";
    let tutorName = "(無資料)";
    let tutorGroup = null;
    if (Array.isArray(courseData.students) && courseData.students.length > 0) {
        const firstStudent = courseData.students[0];
        studentName = firstStudent.name || "(無資料)";
        const rawTutor = await getTutorName(firstStudent.parentOneClubId);
        tutorGroup = await getTutorGroup(rawTutor); // 先用原始輔導名稱查組別
        tutorName = processTutorName(rawTutor);     // 再進行裁切處理
    }

    const teacherName = courseData.teacher?.fullName || "(無資料)";

    return {
        success: true,
        timeRange,      // 起訖時間
        courseType,     // 課程類型（中文標籤）
        students: studentName,   // <- 改名
        teacherName,    // 老師名稱
        courseId,       // 課程 ID
        tutorName,      // 輔導（規則處理後）
        TutorGroup: tutorGroup   // 新增組別
    };
}