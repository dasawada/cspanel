exports.handler = async (event) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return { 
      statusCode: 405, 
      headers,
      body: 'Method Not Allowed' 
    };
  }

  const { name } = event.queryStringParameters;
  if (!name) {
    return { 
      statusCode: 400, 
      headers: {
        ...headers,
        'Content-Type': 'text/plain'
      },
      body: 'Name parameter is required' 
    };
  }

  try {
    const ONE_CLUB_JWT = process.env.ONE_CLUB_JWT;
    
    // 檢查 JWT 是否存在
    if (!ONE_CLUB_JWT) {
      console.error('ONE_CLUB_JWT environment variable is not set');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'JWT Configuration Error',
          details: 'Missing ONE_CLUB_JWT environment variable'
        })
      };
    }


    // 使用正確的 API 端點搜尋顧客，使用 name 參數
    const apiUrl = `https://api.oneclass.co/staff/customers?skip=0&limit=50&name=${encodeURIComponent(name)}`;
    console.log('Requesting OneClub Customer Search API:', apiUrl);
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${ONE_CLUB_JWT}`,
        'Accept': 'application/json'
      }
    });

    // 詳細的錯誤處理
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OneClub API Error:', {
        status: response.status,
        statusText: response.statusText,
        response: errorText,
        headers: Object.fromEntries(response.headers)
      });

      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'OneClub API Error',
          status: response.status,
          message: response.statusText,
          details: errorText
        })
      };
    }

    const data = await response.json();
    // 修正資料格式化，確保使用正確的 oneClubId
    const formattedData = {
      status: "success",
      data: {
        customers: data.data?.map(customer => ({
          id: customer.oneclubId || '',  // 注意：API 回傳的欄位名稱是 oneclubId
          name: customer.name || ''
        })).filter(customer => customer.id) || [] // 過濾掉沒有 id 的資料
      }
    };

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formattedData)
    };
  } catch (error) {
    console.error('OneClub API Request Failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
