import { callGoogleSheetBatchAPI } from './googleSheetAPI.js';

// ===== 模組內部變數 =====
let searchInputHandler = null;
let resultContainerHandler = null;

const dayMapping = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7
};

// ===== 初始化函數 =====
export function initMeetingAll() {
    bindMeetingAllEvents();
    console.log('MeetingAll: 初始化完成 ✅');
}

// ===== 清理函數 =====
export function clearMeetingAll() {
    const searchInput = document.getElementById('all-meeting-search-input');
    if (searchInput && searchInputHandler) {
        searchInput.removeEventListener('input', searchInputHandler);
        searchInputHandler = null;
    }
    
    const resultContainer = document.getElementById('all-meeting-result-container');
    if (resultContainer && resultContainerHandler) {
        resultContainer.removeEventListener('click', resultContainerHandler);
        resultContainerHandler = null;
    }
    
    // 清空結果
    if (resultContainer) resultContainer.innerHTML = '';
    const errorDiv = document.getElementById('all-meeting-error');
    if (errorDiv) errorDiv.textContent = '';
    
    console.log('MeetingAll: 已清理 🧹');
}

// ===== 綁定事件 =====
function bindMeetingAllEvents() {
    const searchInput = document.getElementById('all-meeting-search-input');
    if (searchInput) {
        searchInputHandler = function() {
            const query = this.value.trim();
            if (query !== '') {
                fetchAllMeetings(query);
            } else {
                const container = document.getElementById('all-meeting-result-container');
                container.innerHTML = '';
                container.style.display = 'none';
            }
        };
        searchInput.addEventListener('input', searchInputHandler);
    }
    
    const resultContainer = document.getElementById('all-meeting-result-container');
    if (resultContainer) {
        resultContainerHandler = function(event) {
            // 檢查是否點擊了可互動元素
            const isInteractive = event.target.closest('.all-meeting-title, .all-meeting-repeat, .all-meeting-time-range');
            if (!isInteractive) return;

            if (event.target.closest('.all-meeting-title')) {
                const mainToggleBtn = event.target.closest('.all-meeting-title').querySelector('.all-meeting-main-toggle-btn');
                const whiteDiv = mainToggleBtn.closest('.all-meeting-result-item').querySelector('.all-white-background-div');
                whiteDiv.style.display = whiteDiv.style.display === 'none' ? 'block' : 'none';
                mainToggleBtn.classList.toggle('fa-plus');
                mainToggleBtn.classList.toggle('fa-minus');
            }

            if (event.target.closest('.all-meeting-repeat')) {
                const repeatToggleBtn = event.target.closest('.all-meeting-repeat').querySelector('.all-meeting-repeat-toggle-btn');
                const timeDiv = repeatToggleBtn.closest('.all-meeting-repeat').nextElementSibling;
                timeDiv.style.display = timeDiv.style.display === 'none' ? 'block' : 'none';
                repeatToggleBtn.classList.toggle('fa-angle-down');
                repeatToggleBtn.classList.toggle('fa-angle-up');
            }

            if (event.target.closest('.all-meeting-time-range')) {
                const timeRangeDiv = event.target.closest('.all-meeting-time-range');
                const timeToggleBtn = timeRangeDiv.querySelector('.all-meeting-time-toggle-btn');
                if (timeToggleBtn) {
                    const detailDiv = timeRangeDiv.closest('.meeting-wrapper').nextElementSibling;
                    if (detailDiv && detailDiv.classList.contains('all-details-background-div')) {
                        detailDiv.style.display = detailDiv.style.display === 'none' ? 'block' : 'none';
                        timeToggleBtn.classList.toggle('fa-angle-down');
                        timeToggleBtn.classList.toggle('fa-angle-up');
                    }
                }
            }
        };
        resultContainer.addEventListener('click', resultContainerHandler);
    }
}

// ===== Fetch 會議資料 =====
async function fetchAllMeetings(query) {
    try {
        const ranges = ['「騰訊會議(長週期)」!A:K', '「騰訊會議(短週期)」!A:K', '「US版Zoom學員名單(5/15)」!A:K'];
        const data = await callGoogleSheetBatchAPI({ ranges });
        
        let filteredMeetings = [];
        data.valueRanges.forEach(sheetData => {
            const rows = sheetData.values;
            const matchingMeetings = rows.filter(row => row[0] && row[0].toLowerCase().includes(query.toLowerCase()));
            filteredMeetings = filteredMeetings.concat(matchingMeetings);
        });

        displayMeetings(filteredMeetings);
    } catch (error) {
        document.getElementById('all-meeting-error').textContent = '請求失敗：' + error.message;
    }
}

// ===== 顯示會議 =====
function displayMeetings(meetings) {
    const resultContainer = document.getElementById('all-meeting-result-container');
    resultContainer.innerHTML = '';

    if (meetings.length === 0) {
        resultContainer.innerHTML = '<p class="all-no-results">找不到符合條件的會議。</p>';
        resultContainer.style.display = 'block';
        return;
    }

    const meetingMap = {};

    meetings.forEach(meeting => {
        const meetingName = meeting[0];
        const meetingLink = meeting[10] || '#';
        const accountId = meeting[5];
        const meetingType = accountId ? accountId.substring(0, 4).toLowerCase() : '';
        
        if (!meetingMap[meetingName]) {
            meetingMap[meetingName] = {};
        }

        const repeatPattern = meeting[2] ? meeting[2].split(',') : [];
        const timeRange = meeting[4] ? meeting[4].split('-') : null;
        const tag = meeting[3] || '無標籤';

        repeatPattern.forEach(pattern => {
            if (!meetingMap[meetingName][pattern]) {
                meetingMap[meetingName][pattern] = {};
            }
            if (!meetingMap[meetingName][pattern][tag]) {
                meetingMap[meetingName][pattern][tag] = [];
            }

            meetingMap[meetingName][pattern][tag].push({
                meetingTimeRange: timeRange,
                meetingInfo: meeting[6] || '無會議資訊',
                accountid: accountId,
                link: meetingLink,
                type: meetingType,
                startDate: meeting[1],
                endDate: meeting[7]
            });
        });
    });

    for (let meetingName in meetingMap) {
        const meetingItem = document.createElement('div');
        meetingItem.className = 'all-meeting-result-item';

        const meetingTitle = document.createElement('div');
        meetingTitle.className = 'all-meeting-title';
        const titleText = document.createElement('span');
        titleText.textContent = meetingName;
        meetingTitle.appendChild(titleText);

        const mainToggleButton = document.createElement('span');
        mainToggleButton.className = 'all-meeting-main-toggle-btn fa fa-plus';
        meetingTitle.appendChild(mainToggleButton);

        const whiteDiv = document.createElement('div');
        whiteDiv.className = 'all-white-background-div';
        whiteDiv.style.display = 'none';

        const sortedRepeatPatterns = Object.keys(meetingMap[meetingName]).sort((a, b) => {
            return dayMapping[a.charAt(0)] - dayMapping[b.charAt(0)];
        });

        sortedRepeatPatterns.forEach(repeatPattern => {
            const perListDiv = document.createElement('div');
            perListDiv.className = 'all-meeting-per-list';

            const meetingRepeat = document.createElement('div');
            meetingRepeat.className = 'all-meeting-repeat';
            meetingRepeat.textContent = `每週 ${repeatPattern}`;

            const repeatToggleButton = document.createElement('span');
            repeatToggleButton.className = 'all-meeting-repeat-toggle-btn fa fa-angle-down';
            meetingRepeat.appendChild(repeatToggleButton);

            const timeDiv = document.createElement('div');
            timeDiv.className = 'all-time-background-div';
            timeDiv.style.display = 'none';

            Object.keys(meetingMap[meetingName][repeatPattern]).forEach(tag => {
                meetingMap[meetingName][repeatPattern][tag].sort((a, b) => {
                    const timeA = a.meetingTimeRange ? parseInt(a.meetingTimeRange[0].replace(':', ''), 10) : 0;
                    const timeB = b.meetingTimeRange ? parseInt(b.meetingTimeRange[0].replace(':', ''), 10) : 0;
                    return timeA - timeB;
                });

                const tagGroupDiv = document.createElement('div');
                tagGroupDiv.className = 'tag-group';
                tagGroupDiv.style.borderTop = '1px solid #ddd';

                if (tag === '無標籤') tagGroupDiv.classList.add('no-tag');
                else if (tag === '短週期') tagGroupDiv.classList.add('short-cycle');
                else if (tag === '一次性') tagGroupDiv.classList.add('one-time');
                else if (tag === '長週期') tagGroupDiv.classList.add('long-cycle');

                if (tag !== '無標籤') {
                    const tagHeader = document.createElement('div');
                    tagHeader.className = 'tag-header';
                    tagHeader.textContent = tag;
                    tagGroupDiv.appendChild(tagHeader);
                }

                meetingMap[meetingName][repeatPattern][tag].forEach(details => {
                    const meetingWrapper = document.createElement('div');
                    meetingWrapper.className = 'meeting-wrapper';
                    meetingWrapper.style.display = 'flex';

                    const iconDiv = document.createElement('div');
                    iconDiv.className = 'meeting-icon-wrapper';

                    const iconLink = document.createElement('a');
                    iconLink.href = details.link;
                    iconLink.target = '_blank';

                    const iconImg = document.createElement('img');
                    iconImg.src = details.type === 'voov' ? 'img/voov.png' : 'img/zoom.png';
                    iconImg.alt = details.type;
                    iconImg.className = 'meeting-icon';
                    iconLink.appendChild(iconImg);
                    iconDiv.appendChild(iconLink);

                    const meetingTimeRange = document.createElement('div');
                    meetingTimeRange.className = 'all-meeting-time-range';
                    meetingTimeRange.textContent = details.meetingTimeRange 
                        ? `${details.meetingTimeRange[0]} - ${details.meetingTimeRange[1]}` 
                        : '無時間範圍';

                    const timeToggleButton = document.createElement('span');
                    timeToggleButton.className = 'all-meeting-time-toggle-btn fa fa-angle-down';
                    meetingTimeRange.appendChild(timeToggleButton);
                    meetingWrapper.appendChild(iconDiv);
                    meetingWrapper.appendChild(meetingTimeRange);

                    const detailDiv = document.createElement('div');
                    detailDiv.className = 'all-details-background-div';
                    detailDiv.style.display = 'none';

                    const meetingDetails = document.createElement('div');
                    meetingDetails.className = 'all-meeting-details';

                    const meetingInfoElement = document.createElement('p');
                    meetingInfoElement.innerHTML = `<i class="fa fa-info-circle" aria-hidden="true"></i> ${details.meetingInfo}`;

                    const accountElement = document.createElement('p');
                    accountElement.textContent = `開立帳號: ${details.accountid}`;

                    const dateRangeElement = document.createElement('p');
                    const startDate = details.startDate ? details.startDate.replace(/-/g, '/') : '';
                    const endDate = details.endDate ? details.endDate.replace(/-/g, '/') : '';
                    dateRangeElement.textContent = (startDate && endDate) 
                        ? `起訖期間: ${startDate} ~ ${endDate}` 
                        : '起訖期間: -';

                    meetingDetails.appendChild(meetingInfoElement);
                    meetingDetails.appendChild(accountElement);
                    meetingDetails.appendChild(dateRangeElement);
                    detailDiv.appendChild(meetingDetails);

                    tagGroupDiv.appendChild(meetingWrapper);
                    tagGroupDiv.appendChild(detailDiv);
                });

                timeDiv.appendChild(tagGroupDiv);
            });

            perListDiv.appendChild(meetingRepeat);
            perListDiv.appendChild(timeDiv);
            whiteDiv.appendChild(perListDiv);
        });

        meetingItem.appendChild(meetingTitle);
        meetingItem.appendChild(whiteDiv);
        resultContainer.appendChild(meetingItem);
    }

    resultContainer.style.display = 'block';
}