const Order = require("../models/OrderModel");
const Food = require("../models/FoodModel");
const { buildSnapshotForDate } = require("./service/snapshotService");

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
        try {

            const {
                items,
                discountAmount = 0,
                paymentMethod,
                isPaid = false,
                note = "",
                createdBy
            } = req.body;

            // =====================================================
            // 1. VALIDATE ITEMS
            // =====================================================

            if (
                !items ||
                !Array.isArray(items) ||
                items.length === 0
            ) {
                return res.status(400).json({
                    message:
                        "Order must contain at least 1 item"
                });
            }

            // =====================================================
            // 2. VALIDATE PAYMENT METHOD
            // =====================================================

            const VALID_PAYMENT = [
                "CASH",
                "BANKING",
                "MOMO",
                "ZALOPAY"
            ];

            if (
                !paymentMethod ||
                !VALID_PAYMENT.includes(paymentMethod)
            ) {
                return res.status(400).json({
                    message:
                        `paymentMethod must be one of: ${VALID_PAYMENT.join(", ")}`
                });
            }

            // =====================================================
            // 3. LẤY DANH SÁCH FOOD TỪ DB
            // =====================================================

            const foodIds = items.map(i => i.foodId);

            const foods = await Food.find({
                _id: { $in: foodIds }
            }).lean();

            const foodMap = {};

            foods.forEach(food => {
                foodMap[food._id.toString()] = food;
            });

            // =====================================================
            // 4. BUILD ORDER ITEMS
            // =====================================================

            let subtotal = 0;
            let totalCost = 0;

            const orderItems = items.map((item, idx) => {

                const {
                    foodId,
                    quantity
                } = item;

                // -------------------------
                // Validate quantity
                // -------------------------

                if (!quantity || quantity < 1) {
                    throw new Error(
                        `Item[${idx}]: quantity must be >= 1`
                    );
                }

                // -------------------------
                // Find food
                // -------------------------

                const food =
                    foodMap[foodId];

                if (!food) {
                    throw new Error(
                        `Item[${idx}]: Food not found`
                    );
                }

                // -------------------------
                // Validate available
                // -------------------------

                if (!food.isAvailable) {
                    throw new Error(
                        `${food.foodName} is unavailable`
                    );
                }

                // -------------------------
                // Calculate
                // -------------------------

                const unitPrice =
                    food.originalPrice;

                const unitCost =
                    food.costPrice;

                const lineTotal =
                    unitPrice * quantity;

                const lineCost =
                    unitCost * quantity;

                subtotal += lineTotal;
                totalCost += lineCost;

                // -------------------------
                // Return item
                // -------------------------

                return {
                    foodId:              food._id,
                    foodName:            food.foodName,
                    quantity,

                    // Giá bán tại thời điểm đặt (required)
                    unitPrice,

                    // Tổng dòng (required)
                    total:               lineTotal,

                    // Giá vốn / đơn vị tại thời điểm đặt (required)
                    costPriceSnapshot:   unitCost,

                    // Lợi nhuận gộp dòng = doanh thu - chi phí
                    grossProfit:         lineTotal - lineCost,

                    // Snapshot nguyên liệu tại thời điểm đặt
                    ingredientSnapshots: food.ingredients ?? []
                };
            });

            // =====================================================
            // 5. TÍNH TOTAL
            // =====================================================

            const finalDiscount =
                Math.max(0, discountAmount);

            const totalAmount =
                Math.max(
                    0,
                    subtotal - finalDiscount
                );

            // =====================================================
            // 6. CREATE ORDER
            // =====================================================

            const orderData = {

                // Items
                items: orderItems,

                // Money
                subtotal,
                discountAmount: finalDiscount,
                totalAmount,
                totalCost,

                // Payment
                paymentMethod,
                isPaid,

                // Meta
                note,

                // Status
                status:
                    isPaid
                        ? "COMPLETED"
                        : "PENDING",

                completedAt:
                    isPaid
                        ? new Date()
                        : undefined
            };

            if (createdBy) {
                orderData.createdBy = createdBy;
            }

            const newOrder =
                new Order(orderData);

            await newOrder.save();

            // Cập nhật DailySnapshot hôm nay bất đồng bộ (không block response)
            buildSnapshotForDate(new Date()).catch(e =>
                console.error("[OrderController] snapshot build failed:", e.message)
            );

            // =====================================================
            // 7. RESPONSE
            // =====================================================

            return res.status(201).json({

                message:
                    "Order created successfully",

                order: newOrder
            });

        } catch (error) {

            console.error(
                "Error creating order:",
                error
            );

            // =====================================================
            // VALIDATION ERROR
            // =====================================================

            if (
                error.name === "ValidationError"
            ) {
                return res.status(400).json({
                    message: error.message
                });
            }

            // =====================================================
            // CUSTOM ERROR
            // =====================================================

            return res.status(500).json({
                message:
                    error.message ||
                    "Internal server error"
            });
        }
    }
}

module.exports = new OrderController();