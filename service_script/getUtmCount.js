const db = require("../database")
db.connection.authenticate().then(async () => {
    const utm = await db.models.Utm.findAll({
        where: { utm: "tylxz" },
    })
    console.log(utm.length)
})
