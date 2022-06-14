const express = require('express')
const cors = require('cors')
const deribit = require('deribit-api')
const data = require('./data/data.js')
const app = new express()
const port = 3001
const currentDayOfWeek = Date.parse("2022-06-13 00:00:00")
const lastDayofWeek = Date.parse("2022-06-20 00:00:00")
app.use(cors())

app.get('/', async (req, res) => {
    res.status(200).send({ succes: true })
    console.log("success")
})

app.listen(port, async function () {
    console.log("Server ready on port " + port)
})

app.get('/test', async (req, res)=>{
    
    const fillteredDate = data.filter(item =>{
        const [_,stortedDataUnderlying_index] = item.underlying_index.split('-')
        // const [first_part,stortedDataInstrument_name] = item.instrument_name.split('-')
        var date = new Date(Date.parse(stortedDataUnderlying_index)).getTime()
        var dateInstrument_name = new Date(Date.parse(stortedDataInstrument_name)).getTime()
        console.log("instrument name", dateInstrument_name, "instrument name string",  stortedDataInstrument_name)
        console.log("currentDayOfWeek: ", currentDayOfWeek)
        console.log("currentDayOfWeek: ", new Date(currentDayOfWeek).toString())
        console.log("lastDayofWeek: ", lastDayofWeek)
        console.log("lastDayofWeek: ", new Date(lastDayofWeek).toString())
        console.log("date: ", date)
        console.log("date: ", new Date(date).toString())
        return (date >= currentDayOfWeek && date <= lastDayofWeek)
    })
      
    // console.log("fillteredDate", fillteredDate)
    res.json(fillteredDate)
})


