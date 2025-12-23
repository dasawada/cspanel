function assistIssueEscapeHtml(text) {
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function assistIssueGenerateOutput() {
            const classInfo = document.getElementById('assist-issue-classInfo').value;
            const issueDescription = document.getElementById('assist-issue-issueDescription').value;
            const outputContainer = document.getElementById('assist-issue-outputContainer');
            
            // 清除之前的輸出
            outputContainer.innerHTML = '';
            
            // 如果沒有輸入值，直接返回
            if (!classInfo.trim()) {
                return;
            }

            const lines = classInfo.split('\n').filter(line => line.trim() !== '');
            
            if (lines.length < 6) {
                alert('請確保輸入的資訊格式正確。');
                return;
            }
            
            const dateTime = assistIssueEscapeHtml(lines[0] + " " + lines[1]);
            const studentName = assistIssueEscapeHtml(lines[3]);
            const teacherName = assistIssueEscapeHtml(lines[5]);
            const issueDescriptionEscaped = assistIssueEscapeHtml(issueDescription);
            
            const outputItem = document.createElement('div');
            outputItem.className = 'assist-issue-output-item';
            
            const studentOutput = document.createElement('span');
            studentOutput.textContent = `學生姓名：${studentName}`;
            
            const classOutput = document.createElement('span');
            classOutput.textContent = `課程資訊：${dateTime} 老師：${teacherName}`;
            
            const issueOutput = document.createElement('span');
            issueOutput.textContent = '問題說明：';
            
            const descriptionOutput = document.createElement('span');
            descriptionOutput.innerHTML = issueDescriptionEscaped.replace(/\n/g, '<br>');
            
            outputItem.appendChild(studentOutput);
            outputItem.appendChild(document.createElement('br'));
            outputItem.appendChild(classOutput);
            outputItem.appendChild(document.createElement('br'));
            outputItem.appendChild(issueOutput);
            outputItem.appendChild(document.createElement('br'));
            outputItem.appendChild(descriptionOutput);
            
            outputContainer.appendChild(outputItem);
        }

        function assistIssueClearFields() {
            document.getElementById('assist-issue-classInfo').value = '';
            document.getElementById('assist-issue-issueDescription').value = '';
            document.getElementById('assist-issue-outputContainer').innerHTML = '';
        }

        function assistIssueCopyContent() {
            const outputContainer = document.getElementById('assist-issue-outputContainer');
            const copyButton = document.getElementById('assist-issue-copyButton');
            const range = document.createRange();
            range.selectNode(outputContainer);
            window.getSelection().removeAllRanges(); // Clear any existing selections
            window.getSelection().addRange(range);

            try {
                document.execCommand('copy');
                copyButton.textContent = '已複製';
                copyButton.classList.add('copied');
                setTimeout(() => {
                    copyButton.textContent = '複製內容';
                    copyButton.classList.remove('copied');
                }, 2000); // 2秒後恢復按鈕文字和樣式
            } catch (err) {
                copyButton.textContent = '複製失敗';
                setTimeout(() => {
                    copyButton.textContent = '複製內容';
                }, 2000); // 2秒後恢復按鈕文字
            }

            window.getSelection().removeAllRanges(); // Clear the selection
        }

        document.addEventListener('DOMContentLoaded', function() {
            const toggleCheckbox = document.getElementById('assist-issue-toggleCheckbox');
            const content = document.getElementById('assist-issue-content');
            
            if (toggleCheckbox && content) {
                toggleCheckbox.addEventListener('change', function() {
                    content.style.display = this.checked ? 'block' : 'none';
                });
            }

            // 其他事件監聽器
            const classInfo = document.getElementById('assist-issue-classInfo');
            const issueDescription = document.getElementById('assist-issue-issueDescription');
            const clearButton = document.getElementById('assist-issue-clearButton');
            const copyButton = document.getElementById('assist-issue-copyButton');

            if (classInfo) {
                classInfo.addEventListener('input', assistIssueGenerateOutput);
            }
            if (issueDescription) {
                issueDescription.addEventListener('input', assistIssueGenerateOutput);
            }
            if (clearButton) {
                clearButton.addEventListener('click', assistIssueClearFields);
            }
            if (copyButton) {
                copyButton.addEventListener('click', assistIssueCopyContent);
            }
        });



