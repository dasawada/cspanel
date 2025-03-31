import { ConflictChecker } from './ConflictChecker.js';

async function initializeConflictChecker() {
    const checker = new ConflictChecker();
    await checker.start();
}

document.addEventListener('DOMContentLoaded', initializeConflictChecker);