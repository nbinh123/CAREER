// utils/dateRange.js

// Lấy tất cả ngày trong 1 tháng
export function getDaysInMonth(year, month, format = "d/m") {
    const totalDays = new Date(year, month, 0).getDate();

    return Array.from({ length: totalDays }, (_, i) => {
        const date = new Date(year, month - 1, i + 1);

        return formatDate(date, format);
    });
}

// Lấy danh sách ngày trong 1 tuần
export function getDaysInWeek(date = new Date(), format = "d/m") {
    const current = new Date(date);

    // Thứ 2 là đầu tuần
    const day = current.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    const monday = new Date(current);
    monday.setDate(current.getDate() + diff);

    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);

        return formatDate(d, format);
    });
}

// Lấy khoảng ngày bất kỳ
export function getDateRange(startDate, endDate, format = "d/m") {
    const dates = [];

    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        dates.push(formatDate(current, format));

        current.setDate(current.getDate() + 1);
    }

    return dates;
}
export function getLast7Days(format = "d/m") {
    const dates = [];

    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);

        const d = date.getDate();
        const m = date.getMonth() + 1;
        const y = date.getFullYear();

        switch (format) {
            case "dd/mm":
                dates.push(
                    `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`
                );
                break;

            case "yyyy-mm-dd":
                dates.push(
                    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                );
                break;

            default:
                dates.push(`${d}/${m}`);
        }
    }

    return dates;
}

// Format chung
function formatDate(date, format) {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();

    switch (format) {
        case "dd/mm":
            return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;

        case "yyyy-mm-dd":
            return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

        default:
            return `${d}/${m}`;
    }
}