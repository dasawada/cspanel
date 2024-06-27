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
    const range = '顧問組別清單!A1:O30'; // Update the range to search up to 30 rows and columns A to O

    if (!gapi.client.sheets) {
        console.error("Google Sheets API client is not loaded.");
        return;
    }

    gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range
    }).then(function(response) {
        console.log("Data retrieved from Google Sheets: ", response);
        const data = response.result.values;
        const searchResultsDiv = document.getElementById('searchResults');
        searchResultsDiv.innerHTML = ''; // Clear previous results

        if (data && data.length > 0) {
            let results = [];
            // Loop through each column
            for (let col = 0; col < data[0].length; col++) {
                // Check each row in the column for the search term
                for (let row = 0; row < data.length; row++) {
                    if (data[row][col] && data[row][col].toLowerCase().includes(searchTerm)) {
                        let referenceValue = data[3][col]; // Value in the 4th row
                        console.log(`Found match at row ${row + 1}, col ${col + 1}: ${data[row][col]} with reference value ${referenceValue}`);
                        results.push({
                            columnIndex: col + 1,
                            rowIndex: row + 1,
                            cellValue: data[row][col],
                            referenceValue: referenceValue
                        });
                    }
                }
            }

            if (results.length > 0) {
                let html = '<h2>Search Results</h2><ul>';
                results.forEach(result => {
                    html += `<li>Search term found in Column ${result.columnIndex}, Row ${result.rowIndex}: ${result.cellValue}<br>Corresponding value in Row 4: ${result.referenceValue}</li>`;
                });
                html += '</ul>';
                searchResultsDiv.innerHTML = html;
            } else {
                searchResultsDiv.innerHTML = 'No matches found.';
            }
        } else {
            searchResultsDiv.innerHTML = 'No data found.';
        }
    }).catch(function(error) {
        console.error("Error retrieving data from Google Sheets: ", error);
        document.getElementById('searchResults').innerHTML = 'Error: ' + error.message;
    });
}

// Load the API client and auth2 library when the page loads
window.onload = handleClientLoad;
