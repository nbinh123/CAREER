const Order = require("../models/OrderModel");

class AdminController {

    //  [GET]   /orders
    //  TRẢ RA TẤT CẢ BILL 
    getAllOrder = (req, res) => {
    
    }

    //  [GET]   /statistical/today
    //  API SẼ TRẢ VỀ:
    //  1. TỔNG DOANH THU HÔM NAY
    //  2. SỐ LƯỢNG LƯỢT KHÁCH TỔNG CỘNG HÔM NAY
    //  3. SỐ TIỀN MÀ KHÁCH CHI MỖI LƯỢT KHÁCH: (LẤY TỔNG DOANH THU / SỐ LƯỢT KHÁCH)
    //  4. DANH SÁCH CÁC MÓN ĂN ĐƯỢC ORDER NHIỀU NHẤT HÔM NAY (TOP 5)
    getTodayResults = (req, res) => {
    }

    //  [GET]   
    //  /statistical/monthly
    //
    getMonthlyResults = (req, res) => {
    }

    //  [GET]   /orders/:id
    getOrderById = (req, res) => {
    
    }

    //  [GET]   /statistical
    //  THỐNG KÊ SỐ LƯỢNG KHÁCH THEO GIỜ
    getClientByHour = (req, res) => {

    }
}

module.exports = new AdminController();