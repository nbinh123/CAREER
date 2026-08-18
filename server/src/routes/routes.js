// import các controller 
const userRoute = require("../routes/route/userRoute")
const foodRoute = require("../routes/route/foodRoute")
const orderRoute = require("../routes/route/orderRoute")
const analystRoute = require("../routes/route/analystRoute")
const ingredientRoute = require("../routes/route/ingredientRoute")
const ingredientTracsactionRoute = require("../routes/route/ingredientTransactionRoutes")
const tableRoute = require("../routes/route/tableRoute") 
const fruitRoute = require("../routes/route/fruitRoute") 
const fruitOrderRoute = require("../routes/route/fruitOrderRoute") 
const customerRoute = require("../routes/route/customerRoute") 
const voucherRoute = require("../routes/route/voucherRoute")

function router(app){ 
    app.use("/api/users",  userRoute)
    app.use("/api/foods",  foodRoute)
    app.use("/api/orders",  orderRoute)
    app.use("/api/analyst", analystRoute)
    app.use("/api/ingredients", ingredientRoute)
    app.use("/api/ingredient-transactions", ingredientTracsactionRoute)
    app.use("/api/tables", tableRoute) 
    app.use("/api/fruits", fruitRoute) 
    app.use("/api/fruit-orders", fruitOrderRoute) 
    app.use("/api/customers", customerRoute) 
    app.use("/api/vouchers", voucherRoute)
}

module.exports = router