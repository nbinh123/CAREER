const mongoose = require("mongoose")

require('dotenv').config();
const link = "mongodb://127.0.0.1:27017";

async function connect() {

    // connect tới database blog
    try {
        await mongoose.connect(`${link}`,{
            dbName : "Quan_an",
            useNewUrlParser: true,
            useUnifiedTopology: true,
            
        });
        console.log("Connect project Successfully")
    } catch (error) {
        console.log("Connect project Failure!")
    }
    
    
    // connect tới database collection
    
}

module.exports = { connect };