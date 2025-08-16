/**
 * Hash24 Course / Issue API (Extensible)
 * GET /.netlify/functions/hash24/:courseId?types=courseComms,foo&v=1
 * POST body: { courseId, types: "courseComms,foo" }
 *
 * Base response fields (always when success):
 * {
 *   success, version, hash24, courseId, students, tutorName, TutorGroup,
 *   teacherName, courseType, timeRange
 * }
 * Each requested "type" (strategy) may append its own fields.
 */
const fetch = require('node-fetch');

const VERSION = 'v1';

// ================== Entry ==================
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { courseId, requestedTypes, builderOptions, formatErrors } = parseRequest(event);
    if (!courseId) {
      return json(headers, 400, errObj('MISSING_COURSE_ID', '課程編號為必填'));
    }
    if (!/^[0-9a-fA-F]{24}$/.test(courseId)) {
      return json(headers, 400, errObj('INVALID_HASH', '課程編號格式不正確，需為24位十六進制字串'));
    }

    // 取得課程基礎資料
    const courseInfo = await getCourseInfo(courseId);
    if (!courseInfo.success) {
      return json(headers, 404, errObj('NOT_FOUND', '課程不存在或無法存取'));
    }

    // 轉換為 base 結構
    const base = await buildBaseCourseSummary(courseId, courseInfo.data);

    // 若未要求任何擴充 → 直接回傳 base
    if (!requestedTypes.length) {
      return json(headers, 200, {
        success: true,
        version: VERSION,
        appliedTypes: [],
        requestedTypes,
        ...base
      });
    }

    // 構建擴充
    const appliedTypes = [];
    let merged = { ...base };
    for (const t of requestedTypes) {
      const builder = ISSUE_BUILDERS[t];
      if (!builder) continue;
      try {
        const partial = await builder({
          courseId,
            base,
            courseData: courseInfo.data,
            options: builderOptions[t] || {},
            fetch
        });
        if (partial && typeof partial === 'object') {
          merged = { ...merged, ...partial };
          appliedTypes.push(t);
        }
      } catch (e) {
        // 個別 builder 失敗不阻斷主流程；可選擇加入 errors
        formatErrors && (merged.builderErrors = (merged.builderErrors || []).concat({
          type: t,
          message: e.message
        }));
      }
    }

    return json(headers, 200, {
      success: true,
      version: VERSION,
      requestedTypes,
      appliedTypes,
      ...merged
    });

  } catch (e) {
    return json(headers, 500, errObj('INTERNAL_ERROR', e.message || '內部伺服器錯誤'));
  }
};

// ================== Request Parsing ==================
function parseRequest(event) {
  let courseId;
  const url = new URL(event.rawUrl || `http://localhost${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
  const qp = url.searchParams;

  // 支援 GET 路徑參數
  if (event.httpMethod === 'GET') {
    const segments = event.path.split('/').filter(Boolean);
    courseId = segments[segments.length - 1]; // /hash24/:id
  }

  // POST body
  let bodyObj = {};
  if (event.httpMethod === 'POST' && event.body) {
    try {
      bodyObj = JSON.parse(event.body);
      if (!courseId) courseId = bodyObj.courseId;
    } catch {
      /* ignore */
    }
  }

  // Query 覆寫
  if (qp.get('courseId')) courseId = qp.get('courseId');

  const rawTypes = (qp.get('types') || bodyObj.types || '').trim();
  const requestedTypes = rawTypes
    ? rawTypes.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // builder 個別 options：可透過 POST body.options 或 query 中 options.<type>.key=value (未實作複雜解析，此處簡化)
  const builderOptions = bodyObj.options || {};

  const formatErrors = qp.get('withBuilderErrors') === '1';

  return { courseId, requestedTypes, builderOptions, formatErrors };
}

// ================== Base Course Logic ==================
async function getJwtToken() {
  try {
    if (process.env.ONE_CLUB_JWT && process.env.ONE_CLUB_JWT.trim() !== '') {
      return { success: true, token: process.env.ONE_CLUB_JWT };
    }
    const listUrl = process.env.COFFEESHOP_LIST_FUNCTION_URL ||
      'https://stirring-pothos-28253d.netlify.app/.netlify/functions/coffeeshoplist';
    const resp = await fetch(listUrl);
    if (!resp.ok) throw new Error(`取得 JWT 失敗: ${resp.status}`);
    const data = await resp.json();
    if (!data?.token) throw new Error('回傳缺少 token');
    return { success: true, token: data.token };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getCourseInfo(courseId) {
  const apiUrl = 'https://api-new.oneclass.co/mms/course/UseAggregate';
  try {
    const jwt = await getJwtToken();
    if (!jwt.success) throw new Error(jwt.error);
    const r = await fetch(`${apiUrl}/${courseId}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${jwt.token}` }
    });
    if (!r.ok) throw new Error(`API 狀態 ${r.status}`);
    const json = await r.json();
    if (json.status !== 'success') return { success: false };
    return { success: true, data: json.data };
  } catch {
    return { success: false };
  }
}

let _tutorGroupCache = null;
let _tutorGroupLast = 0;
async function fetchTutorToGroup() {
  const url = process.env.GROUP_API_URL;
  if (!url) return {};
  if (_tutorGroupCache && Date.now() - _tutorGroupLast < 10 * 60 * 1000) return _tutorGroupCache;
  try {
    const r = await fetch(url);
    if (!r.ok) return {};
    const arr = await r.json();
    const map = {};
    if (Array.isArray(arr)) {
      arr.forEach(row => {
        if (row.tutor && row.group) map[row.tutor.trim()] = String(row.group).trim();
      });
    }
    _tutorGroupCache = map;
    _tutorGroupLast = Date.now();
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

async function getTutorName(parentOneClubId) {
  if (!parentOneClubId) return null;
  try {
    const url = `https://api.oneclass.co/staff/customers/${parentOneClubId}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data?.tutor?.name || null;
  } catch {
    return null;
  }
}

function sliceTutorName(n) {
  if (!n) return '(無資料)';
  const re3 = /^[\u4e00-\u9fa5]{3}$/;
  if (re3.test(n)) return n.slice(1); // 與原邏輯相似 (取後兩字)
  return n;
}

function formatRangeForDisplay(startIso, endIso) {
  if (!startIso) return '(無資料)';
  const wMap = { '週日': '(日)', '週一': '(一)', '週二': '(二)', '週三': '(三)', '週四': '(四)', '週五': '(五)', '週六': '(六)' };
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const dateFmt = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const timeFmt = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = dateFmt.formatToParts(start);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  const wd = parts.find(p => p.type === 'weekday').value;
  const wdTag = wMap[wd] || '';
  const sTime = timeFmt.format(start);
  const eTime = end ? timeFmt.format(end) : '';
  return `${y}-${m}-${d} ${wdTag} ${sTime} - ${eTime}`;
}

// parentNeed 專用（YYYY/MM/DD(週)HH:MM-HH:MM 課程類型 老師：X）
function formatParentNeed(courseData, courseTypeLabel, teacherName) {
  const tz = 'Asia/Taipei';
  const start = new Date(courseData.startAt);
  const end = new Date(courseData.endAt);
  if (isNaN(start)) return '';
  const weeks = ['(日)','(一)','(二)','(三)','(四)','(五)','(六)'];
  const wd = weeks[start.getDay()] || '';
  const pad2 = n => String(n).padStart(2,'0');
  const y = start.getFullYear();
  const M = pad2(start.getMonth()+1);
  const D = pad2(start.getDate());
  const h1 = pad2(start.getHours());
  const m1 = pad2(start.getMinutes());
  const h2 = pad2(end.getHours());
  const m2 = pad2(end.getMinutes());
  return `${y}/${M}/${D}${wd}${h1}:${m1}-${h2}:${m2} ${courseTypeLabel} 老師：${teacherName}`;
}

async function buildBaseCourseSummary(courseId, courseData) {
  const typeLabels = {
    individualLiveCourse: '家教個人課',
    individualLearningBarPlusCourse: '學Bar個人課',
    groupLiveCourse: '家教團體課',
    individualTutorialCenterPlusCourse: '補教個人課',
    groupTutorialCenterPlusCourse: '補教團體課',
    groupLearningBarPlusCourse: '學Bar團體課'
  };
  const timeRange = formatRangeForDisplay(courseData.startAt, courseData.endAt);
  const courseType = courseData.isAudition ? '（試聽）' : (typeLabels[courseData.type] || '（不明）');

  let studentName = '(無資料)';
  let tutorName = '(無資料)';
  let tutorGroup = null;
  if (Array.isArray(courseData.students) && courseData.students.length) {
    const st = courseData.students[0];
    studentName = st.name || '(無資料)';
    const rawTutor = await getTutorName(st.parentOneClubId);
    tutorGroup = await getTutorGroup(rawTutor);
    tutorName = sliceTutorName(rawTutor);
  }
  const teacherName = courseData.teacher?.fullName || '(無資料)';

  return {
    hash24: courseId,
    courseId,
    students: studentName,
    tutorName,
    TutorGroup: tutorGroup,
    teacherName,
    courseType,
    timeRange
  };
}

// ================== Issue Builders (Strategies) ==================
/**
 * Builder 傳入：
 * { courseId, base, courseData, options, fetch }
 * 回傳要 merge 的物件
 */
const ISSUE_BUILDERS = {
  courseComms: ({ base, courseData, options }) => { /* 原本保留 (若還需要) */ },

  // === 新增：一次性九類配置 ===
  issueConfig: ({ base, courseData, options }) => {
    // 課程資訊 (Asia/Taipei) 用於可選插入
    const classInfoString = formatParentNeed(
      courseData,
      base.courseType.replace(/^（|\(|\）|\)/g,'').trim() || '課程',
      base.teacherName
    );

    // 類別顯示順序 (九類)
    const radioOrder = [
      '請假與補課','課程討論','考卷/作業相關','紙本講義相關',
      '合約內容相關','課程通訊問題','系統操作','推薦親友','其他'
    ];

    // 子分類: 考卷/作業相關
    const examSubTypes = [
      { value:'',        label:'請選擇子分類', parentNeedPrefix:'' },
      { value:'考卷檢討', label:'考卷檢討',   parentNeedPrefix:'[課程考卷檢討] ' , adminTemplate:'已查課表、並轉傳綠Line，老師：' },
      { value:'作業檢討', label:'作業檢討',   parentNeedPrefix:'[課程作業檢討] ' , adminTemplate:'已查課表、並轉傳綠Line，老師：' },
      { value:'教材講解', label:'教材講解',   parentNeedPrefix:'[教材講解] ' }
    ];

    // 子分類: 課程通訊問題
    const commsSubTypes = [
      { value:'',          label:'請選擇原因', parentNeedPrefix:'' , prefill:'' },
      { value:'[教材錯誤]', label:'[教材錯誤]', parentNeedPrefix:'[教材錯誤] ' , prefill:'[教材錯誤]\n老師One客服反映: (請填寫細節)\n' },
      { value:'[老師曠課]', label:'[老師曠課]', parentNeedPrefix:'[老師曠課] ' , prefill:'[老師曠課]\n老師未到，已於HH:MM請學生下課\n' }
    ];

    // 類別定義 (統一 schema)
    // classInfo = 是否插入課程資訊行 (formatParentNeed 產生的字串)
    const categoryDefs = {
      '請假與補課':      { label:'請假與補課',      classInfo:true,  parentNeedPrefix:'[請假與補課] ' },
      '課程討論':        { label:'課程討論',        classInfo:true,  parentNeedPrefix:'[課程討論] ' },
      '考卷/作業相關':    { label:'考卷/作業相關',    classInfo:true,  parentNeedPrefix:'', subTypes: examSubTypes },
      '紙本講義相關':    { label:'紙本講義相關',    classInfo:true,  parentNeedPrefix:'[紙本講義] ' },
      '合約內容相關':    { label:'合約內容相關',    classInfo:true,  parentNeedPrefix:'[合約內容] ' },
      '課程通訊問題':    { label:'課程通訊問題',    classInfo:true,  parentNeedPrefix:'', subTypes: commsSubTypes, counselDefault:true, adminDelimiter:'----' },
      '系統操作':        { label:'系統操作',        classInfo:false, parentNeedPrefix:'[系統操作] ' },
      '推薦親友':        { label:'推薦親友',        classInfo:false, parentNeedPrefix:'[推薦親友] ' },
      '其他':            { label:'其他',            classInfo:false, parentNeedPrefix:'' }
    };

    // 組合 parentNeed：parentNeedPrefix + classInfoString(若開關為真)
    function buildParentNeed(prefix, useClassInfo) {
      return (prefix || '') + (useClassInfo ? classInfoString : '');
    }

    // 深度處理每個類別
    const radioConfigs = {};
    for (const key of radioOrder) {
      const def = categoryDefs[key] || { label:key, classInfo:false, parentNeedPrefix:'' };
      const { label, classInfo, parentNeedPrefix, subTypes, counselDefault, adminDelimiter } = def;

      if (Array.isArray(subTypes) && subTypes.length) {
        // 處理子分類
        const builtSubTypes = subTypes.map(st => ({
          ...st,
            parentNeed: buildParentNeed(st.parentNeedPrefix ?? parentNeedPrefix ?? '', classInfo)
        }));
        radioConfigs[key] = {
          label,
          classInfo,
          parentNeedPrefix,
          parentNeed: buildParentNeed(parentNeedPrefix, classInfo),
          subTypes: builtSubTypes,
          counselDefault,
          adminDelimiter
        };
      } else {
        // 無子分類
        radioConfigs[key] = {
          label,
          classInfo,
          parentNeedPrefix,
          parentNeed: buildParentNeed(parentNeedPrefix, classInfo)
        };
      }
    }

    return {
      selectedType: options.preselect || '課程通訊問題',
      classInfoString,         // 提供前端需要時可顯示/除錯
      radioConfigs,
      defaultRadioOrder: radioOrder
    };
  }
};

// ================== Helpers ==================
function errObj(code, message) {
  return { success: false, error: code, message };
}

function json(headers, statusCode, obj) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(obj)
  };
}