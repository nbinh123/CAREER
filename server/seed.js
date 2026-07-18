const fs = require('fs');
const mongoose = require('mongoose');
const csv = require('csv-parser');

// Import Models của bạn (Sửa lại đường dẫn cho đúng với project của bạn)
const Food = require('./src/models/FoodModel');
const Ingredient = require('./src/models/IngredientModel');
// Giả sử bạn có PreferentialModel, nếu không hãy tạo một Model tương ứng
const Preferential = require('./src/models/PreferentialModel');

// Chuỗi kết nối MongoDB của bạn
const MONGO_URI = 'mongodb://127.0.0.1:27017/your_database_name';
const CSV_FILE_PATH = './ok.xlsx - Sheet1.csv';

async function seedData() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Khởi tạo một Category/Preferential mặc định (vì bắt buộc trong FoodModel)
        let defaultCategory = await Preferential.findOne({ name: 'Default Category' });
        if (!defaultCategory) {
            defaultCategory = await Preferential.create({
                code: 'CD',
                name: 'Default Category',
                percentageDiscount: 0,
                fixedDiscount: 0
            });
            console.log('✅ Created Default Category');
        }

        const rows = [];

        // 2. Đọc file CSV
        await new Promise((resolve, reject) => {
            fs.createReadStream(CSV_FILE_PATH)
                .pipe(csv({ headers: false })) // headers: false vì file có nhiều cột trống
                .on('data', (data) => rows.push(data))
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`✅ Parsed ${rows.length} rows from CSV`);

        const foods = [];
        let currentFood = null;

        // Vị trí các cột dựa trên dữ liệu bạn cung cấp (bắt đầu từ 0)
        const COL_FOOD_NAME = 0;
        const COL_INGREDIENT_NAME = 4;
        const COL_QTY = 7;
        const COL_UNIT = 10;
        const COL_COST = 13;
        const COL_ORIGINAL_PRICE = 16;
        const COL_AI_WEIGHT = 34;

        // 3. Xử lý dữ liệu từng dòng
        for (let i = 1; i < rows.length; i++) { // Bỏ qua dòng header (i = 0)
            const row = rows[i];

            // Check nếu dòng hoàn toàn rỗng thì bỏ qua
            if (!row[COL_FOOD_NAME] && !row[COL_INGREDIENT_NAME]) continue;

            const foodName = row[COL_FOOD_NAME]?.trim();
            const ingredientName = row[COL_INGREDIENT_NAME]?.trim();

            if (foodName) {
                // Đây là dòng chứa thông tin Món ăn mới
                currentFood = {
                    foodName: foodName,
                    categoryId: defaultCategory._id,
                    costPrice: parseFloat(row[COL_COST]) || 0,
                    originalPrice: parseFloat(row[COL_ORIGINAL_PRICE]) || 0,
                    aiTrainingWeight: parseFloat(row[COL_AI_WEIGHT]) || 0,
                    ingredients: []
                };
                foods.push(currentFood);
            } else if (ingredientName && currentFood) {
                // Đây là dòng chứa thông tin Nguyên liệu của món ăn hiện tại
                const qty = parseFloat(row[COL_QTY]) || 0;
                const unit = row[COL_UNIT]?.trim() || '';
                const cost = parseFloat(row[COL_COST]) || 0;

                // --- Xử lý Ingredient vào DB (hoặc tìm nếu đã có) ---
                let ingredientDoc = await Ingredient.findOne({ ingredientName });
                if (!ingredientDoc) {
                    // Tạo mới nguyên liệu trong DB nếu chưa tồn tại
                    ingredientDoc = await Ingredient.create({
                        ingredientName: ingredientName,
                        quantity: 100, // Giá trị mặc định, bạn có thể chỉnh sửa
                        smallUnit: unit,
                        largeUnit: unit,
                        pricePerLargeUnit: cost, // Giả sử lấy giá vốn làm giá mặc định
                        expiryDays: 30 // Giả sử 30 ngày
                    });
                }

                // Push vào danh sách nguyên liệu của Món ăn hiện tại
                currentFood.ingredients.push({
                    ingredientId: ingredientDoc._id,
                    ingredientName: ingredientDoc.ingredientName,
                    quantity: qty,
                    unit: unit,
                    cost: cost
                });
            }
        }

        // 4. Insert toàn bộ món ăn vào DB
        // Xoá dữ liệu cũ nếu muốn (Tuỳ chọn)
        await Food.deleteMany({});
        console.log('✅ Cleared old Food data');

        if (foods.length > 0) {
            await Food.insertMany(foods);
            console.log(`✅ Successfully seeded ${foods.length} foods!`);
        } else {
            console.log('⚠️ No foods found to seed.');
        }

    } catch (error) {
        console.error('❌ Seeding error:', error);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed.');
    }
}

seedData();