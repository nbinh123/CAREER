// src/config/api.js
// [GIU-NGUYEN] Chuyển từ process.env.REACT_APP_API_URL (CRA) sang
// Expo. Expo chỉ đưa biến bắt đầu bằng EXPO_PUBLIC_ ra bundle client,
// nên dùng process.env.EXPO_PUBLIC_API_URL, fallback về Constants.expoConfig.extra
// (app.json > expo.extra.apiUrl) nếu biến môi trường không được set khi build.
import Constants from "expo-constants";

export const API_URL = "https://career-tf7j.onrender.com"
