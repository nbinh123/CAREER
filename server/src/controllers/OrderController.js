const Order = require("../models/OrderModel");
const Food = require("../models/FoodModel");
const { buildSnapshotForDate } = require("./service/snapshotService");
// ❗ MỚI — voucher, đổi path nếu voucherService.js của bạn không nằm ở đây
const {
    VoucherError,
    redeemVoucher,
    rollbackVoucherClaim,
    recordVoucherRedemption,
    releaseVoucherForOrder
} = require("./service/voucherService");

class OrderController {

    async getOrders(req, res) {
        try {
            const orders = await Order.find().sort({ createdAt: -1 });
            res.json(orders);
        } catch (error) {
            console.error("Error fetching orders:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async createOrder(req, res) {
        // ❗ MỚI — set khi voucher được claim thành công, dùng để rollback ở
        // catch bên dưới nếu bước tạo đơn thất bại SAU đó.
        let claimedVoucherId = null;

        try {

            const {
                items,
                discountAmount = 0,
                voucherCode = null, // ❗ MỚI — optional, nếu có sẽ override discountAmount phía trên
                paymentMethod,
                isPaid = false,
                note = "",
                createdBy
            } = req.body;

            // =====================================================
            // 1. VALIDATE ITEMS
            // =====================================================

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    message: "Order must contain at least 1 item"
                });
            }

            // =====================================================
            // 2. VALIDATE PAYMENT METHOD
            // =====================================================

            const VALID_PAYMENT = ["CASH", "BANKING", "MOMO", "ZALOPAY"];

            if (!paymentMethod || !VALID_PAYMENT.includes(paymentMethod)) {
                return res.status(400).json({
                    message: `paymentMethod must be one of: ${VALID_PAYMENT.join(", ")}`
                });
            }

            // =====================================================
            // 3. LẤY DANH SÁCH FOOD TỪ DB
            // =====================================================

            const foodIds = items.map(i => i.foodId);
            const foods = await Food.find({ _id: { $in: foodIds } }).lean();
            const foodMap = {};
            foods.forEach(food => { foodMap[food._id.toString()] = food; });

            // =====================================================
            // 4. BUILD ORDER ITEMS
            // =====================================================

            let subtotal = 0;
            let totalCost = 0;
            const voucherEligibilityItems = []; // ❗ MỚI — chỉ dùng để tính discount, KHÔNG lưu DB

            const orderItems = items.map((item, idx) => {

                const { foodId, quantity, note } = item;

                if (!quantity || quantity < 1) {
                    throw new Error(`Item[${idx}]: quantity must be >= 1`);
                }

                const food = foodMap[foodId];
                if (!food) {
                    throw new Error(`Item[${idx}]: Food not found`);
                }

                const unitPrice = food.originalPrice;
                const unitCost = food.costPrice;
                const lineTotal = unitPrice * quantity;
                const lineCost = unitCost * quantity;

                subtotal += lineTotal;
                totalCost += lineCost;

                voucherEligibilityItems.push({ // ❗ MỚI
                    foodId: food._id,
                    categoryId: food.categoryId,
                    total: lineTotal,
                });

                return {
                    foodId: food._id,
                    foodName: food.foodName,
                    quantity,
                    note: note || "",
                    unitPrice,
                    total: lineTotal,
                    costPriceSnapshot: unitCost,
                    grossProfit: lineTotal - lineCost,
                    ingredientSnapshots: food.ingredients ?? []
                };
            });

            // =====================================================
            // 5. ÁP VOUCHER (nếu có) — ❗ MỚI
            // =====================================================

            let finalDiscount = Math.max(0, discountAmount);
            let voucherInfo = null;

            if (voucherCode) {
                const { voucher, discountAmount: voucherDiscount } = await redeemVoucher(voucherCode, {
                    channel: "DINE_IN",
                    items: voucherEligibilityItems,
                    subtotal,
                    customerKey: null, // đơn tại quầy không định danh khách theo voucher
                });
                claimedVoucherId = voucher._id;
                finalDiscount = voucherDiscount; // override — không cộng dồn với discountAmount thủ công
                voucherInfo = voucher;
            }

            // =====================================================
            // 6. TÍNH TOTAL
            // =====================================================

            const totalAmount = Math.max(0, subtotal - finalDiscount);

            // =====================================================
            // 7. CREATE ORDER
            // =====================================================

            const orderData = {
                items: orderItems,
                subtotal,
                discountAmount: finalDiscount,
                totalAmount,
                totalCost,
                paymentMethod,
                isPaid,
                note,
                status: isPaid ? "COMPLETED" : "PENDING",
                completedAt: isPaid ? new Date() : undefined
            };

            if (voucherInfo) { // ❗ MỚI
                orderData.voucherId = voucherInfo._id;
                orderData.voucherCode = voucherInfo.code;
            }

            if (createdBy) orderData.createdBy = createdBy;

            const newOrder = new Order(orderData);
            await newOrder.save();

            if (voucherInfo) { // ❗ MỚI — ghi log SAU KHI order đã lưu thành công
                await recordVoucherRedemption({
                    voucherId: voucherInfo._id,
                    code: voucherInfo.code,
                    orderId: newOrder._id,
                    discountApplied: finalDiscount,
                });
            }

            buildSnapshotForDate(new Date()).catch(e =>
                console.error("[OrderController] snapshot build failed:", e.message)
            );

            return res.status(201).json({
                message: "Order created successfully",
                order: newOrder
            });

        } catch (error) {

            console.error("Error creating order:", error);

            // ❗ MỚI — voucher đã bị claim nhưng đơn tạo thất bại (lỗi ở bước
            // save hoặc bất kỳ đâu sau redeemVoucher) → trả lại lượt dùng,
            // tránh voucher bị "ăn" oan 1 lượt không sinh ra đơn nào.
            if (claimedVoucherId) {
                await rollbackVoucherClaim(claimedVoucherId);
            }

            if (error instanceof VoucherError) { // ❗ MỚI
                return res.status(400).json({ message: error.message });
            }

            if (error.name === "ValidationError") {
                return res.status(400).json({ message: error.message });
            }

            return res.status(500).json({
                message: error.message || "Internal server error"
            });
        }
    }
    // thêm vào class OrderController, ngang hàng với createOrder

    async cancelOrder(req, res) {
        try {
            const { id } = req.params;
            const { reason = "" } = req.body;

            const order = await Order.findById(id);

            if (!order) {
                return res.status(404).json({
                    message: "Order not found"
                });
            }

            if (order.status === "CANCELLED") {
                return res.status(400).json({
                    message: "Order is already cancelled"
                });
            }

            if (order.status === "COMPLETED") {
                return res.status(400).json({
                    message: "Cannot cancel a completed order"
                });
            }

            if (order.voucherId) {
                await releaseVoucherForOrder({ orderId: order._id });
            }

            order.status = "CANCELLED";
            order.cancelledAt = new Date();
            order.cancelReason = reason || "";

            await order.save();

            // ❗ MỚI — chỉ bắn thông báo real-time, KHÔNG đụng gì tới Table
            // (items/status/pendingItems). Table và Order là 2 nguồn dữ liệu độc
            // lập trong hệ thống này — xem comment tableNumber trong OrderModel.
            // getIO() throw nếu socket.io chưa init (vd chạy qua script/test
            // ngoài server thật) — bọc try/catch riêng để lỗi này KHÔNG làm fail
            // cả API huỷ đơn, vì đơn đã huỷ thành công trong DB rồi.
            try {
                const io = getIO();
                const payload = {
                    orderId: order._id,
                    tableNumber: order.tableNumber,
                    reason: order.cancelReason,
                    cancelledAt: order.cancelledAt,
                };

                io.to("admin_room").emit("order_cancelled", payload);

                if (order.tableNumber != null) {
                    io.to(`table:${order.tableNumber}`).emit("order_cancelled", payload);
                }
            } catch (ioErr) {
                console.error("[OrderController] emit order_cancelled lỗi:", ioErr.message);
            }

            buildSnapshotForDate(new Date()).catch(e =>
                console.error("[OrderController] snapshot build failed:", e.message)
            );

            return res.status(200).json({
                message: "Order cancelled successfully",
                order
            });

        } catch (error) {

            console.error("Error cancelling order:", error);

            if (error.name === "CastError") {
                return res.status(400).json({
                    message: "Invalid order id"
                });
            }

            return res.status(500).json({
                message: error.message || "Internal server error"
            });
        }
    }
}

module.exports = new OrderController();