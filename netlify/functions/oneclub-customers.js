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
    console.log('API Response:', JSON.stringify(data)); // 新增日誌以檢查回傳資料結構
    
    // 檢查並處理資料結構
    let customers = [];
    if (data && Array.isArray(data)) {
      // 如果直接是陣列
      customers = data;
    } else if (data && Array.isArray(data.data)) {
      // 如果是包在 data 屬性內的陣列
      customers = data.data;
    } else if (data && data.data && typeof data.data === 'object') {
      // 如果是單一物件
      customers = [data.data];
    } else {
      console.error('Unexpected data structure:', data);
      customers = [];
    }

    // 重新格式化資料
    const formattedData = {
      status: "success",
      data: {
        customers: customers.map(customer => ({
          id: customer.oneclubId || '',
          name: customer.name || ''
        })).filter(customer => customer.id)
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
