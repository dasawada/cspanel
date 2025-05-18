import { callGoogleSheetBatchAPI } from './googleSheetAPI.js';

// 定義 dayMapping 在頂部
const dayMapping = {
    '一': 1,
    '二': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '日': 7
};

// 動態監聽輸入框並顯示結果
document.getElementById('all-meeting-search-input').addEventListener('input', function() {
    const query = this.value.trim();
    
    if (query !== '') {
        // 呼叫函數從 Google Sheets 中搜尋會議
        fetchAllMeetings(query);
    } else {
        document.getElementById('all-meeting-result-container').innerHTML = '';
        document.getElementById('all-meeting-result-container').style.display = 'none'; // 隱藏結果區域
    }
});

// Fetch 會議資料
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

// 顯示會議名稱和相關資訊，並將邏輯修改為四層結構
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
                startDate: meeting[1], // column B
                endDate: meeting[7]    // column H
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
    // 對每個標籤中的會議時間進行排序
    meetingMap[meetingName][repeatPattern][tag].sort((a, b) => {
        const timeA = a.meetingTimeRange ? parseInt(a.meetingTimeRange[0].replace(':', ''), 10) : 0;
        const timeB = b.meetingTimeRange ? parseInt(b.meetingTimeRange[0].replace(':', ''), 10) : 0;
        return timeA - timeB;
    });

    const tagGroupDiv = document.createElement('div');
    tagGroupDiv.className = 'tag-group';
    tagGroupDiv.style.borderTop = '1px solid #ddd';

				// 根據 tag 名稱添加相應的類別
				if (tag === '無標籤') {
					tagGroupDiv.classList.add('no-tag');
				} else if (tag === '短週期') {
					tagGroupDiv.classList.add('short-cycle');
				} else if (tag === '一次性') {
					tagGroupDiv.classList.add('one-time');
				} else if (tag === '長週期') {
					tagGroupDiv.classList.add('long-cycle'); // 為長週期添加類別
				}

				// 如果 tag 不是 "無標籤"，則顯示標籤標題
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

					// 直接在 meetingTimeRange 元素上綁定點擊事件
					meetingTimeRange.addEventListener('click', function() {
						const isDetailVisible = detailDiv.style.display === 'block';
						detailDiv.style.display = isDetailVisible ? 'none' : 'block';

						// 切換摺疊按鈕圖示
						timeToggleButton.classList.toggle('fa-angle-down');
						timeToggleButton.classList.toggle('fa-angle-up');
					});

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

                    // 新增：顯示起迄日期
                    const dateRangeElement = document.createElement('p');
                    const startDate = details.startDate ? details.startDate.replace(/-/g, '/') : '';
                    const endDate = details.endDate ? details.endDate.replace(/-/g, '/') : '';
                    if (startDate && endDate) {
                        dateRangeElement.textContent = `起訖期間: ${startDate} ~ ${endDate}`;
                    } else {
                        dateRangeElement.textContent = '起訖期間: -';
                    }

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

// 使用事件委託來處理展開和收合功能
document.getElementById('all-meeting-result-container').addEventListener('click', function(event) {
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
	
// 綁定事件在整個 .all-meeting-time-range 上，而不只是 .all-meeting-time-toggle-btn
if (event.target.closest('.all-meeting-time-range')) {
        const timeRangeDiv = event.target.closest('.all-meeting-time-range');
        const timeToggleBtn = timeRangeDiv.querySelector('.all-meeting-time-toggle-btn');
        
        if (timeToggleBtn) {
            const detailDiv = timeRangeDiv.nextElementSibling;
            if (detailDiv && detailDiv.classList.contains('all-details-background-div')) {
                detailDiv.style.display = detailDiv.style.display === 'none' ? 'block' : 'none';
                timeToggleBtn.classList.toggle('fa-angle-down');
                timeToggleBtn.classList.toggle('fa-angle-up');
            }
        }
    }
});
