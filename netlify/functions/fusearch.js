const fetch = require('node-fetch');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  
  // Validate origin
  if (!allowedOrigins.includes(origin)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Origin not allowed' })
    };
  }

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(origin),
      body: ''
    };
  }

  try {
    const { searchTerm } = JSON.parse(event.body);
    const response = await fetch('YOUR_API_ENDPOINT');
    const data = await response.json();
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Search failed:", error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        error: error.message,
        details: error.code === 'ERR_REQUIRE_ESM' ? 'Node-fetch import error' : 'Request failed'
      })
    };
  }
};