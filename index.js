const express = require('express')
const cors = require('cors')
const app = new express()
const port = 3001
app.use(cors())

app.get('/', async (req, res) => {
    res.status(200).send({ succes: true })
})

app.listen(port, async function () {
    console.log("Server ready on port " + port)
})