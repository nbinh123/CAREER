module.exports = (bot) => {
    require("./analyst.callback")(bot);
    require("./order.callback")(bot);
    require("./storage.callback")(bot);

};