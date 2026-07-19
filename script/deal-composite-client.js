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

import { CSPANEL_API } from './cspanel-api.js';
import { authFetch, readApiError } from './auth-fetch.js';

/**
 * Deal Composite Client
 */
export class DealClient {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || CSPANEL_API.dealComposite;
    this.includeRaw = options.includeRaw || false;
  }

  /**
   * 取得完整交易資料
   * @param {string} dealId - 交易 ID
   * @returns {Promise<DealCompositeResponse>}
   */
  async fetchDealInfo(dealId) {
    const cleanDealId = String(dealId).trim().replace(/[^A-Za-z0-9]/g, '');
    
    if (!cleanDealId) {
      return {
        success: false,
        error: '請輸入有效的交易編號'
      };
    }

    try {
      const response = await authFetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dealId: cleanDealId,
          includeRaw: this.includeRaw
        })
      });

      if (!response.ok) {
        const apiError = await readApiError(response);
        return {
          success: false,
          error: apiError.message,
          errorCode: apiError.code,
          requestId: apiError.requestId,
          status: apiError.status
        };
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error.message || '連線失敗',
        errorCode: error.code || ''
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
    const customers = result.raw?.customers || result.customers;
    if (!result.success || !customers) {
      // 若無 raw 資料，從 computed 重建
      if (result.computed?.oneClubId) {
        return [{
          oneClubId: result.computed.oneClubId,
          name: result.computed.contractor || ''
        }];
      }
      return [];
    }
    return customers;
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
export async function fetchDealComposite(dealId) {
  const client = new DealClient({ includeRaw: true });
  return client.fetchDealInfo(dealId);
}

// 全域匯出 (非 ES Module 環境)
if (typeof window !== 'undefined') {
  window.DealClient = DealClient;
  window.fetchDealComposite = fetchDealComposite;
}
