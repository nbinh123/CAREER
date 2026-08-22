// src/utils/importJSON.js
// Bản gốc dùng <input type="file"> (DOM-only) để lấy file JSON từ máy.
// Trên RN thay bằng expo-document-picker để mở picker hệ điều hành, sau đó
// đọc nội dung bằng expo-file-system rồi POST lên API y hệt logic cũ.
import axios from "axios";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

/**
 * Mở picker chọn file .json, đọc nội dung và trả về mảng dữ liệu.
 * Dùng khi cần người dùng chọn file trước khi gọi importJSON(apiUrl, data).
 */
export async function pickJSONFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset) return null;

  const text = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error("File JSON phải là một mảng dữ liệu");
  }
  return data;
}

async function importJSON(apiUrl, data, key = "data") {
  if (!Array.isArray(data)) {
    throw new Error("File JSON phải là một mảng dữ liệu");
  }

  const res = await axios.post(`${apiUrl}/import`, { [key]: data });
  return res.data;
}

export default importJSON;
