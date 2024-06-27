// Load the API client and auth2 library
function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

// Initialize the API client library and set up sign-in state listeners.
function initClient() {
    gapi.client.init({
        apiKey: 'ea2e832bf4fb24ce8a88e21a13ff775f4279011c',
        discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
    }).then(function () {
        // The client is ready to use the API
    });
}

function removeSpaces() {
    let input = document.getElementById('searchInput');
    input.value = input.value.replace(/\s/g, '');
}

function searchGoogleSheet() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sheetId = '1FcjzaPWepGLRwdwyyefvZs_HEXhC168MircYGqpV9eQ';
    const range = 'Sheet1!A1:Z1000'; // Adjust the range as needed

    gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range,
    }).then(function(response) {
        const range = response.result;
        const searchResultsDiv = document.getElementById('searchResults');
        searchResultsDiv.innerHTML = ''; // Clear previous results

        if (range.values.length > 0) {
            let results = [];
            // Loop through each column
            for (let col = 0; col < range.values[0].length; col++) {
                let columnValues = range.values.map(row => row[col]);
                // Check if the 4th row value matches the search term
                if (columnValues[3] && columnValues[3].toLowerCase().includes(searchTerm)) {
                    results.push({
                        columnIndex: col + 1,
                        rowValue: columnValues[3]
                    });
                }
            }

            if (results.length > 0) {
                let html = '<h2>Search Results</h2><ul>';
                results.forEach(result => {
                    html += `<li>Column ${result.columnIndex}: ${result.rowValue}</li>`;
                });
                html += '</ul>';
                searchResultsDiv.innerHTML = html;
            } else {
                searchResultsDiv.innerHTML = 'No matches found.';
            }
        } else {
            searchResultsDiv.innerHTML = 'No data found.';
        }
    }, function(response) {
        document.getElementById('searchResults').innerHTML = 'Error: ' + response.result.error.message;
    });
}

// Load the API client and auth2 library when the page loads
window.onload = handleClientLoad;
