export class ConflictChecker {
    constructor() {
        this.minInterval = 60000; // 1 分鐘
        this.maxInterval = 300000; // 5 分鐘
        this.currentInterval = this.minInterval;
        this.lastChangeTime = Date.now();
        this.cacheKey = 'meetingConflictCache';
    }
    
    // ...existing code from all-meeting-compare.js ConflictChecker class...
}
