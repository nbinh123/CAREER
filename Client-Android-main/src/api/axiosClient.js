import axios from "axios";
import { API_BASE_URL } from "../config/api";

// ⚠️ Interceptor đính kèm Authorization header + tự refresh khi 401 đã được
// mô tả ở mục 5.2 của kế hoạch và (theo giả định) đã dựng ở giai đoạn 4 cùng
// AuthContext. Nếu instance axios dùng chung đã được tạo ở đó, XOÁ file này
// và trỏ các file api/*.js trong bộ giai đoạn 5 sang import instance đã có,
// thay vì tạo thêm 1 instance riêng không có token.
const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export default axiosClient;
