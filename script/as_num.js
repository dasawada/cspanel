        const assist_num_apiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
        const assist_num_spreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';
        const assist_num_sheetName = '輔導電話';

        document.getElementById('assist_num_searchValue').addEventListener('input', assist_num_searchSheet);

        async function assist_num_searchSheet() {
            const searchValue = document.getElementById('assist_num_searchValue').value.trim();
            if (!searchValue) {
                const resultElement = document.getElementById('assist_num_result');
                resultElement.innerText = '';
                resultElement.classList.add('assist_num_uncopiable');
                return;
            }

            const url = `https://sheets.googleapis.com/v4/spreadsheets/${assist_num_spreadsheetId}/values/${assist_num_sheetName}?key=${assist_num_apiKey}`;
            const response = await fetch(url);
            const data = await response.json();

            const rows = data.values;
            let result = '';

            if (isNaN(searchValue)) {
                // Search for text input and find the phone number on the right
                for (let row of rows) {
                    const index = row.indexOf(searchValue);
                    if (index !== -1 && index < row.length - 1) {
                        result = row[index + 1];
                        break;
                    }
                }
            } else {
                // Search for numeric input and find the value on the left
                for (let row of rows) {
                    const index = row.indexOf(searchValue);
                    if (index !== -1 && index > 0) {
                        result = row[index - 1];
                        break;
                    }
                }
            }

            const resultElement = document.getElementById('assist_num_result');
            if (result) {
                resultElement.innerText = `${result}`;
                resultElement.classList.remove('assist_num_uncopiable');
            } else {
                resultElement.innerText = 'No matching value found.';
                resultElement.classList.add('assist_num_uncopiable');
            }
        }

        function assist_num_copyToClipboard(element) {
            if (element.classList.contains('assist_num_uncopiable')) {
                return;
            }

            const text = element.innerText;
            navigator.clipboard.writeText(text).then(() => {
                element.classList.add('assist_num_copied');
                setTimeout(() => {
                    element.classList.remove('assist_num_copied');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
            });
        }