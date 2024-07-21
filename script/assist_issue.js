        function escapeHtml(text) {
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

        document.getElementById('assist-issue-classInfo').addEventListener('input', assistIssueGenerateOutput);
        document.getElementById('assist-issue-issueDescription').addEventListener('input', assistIssueGenerateOutput);
        document.getElementById('assist-issue-clearButton').addEventListener('click', assistIssueClearFields);

        document.getElementById('assist-issue-toggleCheckbox').addEventListener('change', function() {
            const content = document.getElementById('assist-issue-content');
            if (this.checked) {
                content.style.display = 'block';
            } else {
                content.style.display = 'none';
            }
        });