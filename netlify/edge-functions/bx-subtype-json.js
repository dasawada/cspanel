export default async (request, context) => {
  const SPREADSHEET_ID = '1X6bGi2snEyRHOCPPrbU-uEw4X9YF5daURkESkGRGnMk';
  const GID_MAIN = '876429352';
  const GID_CATEGORIES = '233597564';
  const GID_ADMIN_TAGS = '1081096339';

  const fetchData = async (gid, sheetName) => {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
    
    try {
      const response = await fetch(url);
      const text = await response.text();
      
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        throw new Error(`Sheet ${sheetName} returned HTML. Check if sheet is public.`);
      }
      
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
      if (!match) {
        throw new Error(`Failed to parse JSONP from ${sheetName}`);
      }
      
      const data = JSON.parse(match[1]);
      
      if (!data.table || !data.table.rows || data.table.rows.length === 0) {
        console.log(`[${sheetName}] No data rows found`);
        return [];
      }
      
      // Google Sheets API 使用 A, B, C 作為欄位 ID
      // 第一行是實際的表頭
      const firstRow = data.table.rows[0];
      const headers = firstRow.c.map(cell => cell?.v || '');
      
      console.log(`[${sheetName}] Actual headers from first row:`, JSON.stringify(headers));
      
      // 從第二行開始處理實際資料
      const rows = [];
      for (let i = 1; i < data.table.rows.length; i++) {
        const row = data.table.rows[i];
        const obj = {};
        let hasData = false;
        
        headers.forEach((header, index) => {
          if (header) {
            const cellValue = row.c[index]?.v ?? null;
            obj[header] = cellValue;
            if (cellValue !== null && cellValue !== '') {
              hasData = true;
            }
          }
        });
        
        if (hasData) {
          rows.push(obj);
        }
      }
      
      console.log(`[${sheetName}] Processed ${rows.length} data rows`);
      if (rows.length > 0) {
        console.log(`[${sheetName}] First data row:`, JSON.stringify(rows[0]));
      }
      
      return rows;
      
    } catch (error) {
      console.error(`Error in ${sheetName}:`, error.message);
      throw error;
    }
  };

  try {
    const [mainData, categoryStyles, adminTagsData] = await Promise.all([
      fetchData(GID_MAIN, '分類項目'),
      fetchData(GID_CATEGORIES, 'SubTypeJsonColor'),
      fetchData(GID_ADMIN_TAGS, 'SubTypeJson')
    ]);

    console.log('=== Data Summary ===');
    console.log('mainData rows:', mainData.length);
    console.log('categoryStyles rows:', categoryStyles.length);
    console.log('adminTagsData rows:', adminTagsData.length);

    if (mainData.length === 0) {
      throw new Error('No data in main sheet');
    }

    // 建立樣式映射表
    const stylesMap = new Map();
    categoryStyles.forEach(row => {
      const category = row['問題類別'];
      if (category) {
        stylesMap.set(category, {
          background: row['CategoryBg'] || '#f7f7fb',
          color: row['CategoryColor'] || '#3a3366'
        });
      }
    });
    console.log('stylesMap entries:', Array.from(stylesMap.keys()));

    // 建立 AdminTag 映射表
    const adminTagsMap = new Map();
    adminTagsData.forEach(row => {
      const key = row['SubTypeValue'];
      if (key) {
        adminTagsMap.set(key, row['SubTypeAdminTag'] || '');
      }
    });
    console.log('adminTagsMap size:', adminTagsMap.size);

    // 處理主要資料
    const categoriesData = {};
    
    mainData.forEach((row, index) => {
      const categoryLabel = row['問題類別'];
      
      if (index === 0) {
        console.log('First data row:', JSON.stringify(row));
      }
      
      if (!categoryLabel) {
        return;
      }

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

      const value = row['細項'] || row['子類別'];
      if (!value) {
        return;
      }

      const exists = categoriesData[categoryLabel].subTypes.some(st => st.value === value);
      if (exists) {
        return;
      }

      categoriesData[categoryLabel].subTypes.push({
        value: value,
        label: value,
        desc: row['處理方式'] || '',
        parentTag: `[${value}] `,
        adminTag: adminTagsMap.get(value) || ''
      });
    });

    console.log('Total categories:', Object.keys(categoriesData).length);
    console.log('Category names:', Object.keys(categoriesData));

    // 生成最終輸出
    const output = {
      categories: []
    };

    Object.keys(categoriesData).forEach(categoryLabel => {
      output.categories.push({
        label: categoryLabel,
        style: stylesMap.get(categoryLabel) || { background: '#f7f7fb', color: '#3a3366' }
      });

      const categoryData = categoriesData[categoryLabel];
      const validSubTypes = categoryData.subTypes.filter(st => st.value && st.value !== '_empty');

      if (validSubTypes.length > 0) {
        const parentTags = validSubTypes.map(st => st.parentTag.trim().replace(/[[\]]/g, '\\$&'));
        categoryData.parentTagPattern = `^(${parentTags.join('|')})\\s*`;
      }

      const adminTags = [...new Set(validSubTypes.map(st => st.adminTag).filter(Boolean))];
      if (adminTags.length > 0) {
        categoryData.adminTagPattern = adminTags
          .map(tag => `^${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
          .join('|');
      }

      output[categoryLabel] = categoryData;
    });

    return new Response(JSON.stringify(output, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300'
      }
    });

  } catch (error) {
    console.error('Main Error:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};