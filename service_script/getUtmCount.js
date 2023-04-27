const db = require("../database")
db.connection.authenticate().then(async () => {
    const utm = await db.models.Utm.findAll({
        where: { utm: "kwjc" },
    })
    console.log(utm.length)
})
