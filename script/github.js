export async function querySearchAPI(baseURL, value) {
    if (!value || typeof value !== 'string') {
      throw new Error('value 必須是字串');
    }

    const url = `${baseURL.replace(/\/$/, '')}/${encodeURIComponent(value)}`;
  
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit', // 明確指定不發送憑證
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json' // 添加內容類型
      }
    });
  
    if (!res.ok) {
      // 提供更詳細的錯誤信息
      const errorText = await res.text().catch(() => '未知錯誤');
      throw new Error(`API 請求失敗 ${res.status}: ${errorText}`);
    }
    return await res.json();
}