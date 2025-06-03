exports.handler = async () => {
  // 直接回傳 Netlify 環境變數 ONE_CLUB_JWT 的內容
  return {
    statusCode: 200,
    body: JSON.stringify({
      token: process.env.ONE_CLUB_JWT || ""
    }),
    headers: {
      "Content-Type": "application/json"
    }
  };
};