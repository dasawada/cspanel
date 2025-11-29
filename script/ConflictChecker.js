import { getAccountResultsFromSheet, allMeetingCompareCheckForConflicts } from './all-meeting-compare.js';

export class ConflictChecker {
    constructor() {
        this.interval = 900000; // 15 分鐘
        this.cacheKey = 'meetingConflictCache';
        this.checkTimer = null;
    }

    async start() {
        try {
            // 初始化檢查
            await this.checkWithCache();
            
            // 註冊頁面可見性事件
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    // 清除定時器
                    if (this.checkTimer) {
                        clearTimeout(this.checkTimer);
                        this.checkTimer = null;
                    }
                } else {
                    // 頁面可見時立即檢查並重新啟動定時器
                    this.checkWithCache();
                    this.scheduleNextCheck();
                }
            });

            // 開始定時檢查
            this.scheduleNextCheck();
        } catch (error) {
            console.error('Failed to start conflict checker:', error);
        }
    }

    async checkWithCache() {
        try {
            const cachedData = localStorage.getItem(this.cacheKey);
            const cache = cachedData ? JSON.parse(cachedData) : null;
            
            const newData = await getAccountResultsFromSheet();
            const hasChanges = !this.isEqual(cache, newData);
            
            if (hasChanges) {
                localStorage.setItem(this.cacheKey, JSON.stringify(newData));
                await this.updateUI(newData);
            }
            
            return hasChanges;
        } catch (error) {
            console.error('Conflict check failed:', error);
            return false;
        }
    }

    scheduleNextCheck() {
        if (document.hidden) {
            return; // 如果頁面不可見，不進行排程
        }

        this.checkTimer = setTimeout(() => {
            this.checkWithCache().finally(() => {
                this.scheduleNextCheck();
            });
        }, this.interval);
    }

    isEqual(obj1, obj2) {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    }

    async updateUI(data) {
        const hasConflicts = this.checkForConflicts(data);
        const settingsButton = document.getElementById('settings-button');
        if (settingsButton) {
            settingsButton.style.display = hasConflicts ? 'inline' : 'none';
        }
    }

    checkForConflicts(data) {
        for (const account in data) {
            const accountData = data[account];
            if (accountData.meetings) {
                const conflicts = allMeetingCompareCheckForConflicts(accountData.meetings);
                if (conflicts.length > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    stop() {
        if (this.checkTimer) {
            clearTimeout(this.checkTimer);
            this.checkTimer = null;
        }
        // 清除 visibilitychange 事件（需要保存 handler 參考）
        console.log('ConflictChecker: 已停止');
    }
}
