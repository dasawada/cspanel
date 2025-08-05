export async function querySearchAPI(baseURL, value) {
    if (!value || typeof value !== 'string') {
      throw new Error('value 必須是字串');
    }

    const url = `${baseURL.replace(/\/$/, '')}/${encodeURIComponent(value)}`;
  
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
  
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  }