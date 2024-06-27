// Load the API client and auth2 library
function handleClientLoad() {
    console.log("Loading API client...");
    gapi.load('client:auth2', initClient);
}

// Initialize the API client library and set up sign-in state listeners.
function initClient() {
    console.log("Initializing API client...");
    gapi.client.init({
        apiKey: 'AIzaSyAACAPVwRkK2Ii1nc8oJ8q0ha1ZF3gHlQU',
        discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
    }).then(function () {
        console.log("API client initialized successfully.");
        // The client is ready to use the API
    }, function(error) {
        console.error("Error initializing API client: ", error);
    });
}

function removeSpaces() {
    let input = document.getElementById('searchInput');
    input.value = input.value.replace(/\s/g, '');
}

function searchGoogleSheet() {
    console.log("Searching Google Sheet...");
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sheetId = '1FcjzaPWepGLRwdwyyefvZs_HEXhC168MircYGqpV9eQ';
    const range = '顧問組別清單!A1:Z1000'; // Update to match your sheet name and range

    if (!gapi.client.sheets) {
        console.error("Google Sheets API client is not loaded.");
        return;
    }

    gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range,
        key: 'AIzaSyAACAPVwRkK2Ii1nc8oJ8q0ha1ZF3gHlQU'
    }).then(function(response) {
        console.log("Data retrieved from Google Sheets: ", response);
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
        console.error("Error retrieving data from Google Sheets: ", response);
        document.getElementById('searchResults').innerHTML = 'Error: ' + response.result.error.message;
    });
}

// Load the API client and auth2 library when the page loads
window.onload = handleClientLoad;
