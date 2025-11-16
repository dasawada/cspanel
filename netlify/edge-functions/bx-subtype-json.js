export default async (request, context) => {
  const SPREADSHEET_ID = '1X6bGi2snEyRHOCPPrbU-uEw4X9YF5daURkESkGRGnMk';
  const GID_MAIN = '876429352';
  const GID_CATEGORIES = '233597564';
  const GID_ADMIN_TAGS = '1081096339';

  const fetchData = async (gid) => {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google Sheet fetch failed with status: ${response.status}`);
      }
      const text = await response.text();
      console.log(`Fetched text for gid ${gid} (first 500 chars):`, text.substring(0, 500));
      const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
      if (!match) {
        throw new Error(`JSONP match failed for gid ${gid}`);
      }
      const jsonString = match[1];
      const data = JSON.parse(jsonString);
      console.log(`Parsed data for gid ${gid}:`, { cols: data.table?.cols?.length, rows: data.table?.rows?.length });

      if (!data.table || !data.table.cols || !data.table.rows) {
        return [];
      }

      // 使用 API 回傳的 header labels
      const headers = data.table.cols.map(col => col.label);

      // 將 Google Sheet 的資料格式轉換為物件陣列
      return data.table.rows.map(row => {
        const rowData = {};
        row.c.forEach((cell, index) => {
          const header = headers[index];
          if (header) { // 只處理有標頭的欄位
            rowData[header] = cell ? cell.v : null;
          }
        });
        return rowData;
      });
    } catch (error) {
      console.error(`Error fetching or parsing GID ${gid}:`, error);
      return [];
    }
  };

  try {
    const [mainData, categoryStyles, adminTagsData] = await Promise.all([
      fetchData(GID_MAIN),
      fetchData(GID_CATEGORIES),
      fetchData(GID_ADMIN_TAGS)
    ]);

    console.log('mainData length:', mainData.length);
    console.log('categoryStyles length:', categoryStyles.length);
    console.log('adminTagsData length:', adminTagsData.length);

    const output = {
      categories: [],
    };

    // 處理分類樣式
    const stylesMap = new Map();
    for (const style of categoryStyles) {
      if (style['問題類別']) {
        stylesMap.set(style['問題類別'], {
          background: style['CategoryBg'],
          color: style['CategoryColor']
        });
      }
    }

    // 處理 Admin Tags
    const adminTagsMap = new Map();
    for (const tag of adminTagsData) {
        // SubTypeValue 欄位是唯一的 key
        const key = tag['SubTypeValue'];
        if (key) { // 即使 SubTypeAdminTag 是空的也要存，以表示有這個 key
            adminTagsMap.set(key, tag['SubTypeAdminTag'] || "");
        }
    }

    // 處理主要資料
    const categories = {};
    for (const row of mainData) {
      const categoryLabel = row['問題類別'];
      if (!categoryLabel) continue;

      if (!categories[categoryLabel]) {
        categories[categoryLabel] = {
          enabled: true,
          requireSelection: true,
          parentTagPattern: "", // 稍後生成
          adminTagPattern: "", // 稍後生成
          subTypes: [
            { value: "", label: "請選擇子分類", desc: "", parentTag: "", adminTag: "" },
            { value: "_empty", label: "", desc: "", parentTag: "", adminTag: "" }
          ]
        };
      }

      const subCategory = row['子類別'];
      const detailItem = row['細項'];
      
      // '細項' 優先作為 value，若無則用 '子類別'
      const value = detailItem || subCategory;
      if (!value) continue;

      // 避免重複添加
      if (categories[categoryLabel].subTypes.some(st => st.value === value)) {
          continue;
      }

      const parentTag = `[${value}] `;
      // 直接使用 value (細項或子類別) 去 adminTagsMap 查找
      const adminTag = adminTagsMap.get(value) || "";
      const desc = row['處理方式'] || "";

      categories[categoryLabel].subTypes.push({
        value: value,
        label: value,
        desc: desc,
        parentTag: parentTag,
        adminTag: adminTag
      });
    }

    console.log('Categories keys:', Object.keys(categories));

    // 生成最終 JSON
    for (const label in categories) {
      // 1. 添加 category 列表
      output.categories.push({
        label: label,
        style: stylesMap.get(label) || { background: "#f7f7fb", color: "#3a3366" }
      });

      // 2. 處理每個 category 的詳細設定
      const categoryData = categories[label];
      const validSubTypes = categoryData.subTypes.filter(st => st.value && st.value !== '_empty');
      
      // 生成 parentTagPattern
      const parentTags = validSubTypes.map(st => st.parentTag.trim().replace(/[\[\]]/g, '\\$&'));
      if (parentTags.length > 0) {
        categoryData.parentTagPattern = `^(${parentTags.join('|')})\\s*`;
      }

      // 生成 adminTagPattern
      const adminTags = validSubTypes.map(st => st.adminTag).filter(Boolean);
      if (adminTags.length > 0) {
          const uniqueAdminTags = [...new Set(adminTags)];
          categoryData.adminTagPattern = uniqueAdminTags.map(tag => `^${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).join('|');
      }

      output[label] = categoryData;
    }

    return new Response(JSON.stringify(output, null, 2), {
      headers: { 
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*" // 允許跨域請求
      },
    });

  } catch (error) {
    console.error('Main error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};