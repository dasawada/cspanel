const fetch = require('node-fetch');
const admin = require('firebase-admin');

// Firebase Admin 初始化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

exports.handler = async (event) => {
  // CORS handling
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Allow': 'POST, OPTIONS',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // Firebase 驗證
  let token;
  try {
    const body = JSON.parse(event.body || '{}');
    token = body.token;
    if (!token) throw new Error('Missing token');
    await admin.auth().verifyIdToken(token);
  } catch (err) {
    return {
      statusCode: 401,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Authentication required' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, courseStatus, startAt, endAt, classId } = body;

    // JWT token from environment variable
    const jwt = process.env.ONE_CLUB_JWT;
    if (!jwt) {
      return { 
        statusCode: 500, 
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing JWT token in environment' }) 
      };
    }

    // Handle fetchCourses action
    if (action === 'fetchCourses') {
      if (!courseStatus || !startAt || !endAt) {
        return { 
          statusCode: 400, 
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: 'Missing required parameters for fetchCourses' }) 
        };
      }

      console.log(`Fetching ${courseStatus} courses from ${startAt} to ${endAt}`);

      try {
        const url = `https://api-new.oneclass.co/mms/course/findAllUseAggregate?courseStatus=${courseStatus}&startAt=${startAt}&endAt=${endAt}&isBelong=false&isAudition=false&isUseZoom=true&skip=0&orderBy=desc&limit=100`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': jwt,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.error(`API request failed with status: ${response.status}`);
          return { 
            statusCode: response.status, 
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: `API request failed with status: ${response.status}` }) 
          };
        }

        const data = await response.json();
        console.log(`Successfully fetched ${data?.data?.courses?.length || 0} courses`);

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        };
      } catch (error) {
        console.error('Error fetching courses:', error);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: error.message })
        };
      }
    }

    // Handle the original classId functionality
    if (classId) {
      // Here you would implement the logic to handle the Zoom class request
      // For example, making an API call to fetch Zoom class details

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Zoom class data fetched successfully' }) // Placeholder response
      };
    }

    // If neither action nor classId is provided
    return { 
      statusCode: 400, 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Missing required parameters (action or classId)' }) 
    };
  } catch (err) {
    console.error('Function error:', err);
    return { 
      statusCode: 500, 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: err.message }) 
    };
  }
};