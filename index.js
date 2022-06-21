const express = require('express')
const cors = require('cors')
const axios = require('axios')
const jsonData = require('./data/data.js')
const app = new express()
const port = 3001
const currentDayOfWeek = Date.parse("2022-06-20 00:00:00")
const lastDayofWeek = Date.parse("2022-06-30 00:00:00")
const apiUrl = 'https://deribit.com/api/v2/public'
const strikeStep = 100

const jsonDate =[]

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/', async (req, res) => {
    res.status(200).send({ succes: true })
    console.log("success")
})

app.listen(port, async function () {
    console.log("Server ready on port " + port)
})

app.get('/get_dates', async (req, res) => {
    axios.get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`).then(apiRes =>{
            const fillteredDate = apiRes.data.result.filter(item =>{
            const [_, stortedDataUnderlying_index] = item.underlying_index.split('-')
            const date = new Date(Date.parse(stortedDataUnderlying_index)).getTime() 
    
            return (date >= currentDayOfWeek && date <= lastDayofWeek)
        })
    
        // console.log("fillteredDate", fillteredDate)

        res.json(fillteredDate)
    
    }).catch(err => console.log(err.apiRes.data))
})

app.get('/get_strikes', async(req, res) =>{

    axios.get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`).then(apiRes =>{

    })

    for (data of jsonData) {
        const strike = Number(data.instrument_name.split('-')[2])
        strikes.push({ strike, data })
    }
    for (data of strikes) {

    }
    //TODO Вытащить все старйки интересующих нас цен
})


app.get('/get_prices', async (req, res) => {
    
    axios.get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`).then(apiRes =>{
        
        const currentPrice = apiRes.data.result[0].underlying_price// TODO Получить цену текущую
        const prices = []
        console.log("currentPrice", currentPrice)
        const formatedCurrentPrice = Math.round(currentPrice / 100) * 100
        for (i = -4; i <= 4; i++) prices.push(formatedCurrentPrice + i * strikeStep)
        res.json({success:true, data:{currentPrice, prices}})
    })
})      

app.get('/get_periods', async (req, res) => {
    const periods = [
        { title: 'Tomorow', key: 'tomorow' },
        { title: '1 Week', key: 'week' },
        { title: 'One Week', key: '1week' },
        { title: 'Two Week', key: '2week' },
        { title: 'One Month', key: '1month' }
    ]
    res.json({ success: true, data: { periods } })
})

app.post('/get_order_data', (req, res) => {
    const {period, price} = req.body

    jsonData[period] = {
        period, price
    }
    
    res.json(jsonData[period])//пробежаться по массиву отфильтровать по дате и цене instrument name
})