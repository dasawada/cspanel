export default async (request, context) => {
  const SPREADSHEET_ID = '1X6bGi2snEyRHOCPPrbU-uEw4X9YF5daURkESkGRGnMk';
  const GID_MAIN = '876429352';
  const GID_CATEGORIES = '233597564';
  const GID_ADMIN_TAGS = '1081096339';

  // 簡化的 fetchData 函數，增加錯誤處理
  const fetchData = async (gid, sheetName) => {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
    
    try {
      const response = await fetch(url);
      const text = await response.text();
      
      // 檢查是否是 HTML 錯誤頁面
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        throw new Error(`Sheet ${sheetName} (gid:${gid}) returned HTML instead of JSON. Sheet might be private or GID incorrect.`);
      }
      
      // 提取 JSONP 包裹的 JSON
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
      if (!match) {
        throw new Error(`Failed to parse JSONP from sheet ${sheetName} (gid:${gid})`);
      }
      
      const data = JSON.parse(match[1]);
      
      if (!data.table || !data.table.rows) {
        return [];
      }
      
      // 提取表頭
      const headers = data.table.cols.map(col => col.label || '');
      
      // 轉換為物件陣列
      const rows = data.table.rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          if (header) {
            obj[header] = row.c[index]?.v ?? null;
          }
        });
        return obj;
      });
      
      return rows;
      
    } catch (error) {
      console.error(`Error fetching ${sheetName}:`, error.message);
      throw new Error(`Failed to fetch ${sheetName}: ${error.message}`);
    }
  };

  try {
    // 並行獲取所有工作表資料
    const [mainData, categoryStyles, adminTagsData] = await Promise.all([
      fetchData(GID_MAIN, '分類項目'),
      fetchData(GID_CATEGORIES, 'SubTypeJsonColor'),
      fetchData(GID_ADMIN_TAGS, 'SubTypeJson')
    ]);

    // 建立樣式映射表
    const stylesMap = new Map();
    categoryStyles.forEach(row => {
      if (row['問題類別']) {
        stylesMap.set(row['問題類別'], {
          background: row['CategoryBg'] || '#f7f7fb',
          color: row['CategoryColor'] || '#3a3366'
        });
      }
    });

    // 建立 AdminTag 映射表
    const adminTagsMap = new Map();
    adminTagsData.forEach(row => {
      const key = row['SubTypeValue'];
      if (key) {
        adminTagsMap.set(key, row['SubTypeAdminTag'] || '');
      }
    });

    // 處理主要資料，建立分類結構
    const categoriesData = {};
    
    mainData.forEach(row => {
      const categoryLabel = row['問題類別'];
      if (!categoryLabel) return;

      // 初始化分類
      if (!categoriesData[categoryLabel]) {
        categoriesData[categoryLabel] = {
          enabled: true,
          requireSelection: true,
          parentTagPattern: '',
          adminTagPattern: '',
          subTypes: [
            { value: '', label: '請選擇子分類', desc: '', parentTag: '', adminTag: '' },
            { value: '_empty', label: '', desc: '', parentTag: '', adminTag: '' }
          ]
        };
      }

      // 優先使用細項，否則使用子類別
      const value = row['細項'] || row['子類別'];
      if (!value) return;

      // 避免重複
      const exists = categoriesData[categoryLabel].subTypes.some(st => st.value === value);
      if (exists) return;

      // 添加子類型
      categoriesData[categoryLabel].subTypes.push({
        value: value,
        label: value,
        desc: row['處理方式'] || '',
        parentTag: `[${value}] `,
        adminTag: adminTagsMap.get(value) || ''
      });
    });

    // 生成最終輸出結構
    const output = {
      categories: []
    };

    // 按照原本 categories 的順序添加
    Object.keys(categoriesData).forEach(categoryLabel => {
      // 添加到 categories 列表
      output.categories.push({
        label: categoryLabel,
        style: stylesMap.get(categoryLabel) || { background: '#f7f7fb', color: '#3a3366' }
      });

      // 處理該分類的詳細設定
      const categoryData = categoriesData[categoryLabel];
      const validSubTypes = categoryData.subTypes.filter(st => st.value && st.value !== '_empty');

      // 生成 parentTagPattern
      if (validSubTypes.length > 0) {
        const parentTags = validSubTypes.map(st => {
          const escaped = st.parentTag.trim().replace(/[[\]]/g, '\\$&');
          return escaped;
        });
        categoryData.parentTagPattern = `^(${parentTags.join('|')})\\s*`;
      }

      // 生成 adminTagPattern
      const adminTags = [...new Set(validSubTypes.map(st => st.adminTag).filter(Boolean))];
      if (adminTags.length > 0) {
        categoryData.adminTagPattern = adminTags
          .map(tag => `^${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
          .join('|');
      }

      // 添加到輸出
      output[categoryLabel] = categoryData;
    });

    // 返回 JSON 響應
    return new Response(JSON.stringify(output, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300' // 快取 5 分鐘
      }
    });

  } catch (error) {
    console.error('Edge Function Error:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString(),
      spreadsheetId: SPREADSHEET_ID,
      gids: { main: GID_MAIN, categories: GID_CATEGORIES, adminTags: GID_ADMIN_TAGS }
    }, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};