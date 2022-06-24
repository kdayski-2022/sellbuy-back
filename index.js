import express, { response } from 'express' 
import axios from 'axios' 
import cors from 'cors'
import {jsonData} from './data/data.js'
import {getCurrentDay} from './dates/dates.js'
import { getLastDay} from './dates/dates.js'
import { getFutureTimestamp } from './dates/dates.js'
import { TOMORROW } from './dates/dates.js'
import { WEEK } from './dates/dates.js'
import { TWO_WEEK } from './dates/dates.js'
import { MONTH } from './dates/dates.js'

const app = new express()
const port = 3001
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
    try{
      const result = await axios.get("http://localhost:3001/get_dates")
    //   console.log(result)
        // console.log(getCurrentDay("22-06-22"))
    }
    catch(e){
        console.log(e)
    }
        
})

app.get('/get_dates', async (req, res) => {
    axios.get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`).then(apiRes =>{
            const fillteredDate = apiRes.data.result.filter(item =>{
            const [_, stortedDataUnderlying_index] = item.underlying_index.split('-')
            const date = new Date(Date.parse(stortedDataUnderlying_index))
            // console.log("current day" , getCurrentDay())
            // console.log("last day" , getLastDay())
            // console.log("date" , date)
            return (date >= getCurrentDay() && date <= getLastDay())
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
        const currentPrice = apiRes.data.result[0].estimated_delivery_price// TODO Получить цену текущую
        const prices = []
        console.log("currentPrice", currentPrice)
        const formatedCurrentPrice = Math.round(currentPrice / 100) * 100
        console.log("formatedCurrentPrice", currentPrice)
        for (let i = -4; i < 4; i++) prices.push(formatedCurrentPrice + i * strikeStep)
        res.json({success:true, data:{currentPrice, prices}})
    }).catch(err => console.log(err.apiRes.data))
})      

app.get('/get_periods', async (req, res) => {
    const periods = [
        { title: 'Tomorow', key: 'tomorow', timestamp: getFutureTimestamp(TOMORROW)},
        { title: '1 Week', key: 'week' , timestamp: getFutureTimestamp(WEEK)},
        { title: 'One Week', key: '1week', timestamp: getFutureTimestamp(WEEK)},
        { title: 'Two Week', key: '2week', timestamp: getFutureTimestamp(TWO_WEEK) },
        { title: 'One Month', key: '1month', timestamp: getFutureTimestamp(MONTH) }
    ]
    res.json({ success: true, data: { periods } })
})

app.post('/post_order_data', (req, res) => {
    axios.get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`).then(apiRes => {
        const bidPrices = []
        const fillteredPrices = []
        const {period, price} = req.body

        const fillteredPrice = apiRes.data.result.filter(item => 
            item.estimated_delivery_price > price - 100 &&  item.estimated_delivery_price <= price
        )

        fillteredPrices.push(fillteredPrice)

        // const fillteredDate = fillteredPrice.filter(item =>{
        //     const [_, stortedDataUnderlying_index] = item.underlying_index.split('-')
        //     period = new Date(Date.parse(stortedDataUnderlying_index))
        //     console.log("period" , period)
        //     return(period >= getCurrentDay() && period <= getLastDay())
        // })
        

        let minBidPrice = apiRes.data.result[0].bid_price
        let maxBidPrice = apiRes.data.result[0].bid_price
        
        for(let i = 0; i < apiRes.data.result.length; i++){

            if(apiRes.data.result[i].bid_price > maxBidPrice){
                maxBidPrice = apiRes.data.result[i].bid_price
            }
    
            else if (apiRes.data.result[i].bid_price < minBidPrice){
                minBidPrice = apiRes.data.result[i].bid_price
            }
        }
        bidPrices.push(maxBidPrice, minBidPrice)
        res.json({success: true, data: {fillteredPrice}})
    })

   // отфильтровать по дате из того что получилось повторно отфильтровать по дате fillteredPrice (timestamp )
})