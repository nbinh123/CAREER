const Preferential = require('../models/Preferential');

class PreferentialController {

    seed = async (req, res) => {
        const preferentialData = [
            {
                code: 'DC',
                categoryName: 'Đồ chiên',
                percentageDiscount: 0,
                fixedDiscount: 0
            },
            {
                code: 'LL',
                categoryName: 'Lẩu',
                percentageDiscount: 0,
                fixedDiscount: 0
            },
            {
                code: 'TBK',
                categoryName: 'Tokbokki',
                percentageDiscount: 0,
                fixedDiscount: 0
            },
            {
                code: 'DS',
                categoryName: 'Đồ sốt',
                percentageDiscount: 0,
                fixedDiscount: 0
            },
            {
                code: 'NT',
                categoryName: 'Ngâm trộn',
                percentageDiscount: 0,
                fixedDiscount: 0
            },
            {
                code: 'MC',
                categoryName: 'Mì cay',
                percentageDiscount: 0,
                fixedDiscount: 0
            },
            {
                code: 'CD',
                categoryName: 'Chủ đạo',
                percentageDiscount: 0,
                fixedDiscount: 0
            }
        ];
    }


}

module.exports = new PreferentialController();