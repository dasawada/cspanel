// 您的 OAuth 2.0 客户端 ID 和 API 密钥
const CLIENT_ID = '585720814315-egtk2cbg4jbltvkah9nsmkmer21rkqb4.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];
const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";
const sheetId = '1FcjzaPWepGLRwdwyyefvZs_HEXhC168MircYGqpV9eQ';

function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(function () {
        // 监听登录状态变化
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

        // 初始登录状态
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

        gapiInitialized = true; // 标记初始化完成
        console.log('Google API 客户端库已初始化');
    }, function(error) {
        console.error('Google API 初始化失败：', JSON.stringify(error, null, 2));
    });
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        console.log('用户已登录');
    } else {
        console.log('用户未登录，正在引导用户登录');
        gapi.auth2.getAuthInstance().signIn().catch(function(error) {
            console.error('登录失败：', error);
        });
    }
}

function handleAuthClick(event) {
    gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick(event) {
    gapi.auth2.getAuthInstance().signOut();
}

// 在页面加载完成后调用
document.addEventListener('DOMContentLoaded', function() {
    handleClientLoad();

    // 标题生成的浮水印
    document.querySelectorAll('.optitle-input').forEach(input => {
        const placeholder = input.nextElementSibling;
        if (input.value) {
            placeholder.style.visibility = 'hidden';
        }
        input.addEventListener('focus', () => {
            placeholder.style.visibility = 'hidden';
        });
        input.addEventListener('blur', () => {
            if (!input.value) {
                placeholder.style.visibility = 'visible';
            }
        });
        input.addEventListener('input', () => {
            if (input.value) {
                placeholder.style.visibility = 'hidden';
            } else {
                placeholder.style.visibility = 'visible';
            }
            checkInputs(); // 每次输入改变时检查输入框值
        });
    });

    // 事件监听器
    document.getElementById('consultantName').addEventListener('input', function() {
        checkInputs();
        search();
    });
    document.getElementById('studentName').addEventListener('input', checkInputs);
    document.getElementById('parentName').addEventListener('input', checkInputs);
    document.getElementById('invoiceNumber').addEventListener('input', checkInputs);
    document.getElementById('clearButton').addEventListener('click', clearFields);
});

// 检查输入框值，并生成或清除输出
function checkInputs() {
    var consultantName = document.getElementById("consultantName").value.trim();
    var studentName = document.getElementById("studentName").value.trim();
    var parentName = document.getElementById("parentName").value.trim();
    var invoiceNumber = document.getElementById("invoiceNumber").value.trim();

    // 如果所有输入框都为空，则清除输出并显示默认文本
    if (consultantName === '' && studentName === '' && parentName === '' && invoiceNumber === '') {
        clearOutput(); // 清除输出内容
    } else {
        // 如果其中任一输入框有值，则生成结果
        generateText();
    }
}

// 将上述标题组合成固定格式，并清除空白键及单号中的井字
function generateText() {
    var consultantName = document.getElementById("consultantName").value.replace(/\s/g, '');
    var studentName = document.getElementById("studentName").value.replace(/\s/g, '');
    var parentName = document.getElementById("parentName").value.replace(/\s/g, '');
    var invoiceNumber = document.getElementById("invoiceNumber").value.replace(/[#\s]/g, '');

    var outputText = "[顧問 " + consultantName + "] " + studentName;
    
    if (studentName !== '' && parentName !== '') {
        outputText += " / " + parentName;
    } else {
        outputText += parentName;
    }

    if (invoiceNumber !== '') {
        outputText += " #" + invoiceNumber;
    }

    var copyButtonHTML = '<button id="OPtitle_copyButton" type="button" onclick="OPtitle_copyText(event)" style="border: none; margin-left: 6px;" title="複製到剪貼簿">' +
                         '<img src="img/copy-icon.png" alt="複製標題" style="width: 15px; height: 15px;">' +
                         '</button>';

    const optitleOutput = document.getElementById("optitleoutput");
    optitleOutput.style.transform = "scale(1.1)";
    optitleOutput.style.opacity = "0.5";

    // 更新文本和按钮
    optitleOutput.innerHTML = outputText + copyButtonHTML;

    // 恢复样式
    setTimeout(() => {
        optitleOutput.style.transform = "scale(1)";
        optitleOutput.style.opacity = "1";
    }, 100);
}

// 清除文本，重置为默认文本
function clearOutput() {
    const optitleOutput = document.getElementById("optitleoutput");
    optitleOutput.style.transform = "scale(1.1)";
    optitleOutput.style.opacity = "0.5";
    
    setTimeout(() => {
        optitleOutput.innerText = "生成的標題會顯示在這裡٩(๑❛ᴗ❛๑)۶";
        optitleOutput.style.transform = "scale(1)";
        optitleOutput.style.opacity = "1";
    }, 1000);
}

// 复制按钮功能
function OPtitle_copyText(event) {
    event.preventDefault();
    var textToCopy = document.getElementById("optitleoutput").innerText;
    var tempInput = document.createElement("input");
    tempInput.value = textToCopy;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);

    // 将按钮设置为已复制状态
    var copyButton = document.getElementById("OPtitle_copyButton");
    copyButton.classList.add("OPtitle_copied", "OPtitle_unclickable");
	
    // 重新触发 title 属性更新
    var tempTitle = copyButton.title;
    copyButton.title = "";
    copyButton.title = tempTitle;

    // 三秒后恢复按钮为可点击状态
    setTimeout(function() {
        copyButton.classList.remove("OPtitle_copied", "OPtitle_unclickable");
    }, 3000);
}

// 清除指定的输入字段
function clearFields() {
    // 清空字段的逻辑
    document.getElementById("consultantName").value = "";
    document.getElementById("studentName").value = "";
    document.getElementById("parentName").value = "";
    document.getElementById("invoiceNumber").value = "";
    
    // 手动触发 blur 事件
    document.getElementById("consultantName").dispatchEvent(new Event('blur'));
    document.getElementById("studentName").dispatchEvent(new Event('blur'));
    document.getElementById("parentName").dispatchEvent(new Event('blur'));
    document.getElementById("invoiceNumber").dispatchEvent(new Event('blur'));

    clearOutput(); // 清除输出内容
    search();
	
    // 获取垃圾桶按钮元素
    const button = document.getElementById('clearButton');
    // 获取图标元素
    const icon = button.querySelector('i');
    // 添加动画效果
    icon.classList.add('trash-animated');
    
    // 等待动画结束后移除动画类
    setTimeout(() => {
        icon.classList.remove('trash-animated');
    }, 1000); // 动画持续时间1秒
}

// search 函数只处理 consultantName
function search() {
    var searchString = document.getElementById('consultantName').value.replace(/\s+/g, '');

    if (searchString === '') {
        const searchResultsDiv = document.getElementById('search_SAWHO_ResultsDiv');
        const searchResultsSpan = document.getElementById('search_SAWHO_ResultsSpan');
        if (searchResultsDiv) {
            searchResultsDiv.innerHTML = '';
        }
        if (searchResultsSpan) {
            searchResultsSpan.innerHTML = '';
        }
        clearOutput(); // 清除输出内容
        return;
    }

    // 检查 gapi 是否已初始化
    if (!gapiInitialized) {
        console.warn('Google API 尚未初始化，等待初始化完成后再尝试');
        return;
    }

    // 检查用户是否已登录
    if (!gapi.auth2.getAuthInstance().isSignedIn.get()) {
        console.warn('用户未登录，正在引导用户登录');
        gapi.auth2.getAuthInstance().signIn().then(() => {
            // 登录成功后再次调用 search
            search();
        }).catch(function(error) {
            console.error('登录失败：', error);
        });
        return;
    }

    // 始终生成文本
    generateText();

    // 使用 gapi.client.sheets.spreadsheets.values.get 方法获取数据
    var params = {
        spreadsheetId: sheetId,
        range: '顧問組別清單',
    };

    gapi.client.sheets.spreadsheets.values.get(params).then(function(response) {
        var result = response.result;
        // 处理数据
        const values = result.values;

        const search_SAWHO_ResultsSpan = document.getElementById('search_SAWHO_ResultsSpan');
        const search_SAWHO_ResultsDiv = document.getElementById('search_SAWHO_ResultsDiv');

        search_SAWHO_ResultsSpan.innerHTML = '';
        search_SAWHO_ResultsDiv.innerHTML = '';

        let found = false;
        for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
            for (let columnIndex = 0; columnIndex < values[rowIndex].length; columnIndex++) {
                const cellValue = values[rowIndex][columnIndex].replace(/\s+/g, '').toLowerCase();
                if (cellValue === searchString.toLowerCase()) {
                    const resultColumnIdentifier = String.fromCharCode('A'.charCodeAt(0) + columnIndex);
                    const teamLeaderRow = 3;
                    const teamRow = teamLeaderRow - 1;

                    const consultantName = values[rowIndex][columnIndex];
                    const teamLeaderValue = values[teamLeaderRow][columnIndex];
                    const teamValue = values[teamRow][columnIndex];

                    const p = document.createElement('p');

                    // 顾问名称部分
                    const consultantSpan = document.createElement('span');
                    consultantSpan.textContent = consultantName;
                    consultantSpan.className = 'green-gradient-text copyable-text';
                    consultantSpan.style.cursor = 'pointer';
                    consultantSpan.title = '點我一下複製名字';

                    consultantSpan.addEventListener('click', function() {
                        const tempInput = document.createElement('input');
                        if (consultantName.length <= 2) {
                            tempInput.value = consultantName.slice(-1); // 若顾问名为两个字符或更少，复制最后一个字符
                        } else {
                            tempInput.value = consultantName.slice(-2); // 复制最后两个字符
                        }
                        document.body.appendChild(tempInput);
                        tempInput.select();
                        document.execCommand('copy');
                        document.body.removeChild(tempInput);
                        consultantSpan.title = '已複製！';

                        // 一秒后恢复 title
                        setTimeout(function() {
                            consultantSpan.title = '點我一下複製名字';
                        }, 1000);
                    });

                    // 组长部分
                    const leaderSpan = document.createElement('span');
                    leaderSpan.textContent = teamLeaderValue;
                    leaderSpan.className = 'yellow-gradient-text copyable-text';
                    leaderSpan.style.cursor = 'pointer';
                    leaderSpan.title = '點我一下複製名字';

                    leaderSpan.addEventListener('click', function() {
                        const tempInput = document.createElement('input');
                        tempInput.value = teamLeaderValue.slice(-2); // 复制第二个字起的组长名
                        document.body.appendChild(tempInput);
                        tempInput.select();
                        document.execCommand('copy');
                        document.body.removeChild(tempInput);
                        leaderSpan.title = '已複製！';

                        // 一秒后恢复 title
                        setTimeout(function() {
                            leaderSpan.title = '點我一下複製名字';
                        }, 1000);
                    });

                    // 构建完整的文本
                    p.appendChild(document.createTextNode('顧問'));
                    p.appendChild(consultantSpan);
                    p.appendChild(document.createTextNode('的組長是：'));
                    p.appendChild(leaderSpan);
                    p.appendChild(document.createTextNode(`（team：${teamValue}）`));

                    search_SAWHO_ResultsSpan.appendChild(p);

                    found = true;
                    break;
                }
            }
            if (found) {
                break;
            }
        }

        if (!found) {
            const p = document.createElement('p');
            p.textContent = `【${searchString}】咦？這顧問找不到組長唷ఠ_ఠ`;
            search_SAWHO_ResultsDiv.appendChild(p);
        }

    }, function(reason) {
        console.error('数据获取失败：' + reason.result.error.message);
    });
}

// 更新 optitleoutput 的内容
let previousOptitleOutput = '';

function updateOptitleOutput(content) {
    previousOptitleOutput = content;
    document.getElementById('optitleoutput').innerHTML = content;
}

// 清空 optitleoutput 但保留先前的结果
function clearOptitleOutput() {
    document.getElementById('optitleoutput').innerHTML = previousOptitleOutput;
}
