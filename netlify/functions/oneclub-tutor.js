exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { oneClubId } = event.queryStringParameters;
  if (!oneClubId) {
    return { statusCode: 400, body: 'OneClub ID is required' };
  }

  try {
    const ONE_CLUB_JWT = process.env.ONE_CLUB_JWT;
    const response = await fetch(
      `https://api.oneclass.co/staff/customers/${oneClubId}`,
      {
        headers: {
          'Authorization': `Bearer ${ONE_CLUB_JWT}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`OneClub API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
