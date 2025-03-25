exports.handler = async (event) => {
  // 處理非 GET 方法
  if (event.httpMethod !== 'GET') {
    return { 
      statusCode: 405, 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain'
      },
      body: 'Method Not Allowed' 
    };
  }

  const { oneClubId } = event.queryStringParameters;
  if (!oneClubId) {
    return { 
      statusCode: 400, 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'OneClub ID is required' }) 
    };
  }

  try {
    const ONE_CLUB_JWT = process.env.ONE_CLUB_JWT;
    
    // 檢查 JWT 是否存在
    if (!ONE_CLUB_JWT) {
      console.error('ONE_CLUB_JWT environment variable is not set');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'JWT Configuration Error',
          details: 'Missing ONE_CLUB_JWT environment variable'
        })
      };
    }

    // 使用正確的 API 端點獲取輔導資訊
    const apiUrl = `https://api.oneclass.co/staff/customers/${oneClubId}`;
    console.log('Requesting OneClub Customer Detail API:', apiUrl);

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
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'OneClub API Error',
          status: response.status,
          message: response.statusText,
          details: errorText
        })
      };
    }

    const data = await response.json();
    // 確保回傳正確的輔導資訊
    const formattedData = {
      status: "success",
      data: {
        tutor: {
          name: data.tutor?.name || data.data?.tutor?.name || '',
          id: data.tutor?.id || data.data?.tutor?.id || ''
        }
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formattedData)
    };
  } catch (error) {
    console.error('OneClub API Request Failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};