// jobs/snapshotCron.js
//
// Cron job tự động build DailySnapshot vào cuối mỗi ngày.
// Sử dụng node-cron (npm install node-cron).
//
// Đăng ký trong app.js:
//   require('./jobs/snapshotCron');

const cron = require('node-cron');
const { buildDailySnapshot, buildSnapshotsForRange } = require('../controllers/service/analystService');

// =====================================================
// CRON: Mỗi ngày lúc 00:05 (sau nửa đêm 5 phút)
// Build snapshot cho ngày HÔM QUA (đã kết thúc)
// =====================================================

cron.schedule('5 0 * * *', async () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    console.log(`[SnapshotCron] Building snapshot for ${yesterday.toISOString().slice(0, 10)}`);
    try {
        const snap = await buildDailySnapshot(yesterday);
        console.log(`[SnapshotCron] Done: revenue=${snap.revenue}, bills=${snap.billCount}`);
    } catch (err) {
        console.error('[SnapshotCron] ERROR:', err.message);
    }
}, {
    timezone: 'Asia/Ho_Chi_Minh'
});

// =====================================================
// CRON: Mỗi giờ — Cập nhật snapshot NGÀY HÔM NAY (intraday)
// isFinalized = false → có thể cập nhật nhiều lần
// =====================================================

cron.schedule('0 * * * *', async () => {
    const today = new Date();
    console.log(`[SnapshotCron] Intraday update for ${today.toISOString().slice(0, 10)}`);
    try {
        await buildDailySnapshot(today);
    } catch (err) {
        console.error('[SnapshotCron] Intraday ERROR:', err.message);
    }
}, {
    timezone: 'Asia/Ho_Chi_Minh'
});

console.log('[SnapshotCron] Registered: daily at 00:05 + intraday every hour');