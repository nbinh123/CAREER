import axios from "axios";

async function exportUsers(http, name) {
    try {
        // Gọi API lấy dữ liệu
        const res = await axios.get(
            http
        );

        const users = res.data;

        // Chuyển thành JSON
        const json = JSON.stringify(users, null, 2);

        // Tạo file
        const blob = new Blob([json], {
            type: "application/json",
        });

        // Tạo link tải
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}.json`;
        a.click();

        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Export failed:", error);
    }
}

export default exportUsers;