const CLIENT_ID = '585720814315-egtk2cbg4jbltvkah9nsmkmer21rkqb4.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAACAPVwRkK2Ii1nc8oJ8q0ha1ZF3gHlQU';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly';

const sheetId = "1FcjzaPWepGLRwdwyyefvZs_HEXhC168MircYGqpV9eQ";
const range = "顧問組別清單";

// 初始化 Google API 客戶端
function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: [DISCOVERY_DOC],
        scope: SCOPES,
    }).then(() => {
        const authInstance = gapi.auth2.getAuthInstance();
        authInstance.isSignedIn.listen(updateSigninStatus);
        updateSigninStatus(authInstance.isSignedIn.get());

        document.getElementById('authorize-button').onclick = () => authInstance.signIn();
        document.getElementById('signout-button').onclick = () => authInstance.signOut();
    });
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        document.getElementById('authorize-button').style.display = 'none';
        document.getElementById('signout-button').style.display = 'block';
        search(); // 使用者登入後執行搜尋
    } else {
        document.getElementById('authorize-button').style.display = 'block';
        document.getElementById('signout-button').style.display = 'none';
    }
}

// 搜尋函數（OAuth 2.0 驗證後請求 Google Sheets 資料）
function search() {
    const consultantName = document.getElementById('consultantName').value.trim().replace(/\s+/g, '');
    if (!consultantName) {
        clearOutput();
        return;
    }

    gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range,
    }).then(response => {
        const data = response.result.values;
        processSearchResults(data, consultantName);
    }).catch(error => {
        console.error('Error accessing Google Sheets:', error);
        document.getElementById('search_SAWHO_ResultsDiv').innerText = '無法存取資料';
    });
}

// 處理搜尋結果
function processSearchResults(data, searchString) {
    const searchResultsDiv = document.getElementById('search_SAWHO_ResultsDiv');
    const searchResultsSpan = document.getElementById('search_SAWHO_ResultsSpan');
    searchResultsDiv.innerHTML = '';
    searchResultsSpan.innerHTML = '';

    let found = false;
    data.forEach((row, rowIndex) => {
        row.forEach((cellValue, columnIndex) => {
            if (cellValue?.replace(/\s+/g, '').toLowerCase() === searchString.toLowerCase()) {
                const teamLeaderRow = 3;
                const teamRow = teamLeaderRow - 1;

                const consultantName = cellValue;
                const teamLeaderValue = data[teamLeaderRow][columnIndex];
                const teamValue = data[teamRow][columnIndex];

                const p = document.createElement('p');
                const consultantSpan = createCopyableSpan(consultantName, 'green-gradient-text', '顧問名稱');
                const leaderSpan = createCopyableSpan(teamLeaderValue, 'yellow-gradient-text', '組長名稱');

                p.appendChild(document.createTextNode('顧問'));
                p.appendChild(consultantSpan);
                p.appendChild(document.createTextNode('的組長是：'));
                p.appendChild(leaderSpan);
                p.appendChild(document.createTextNode(`（team：${teamValue}）`));

                searchResultsSpan.appendChild(p);
                found = true;
            }
        });
    });

    if (!found) {
        const p = document.createElement('p');
        p.textContent = `【${searchString}】咦？這顧問找不到組長唷ఠ_ఠ`;
        searchResultsDiv.appendChild(p);
    }
}

// 創建可複製的 Span 元素
function createCopyableSpan(text, className, title) {
    const span = document.createElement('span');
    span.textContent = text;
    span.className = `${className} copyable-text`;
    span.style.cursor = 'pointer';
    span.title = `點我一下複製${title}`;
    span.addEventListener('click', () => {
        const tempInput = document.createElement('input');
        tempInput.value = text.slice(-2);
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        span.title = `已複製${title}`;
        setTimeout(() => (span.title = `點我一下複製${title}`), 1000);
    });
    return span;
}

// 清除輸出
function clearOutput() {
    document.getElementById('search_SAWHO_ResultsDiv').innerHTML = '';
    document.getElementById('search_SAWHO_ResultsSpan').innerHTML = '';
}

// 初始化
document.addEventListener('DOMContentLoaded', function () {
    handleClientLoad();
});
