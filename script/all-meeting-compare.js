import { callGoogleSheetBatchAPI } from './googleSheetAPI.js';
import { ConflictChecker } from './ConflictChecker.js';

let conflictCheckerInstance = null;
let settingsButtonHandler = null;
let modalCloseHandler = null;

// 從 Google Sheets 中讀取數據
async function getSheetData(sheetName) {
    const range = `${sheetName}!A:K`;
    try {
        const data = await callGoogleSheetBatchAPI({
            ranges: [range]
        });
        if (data && data.valueRanges && data.valueRanges[0].values) {
            return data.valueRanges[0].values;
        } else {
            console.error('未能獲取到數據或數據結構不正確', data);
            return [];
        }
    } catch (error) {
        console.error(`Google Sheets API 請求失敗 (${sheetName}):`, error);
        return [];
    }
}

// 合併「長週期」和「短週期」會議數據
async function getCombinedMeetingData() {
    const [longCycleData, shortCycleData] = await Promise.all([
        getSheetData('「騰訊會議(長週期)」'),
        getSheetData('「騰訊會議(短週期)」')
    ]);

    const combinedData = [...longCycleData, ...shortCycleData];
    return combinedData;
}

// 解析時間範圍，適用於所有已建立會議比對
function allMeetingCompareParseTime(input) {
    const timePattern1 = /(\d{2})(\d{2})/; // 0000 格式
    const timePattern2 = /(\d{2}):(\d{2})/; // 00:00 格式
    let match = input.match(timePattern1);
    if (match) {
        return `${match[1]}:${match[2]}`;  // 返回格式化的字符串
    }
    match = input.match(timePattern2);
    if (match) {
        return `${match[1]}:${match[2]}`;  // 返回格式化的字符串
    }
    return null;  // 如果解析失敗，返回 null
}

// 將時間字符串轉換為自午夜以來的分鐘數
function timeStringToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

// 獲取日期的星期，返回中文表示
function getDayOfWeek(date) {
    const dayMap = {
        0: '日',
        1: '一',
        2: '二',
        3: '三',
        4: '四',
        5: '五',
        6: '六'
    };
    return dayMap[date.getDay()];
}

// 檢查兩個日期是否相同，適用於所有已建立會議比對
function allMeetingCompareIsSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

// 檢查日期範圍是否重疊
function dateRangesOverlap(startDate1, endDate1, startDate2, endDate2) {
    return (startDate1 <= endDate2) && (startDate2 <= endDate1);
}

// 檢查會議是否發生在相同的日期或重複週期
function allMeetingCompareIsSameMeetingDay(meeting1, meeting2) {
    const meeting1StartDate = meeting1.startDate;
    const meeting1EndDate = meeting1.endDate;
    const meeting2StartDate = meeting2.startDate;
    const meeting2EndDate = meeting2.endDate;

    const meeting1Repeat = meeting1.repeatPattern; // e.g., ['日', '三']
    const meeting2Repeat = meeting2.repeatPattern;

    // 首先檢查日期範圍是否重疊
    if (!dateRangesOverlap(meeting1StartDate, meeting1EndDate, meeting2StartDate, meeting2EndDate)) {
        return false; // 日期範圍不重疊
    }

    // 檢查會議是否有相同的重複週期
    if (meeting1Repeat.length > 0 && meeting2Repeat.length > 0) {
        return meeting1Repeat.some(day => meeting2Repeat.includes(day));
    } else if (meeting1Repeat.length > 0 && meeting2Repeat.length === 0) {
        // meeting1 重複，meeting2 不重複
        const meeting2DayOfWeek = getDayOfWeek(meeting2StartDate);
        return meeting1Repeat.includes(meeting2DayOfWeek);
    } else if (meeting1Repeat.length === 0 && meeting2Repeat.length > 0) {
        // meeting2 重複，meeting1 不重複
        const meeting1DayOfWeek = getDayOfWeek(meeting1StartDate);
        return meeting2Repeat.includes(meeting1DayOfWeek);
    } else {
        // 如果沒有重複週期，則檢查是否是同一天
        return allMeetingCompareIsSameDay(meeting1StartDate, meeting2StartDate);
    }
}

// 檢查會議時間是否重疊
export function allMeetingCompareCheckForConflicts(meetings) {
    const conflicts = [];

    for (let i = 0; i < meetings.length; i++) {
        for (let j = i + 1; j < meetings.length; j++) {
            const meeting1 = meetings[i];
            const meeting2 = meetings[j];

            // 檢查會議是否在同一天或重複週期匹配，且日期範圍重疊
            if (!allMeetingCompareIsSameMeetingDay(meeting1, meeting2)) {
                continue; // 如果不是同一天或不同週期，跳過這對會議
            }

            // 解析時間範圍
            const start1 = allMeetingCompareParseTime(meeting1.timeRange.split('-')[0]);
            const end1 = allMeetingCompareParseTime(meeting1.timeRange.split('-')[1]);
            const start2 = allMeetingCompareParseTime(meeting2.timeRange.split('-')[0]);
            const end2 = allMeetingCompareParseTime(meeting2.timeRange.split('-')[1]);

            if (!start1 || !end1 || !start2 || !end2) {
                console.warn(`無法解析時間範圍: ${meeting1.timeRange} 或 ${meeting2.timeRange}`);
                continue;
            }

            const meeting1StartMinutes = timeStringToMinutes(start1);
            const meeting1EndMinutes = timeStringToMinutes(end1);
            const meeting2StartMinutes = timeStringToMinutes(start2);
            const meeting2EndMinutes = timeStringToMinutes(end2);

            // 檢查時間是否重疊
            if (meeting1EndMinutes > meeting2StartMinutes && meeting1StartMinutes < meeting2EndMinutes) {
                conflicts.push({ meeting1, meeting2 });
            }
        }
    }

    return conflicts;
}

// 處理會議數據，並檢查是否有重疊
async function processMeetingsAndCheckConflicts() {
    const meetingData = await getCombinedMeetingData(); // 讀取並合併數據
    const accountResults = await allMeetingCompareProcessMeetingData(meetingData); // 處理會議數據

    if (accountResults) {
        const conflictsHTML = generateConflictsHTML(accountResults); // 生成結果 HTML
        document.getElementById('modal-meeting-results').innerHTML = conflictsHTML; // 顯示在結果區域
    } else {
        document.getElementById('modal-meeting-results').innerHTML = '未能獲取到會議結果。';
    }
}

// 用來解析會議的主要邏輯
async function allMeetingCompareProcessMeetingData(rows) {
    const accountResults = {};

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 11) continue; // 確保行數據存在並且有足夠的列數 (A 到 K)

        const meetingName = row[0] || ''; 
        const startDate = row[1] ? new Date(row[1]) : null;
        if (startDate) {
            startDate.setHours(0, 0, 0, 0);
        }
        const endDate = row[7] ? new Date(row[7]) : null;
        if (endDate) {
            endDate.setHours(0, 0, 0, 0);
        }
        const meetingTimeRange = row[4] ? row[4].split('-') : null;
        const accountid = row[5] || '';
        const meetingInfo = row[6] || '';
        const repeatPattern = row[2] ? row[2].split(',') : [];
        const label = (row.length > 3 && row[3]) ? row[3] : '';
        const meetingLink = row[10] || ''; // 假設 column K 是第 11 列，存放會議連結

        if (!meetingName || !startDate || !endDate || !meetingTimeRange || !accountid) {
            continue;
        }

        if (!accountResults[accountid]) {
            accountResults[accountid] = {
                hasMeeting: true,
                meetings: []
            };
        }

        accountResults[accountid].meetings.push({
            name: meetingName,
            startDate: startDate,
            endDate: endDate,
            timeRange: `${meetingTimeRange[0]}-${meetingTimeRange[1]}`,
            repeatPattern: repeatPattern,
            label: label,
            link: meetingLink // 將會議連結添加到會議數據中
        });
    }

    return accountResults;
}

// 根據會議衝突生成結果的 HTML
function generateConflictsHTML(accountResults) {
    let resultsHTML = '';
    let hasConflicts = false; // 用來標記是否有任何衝突

    for (const account in accountResults) {
        const accountData = accountResults[account];
        const conflicts = allMeetingCompareCheckForConflicts(accountData.meetings);

        // 只在有會議衝突時顯示帳號信息
        if (conflicts.length > 0) {
            hasConflicts = true; // 設置為有衝突

            resultsHTML += `<div class="account-section">
                                <h4>${account}</h4>`;

            conflicts.forEach(conflict => {
                const meeting1 = conflict.meeting1;
                const meeting2 = conflict.meeting2;
                const meeting1Link = meeting1.link || '';
                const meeting2Link = meeting2.link || '';

                // 左右布局的會議卡片
                resultsHTML += `<div class="conflict-card-container">
                                    <!-- 會議 1 詳細資訊 -->
                                    <div class="conflict-card">
                                        <div>
                                            <i class="fa fa-repeat"></i> <strong>每週</strong> ${meeting1.repeatPattern.join(',')}
                                        </div>
                                        <div>
                                            <i class="fa fa-clock"></i> <strong>時間:</strong> ${meeting1.timeRange}
                                        </div>
                                        <div>
                                            <i class="fa fa-calendar-alt"></i> ${formatDateToLocal(meeting1.startDate)} ～ ${formatDateToLocal(meeting1.endDate)}
                                        </div>
                                        <p class="meeting-check-details">
                                            <i class="fa fa-info-circle"></i> ${meeting1.name}<br>${meeting1Link ? meeting1Link : ''}
                                        </p>
                                    </div>

                                    <!-- 會議 2 詳細資訊 -->
                                    <div class="conflict-card">
                                        <div>
                                            <i class="fa fa-repeat"></i> <strong>每週</strong> ${meeting2.repeatPattern.join(',')}
                                        </div>
                                        <div>
                                            <i class="fa fa-clock"></i> <strong>時間:</strong> ${meeting2.timeRange}
                                        </div>
                                        <div>
                                            <i class="fa fa-calendar-alt"></i> ${formatDateToLocal(meeting2.startDate)} ～ ${formatDateToLocal(meeting2.endDate)}
                                        </div>
                                        <p class="meeting-check-details">
                                            <i class="fa fa-info-circle"></i> ${meeting2.name}<br>${meeting2Link ? meeting2Link : ''}
                                        </p>
                                    </div>
                                </div>`;
            });

            resultsHTML += `</div><hr>`; // 在每個帳號之後添加分隔線
        }
    }

    // 如果完全沒有衝突，顯示圖標和提示文字
    if (!hasConflicts) {
        resultsHTML = `
            <div style="text-align: center; margin-top: 20px;">
                <i class="fa-regular fa-thumbs-up" style="font-size: 48px; color: #4caf50;"></i>
                <p>目前還沒有</p>
            </div>
        `;
    }

    return resultsHTML;
}

// 日期格式化函數
function formatDateToLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份從 0 開始
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 從 Google Sheets 中讀取數據 (供 ConflictChecker 使用)
export async function getAccountResultsFromSheet() {
    const meetingData = await getCombinedMeetingData();
    return allMeetingCompareProcessMeetingData(meetingData);
}

// 初始化函數 - 供 mediator 呼叫
export async function initAllMeetingCompare() {
    // 初始化 ConflictChecker
    conflictCheckerInstance = new ConflictChecker();
    await conflictCheckerInstance.start();
    
    // 綁定 settings-button 事件
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
        settingsButtonHandler = async function() {
            const modal = document.getElementById('results-modal');
            modal.style.display = "block";
            document.getElementById('modal-meeting-results').innerHTML = '';
            await processMeetingsAndCheckConflicts();
        };
        settingsButton.addEventListener('click', settingsButtonHandler);
    }
    
    // 綁定 modal close 事件
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        modalCloseHandler = function() {
            document.getElementById('results-modal').style.display = "none";
        };
        closeBtn.addEventListener('click', modalCloseHandler);
    }
    
    console.log('AllMeetingCompare: 初始化完成 ✅');
}

// 清理函數 - 供 mediator 呼叫
export function clearAllMeetingCompare() {
    // 停止 ConflictChecker
    if (conflictCheckerInstance) {
        conflictCheckerInstance.stop(); // 需要在 ConflictChecker 加入 stop 方法
        conflictCheckerInstance = null;
    }
    
    // 移除事件監聽器
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton && settingsButtonHandler) {
        settingsButton.removeEventListener('click', settingsButtonHandler);
        settingsButtonHandler = null;
    }
    
    const closeBtn = document.querySelector('.close');
    if (closeBtn && modalCloseHandler) {
        closeBtn.removeEventListener('click', modalCloseHandler);
        modalCloseHandler = null;
    }
    
    // 隱藏 warning icon
    if (settingsButton) {
        settingsButton.style.display = 'none';
    }
    
    console.log('AllMeetingCompare: 已清理 🧹');
}