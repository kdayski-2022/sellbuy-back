const express = require('express')
const cors = require('cors')
const axios = require('axios')

const jsonData = require('./data/data.js')
const app = new express()
const port = 3001
const currentDayOfWeek = Date.parse("2022-06-13 00:00:00")
const lastDayofWeek = Date.parse("2022-06-20 00:00:00")
const apiUrl = 'https://deribit.com/api/v2/public'
const strikeStep = 100
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/', async (req, res) => {
    res.status(200).send({ succes: true })
    console.log("success")
})

app.listen(port, async function () {
    console.log("Server ready on port " + port)
})

app.get('/test', async (req, res) => {
    res.json(test())
})
app.get('/get_prices', async (req, res) => {
    const currentPrice = 1213.12 // TODO Получить цену текущую
    const formatedCurrentPrice = Math.round(currentPrice / 100) * 100
    const prices = []
    for (i = -4; i <= 4; i++) prices.push(formatedCurrentPrice + i * strikeStep)
    res.json({ success: true, data: { currentPrice, prices } })
})
app.get('/get_periods', async (req, res) => {
    const periods = [
        { title: 'Tomorow', key: 'tomorow' },
        { title: '1 Week', key: 'week' },
        { title: 'One Week', key: '1week' },
        { title: 'Two Week', key: '2week' },
        { title: 'One Month', key: '1month' },
    ]
    res.json({ success: true, data: { periods } })
})
app.post('/order', (req, res) => {
    console.log(req.body)
    res.json({ success: true })
})
function getStrikes() {

    let strikes = []
    for (data of jsonData) {
        const strike = Number(data.instrument_name.split('-')[2])
        strikes.push({ strike, data })
    }
    for (data of strikes) {

    }
    //TODO Вытащить все старйки интересующих нас цен
    // console.log(strikes)
}
getStrikes()
// test()
// getData()
function getData() {
    axios.get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`).then(res => {
        console.log(res.data.result.length)
        for (i of res.data.result) {
            console.log(i)
            break
        }
    }).catch(err => console.log(err.response.data))
}
function test() {
    const fillteredDate = jsonData.filter(item => {
        const [_, stortedDataUnderlying_index] = item.underlying_index.split('-')
        // const [first_part,stortedDataInstrument_name] = item.instrument_name.split('-')
        var date = new Date(Date.parse(stortedDataUnderlying_index)).getTime()
        // var dateInstrument_name = new Date(Date.parse(stortedDataInstrument_name)).getTime()
        // console.log("instrument name", dateInstrument_name, "instrument name string", stortedDataInstrument_name)
        // console.log("currentDayOfWeek: ", currentDayOfWeek)
        // console.log("currentDayOfWeek: ", new Date(currentDayOfWeek).toString())
        // console.log("lastDayofWeek: ", lastDayofWeek)
        // console.log("lastDayofWeek: ", new Date(lastDayofWeek).toString())
        // console.log("date: ", date)
        // console.log("date: ", new Date(date).toString())
        return (date >= currentDayOfWeek && date <= lastDayofWeek)
    })

    console.log("fillteredDate", fillteredDate)
    return fillteredDate
}

