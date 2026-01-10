/**
 * Deal Composite Client - 前端適配器
 * 
 * 提供與舊版 API 相容的介面，同時支援新的整合 API
 * 
 * 使用方式:
 * import { DealClient } from './deal-composite-client.js';
 * 
 * const client = new DealClient();
 * const result = await client.fetchDealInfo('12345');
 */

const NETLIFY_SITE_URL = 'https://stirring-pothos-28253d.netlify.app';
const COMPOSITE_API = `${NETLIFY_SITE_URL}/api/deal-composite`;

/**
 * Deal Composite Client
 */
export class DealClient {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || COMPOSITE_API;
    this.token = options.token || null;
    this.includeRaw = options.includeRaw || false;
  }

  /**
   * 設定 Firebase Token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * 嘗試刷新 Token (需要 Firebase auth 在全域)
   */
  async refreshToken() {
    if (typeof window !== 'undefined' && window.auth?.currentUser) {
      try {
        const newToken = await window.auth.currentUser.getIdToken(true);
        this.token = newToken;
        window.userToken = newToken;
        return newToken;
      } catch (err) {
        console.warn('Token 刷新失敗:', err);
      }
    }
    return null;
  }

  /**
   * 取得完整交易資料
   * @param {string} dealId - 交易 ID
   * @param {number} retryCount - 重試次數 (用於 token 過期)
   * @returns {Promise<DealCompositeResponse>}
   */
  async fetchDealInfo(dealId, retryCount = 1) {
    const cleanDealId = String(dealId).trim().replace(/[^A-Za-z0-9]/g, '');
    
    if (!cleanDealId) {
      return {
        success: false,
        error: '請輸入有效的交易編號'
      };
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
        },
        body: JSON.stringify({
          dealId: cleanDealId,
          token: this.token,
          includeRaw: this.includeRaw
        })
      });

      // 處理 Token 過期
      if (response.status === 401 && retryCount > 0) {
        console.log('Token 可能過期，嘗試刷新...');
        const newToken = await this.refreshToken();
        if (newToken) {
          return this.fetchDealInfo(dealId, retryCount - 1);
        }
      }

      if (!response.ok) {
        throw new Error(`API 錯誤: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error.message || '連線失敗'
      };
    }
  }

  /**
   * 轉換為舊版 sheetData 格式 (向後相容)
   * @param {DealCompositeResponse} result - API 回應
   * @returns {Object} - 舊版 sheetData 格式
   */
  static toSheetData(result) {
    if (!result.success || !result.computed) {
      return {
        colA: '', colB: '', colC: '', colD: '',
        colE: '', colF: '', colG: '', colH: '',
        colI: '', colJ: '', colK: '', colL: '', colM: ''
      };
    }

    const c = result.computed;
    return {
      colA: c.payDate || '',
      colB: c.dealId || '',
      colC: c.contactUrl || '',
      colD: c.status || '',
      colE: c.advisor || '',
      colF: c.students || '',
      colG: c.contractor || '',
      colH: c.subject || '',
      colI: c.plan || '',
      colJ: c.colJ || '',
      colK: c.tutor || '',
      colL: c.group || '',
      colM: c.amount || ''
    };
  }

  /**
   * 轉換為舊版 oneClubCustomers 格式 (向後相容)
   * @param {DealCompositeResponse} result - API 回應
   * @returns {Array} - 舊版 customers 格式
   */
  static toCustomers(result) {
    if (!result.success || !result.raw?.customers) {
      // 若無 raw 資料，從 computed 重建
      if (result.computed?.oneClubId) {
        return [{
          oneClubId: result.computed.oneClubId,
          name: result.computed.contractor || ''
        }];
      }
      return [];
    }
    return result.raw.customers;
  }

  /**
   * 轉換為舊版 studentData 格式 (向後相容)
   * @param {DealCompositeResponse} result - API 回應
   * @returns {Array} - 舊版 studentData 格式
   */
  static toStudentData(result) {
    if (!result.success || !result.derived?.students) {
      return [];
    }
    return result.derived.students.map(s => ({
      name: s.name,
      education: s.education,
      grade: s.grade
    }));
  }

  /**
   * 取得警告訊息
   * @param {DealCompositeResponse} result - API 回應
   * @returns {string[]} - 警告訊息陣列
   */
  static getWarnings(result) {
    return result.meta?.warnings || [];
  }

  /**
   * 取得備註
   * @param {DealCompositeResponse} result - API 回應
   * @returns {string}
   */
  static getNotes(result) {
    return result.derived?.notes || '無備註';
  }

  /**
   * 取得訂單連結
   * @param {DealCompositeResponse} result - API 回應
   * @returns {string[]}
   */
  static getOrderLinks(result) {
    return result.derived?.orderLinks || [];
  }
}

/**
 * 簡化版函式 (直接替換舊版呼叫)
 */
export async function fetchDealComposite(dealId, token = null) {
  const client = new DealClient({ token, includeRaw: true });
  return client.fetchDealInfo(dealId);
}

// 全域匯出 (非 ES Module 環境)
if (typeof window !== 'undefined') {
  window.DealClient = DealClient;
  window.fetchDealComposite = fetchDealComposite;
}
