// src/utils/exportJSON.js
// Bản gốc dùng Blob + URL.createObjectURL + <a download> (DOM-only) để tải
// file JSON. Trên RN không có DOM, nên thay bằng expo-file-system (ghi file
// vào bộ nhớ tạm của app) + expo-sharing (mở share sheet cho người dùng lưu/
// gửi file) — đây là cặp API tương đương chuẩn trên Expo.
import axios from "axios";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

async function exportUsers(http, name) {
  try {
    const res = await axios.get(http);
    const users = res.data;
    const json = JSON.stringify(users, null, 2);

    const fileUri = `${FileSystem.cacheDirectory}${name}.json`;
    await FileSystem.writeAsStringAsync(fileUri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: `Xuất ${name}.json`,
      });
    }

    return fileUri;
  } catch (error) {
    console.error("Export failed:", error);
    throw error;
  }
}

export default exportUsers;
