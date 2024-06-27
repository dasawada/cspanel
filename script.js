// Load the API client and auth2 library
function handleClientLoad() {
    console.log("Loading API client...");
    gapi.load('client:auth2', initClient);
}

// Initialize the API client library and set up sign-in state listeners
function initClient() {
    console.log("Initializing API client...");
    gapi.client.init({
        apiKey: 'AIzaSyAACAPVwRkK2Ii1nc8oJ8q0ha1ZF3gHlQU',
        discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
    }).then(function() {
        console.log("API client initialized successfully.");
    }, function(error) {
        console.error("Error initializing API client: ", error);
    });
}

// Load data from the Google Sheets
function loadSheetData() {
    const sheetId = '1FcjzaPWepGLRwdwyyefvZs_HEXhC168MircYGqpV9eQ';
    const range = '顧問組別清單!A1:O30';

    gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range
    }).then(function(response) {
        console.log("Data retrieved from Google Sheets: ", response);
        displaySheetData(response.result.values);
    }).catch(function(error) {
        console.error("Error retrieving data from Google Sheets: ", error);
        document.getElementById('sheetData').innerHTML = 'Error: ' + error.message;
    });
}

// Display the data on the HTML page
function displaySheetData(data) {
    const sheetDataDiv = document.getElementById('sheetData');
    sheetDataDiv.innerHTML = ''; // Clear previous data

    if (data && data.length > 0) {
        let html = '<table border="1">';
        data.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                html += `<td>${cell}</td>`;
            });
            html += '</tr>';
        });
        html += '</table>';
        sheetDataDiv.innerHTML = html;
    } else {
        sheetDataDiv.innerHTML = 'No data found.';
    }
}

// Load the API client and auth2 library when the page loads
window.onload = handleClientLoad;
