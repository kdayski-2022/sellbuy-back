const express = require('express')
const axios = require('axios')
const useRouter = require('./rotes/router')
const dotenv = require('dotenv');
const cors = require('cors')
const db = require('./database')
dotenv.config();

const PORT = process.env.PORT || 8080

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', useRouter)

db.connection
.sync({ alter: true })
.then(async () => {
	app.listen(PORT, async () => {
		// axios.post(`http://localhost:${PORT}/api/order`, {
			
		// 		"hash": "0x417815533622dd1d8e679d4bb3746f1d67fc4f44db25546af701d6ea5e6564e6",
		// 		"amount": "0.1",
		// 		"price": 1700,
		// 		"period": 1662035323782,
		// 		"orderData": {
		// 			"volume": 0,
		// 			"underlying_price": 1662.4498645644348,
		// 			"underlying_index": "SYN.ETH-3AUG22",
		// 			"quote_currency": "ETH",
		// 			"price_change": null,
		// 			"open_interest": 0,
		// 			"mid_price": null,
		// 			"mark_price": 0.005687,
		// 			"low": null,
		// 			"last": null,
		// 			"interest_rate": 0,
		// 			"instrument_name": "ETH-3AUG22-1700-C",
		// 			"high": null,
		// 			"estimated_delivery_price": 1663.1,
		// 			"creation_timestamp": 1659356930883,
		// 			"bid_price": 0.0005,
		// 			"base_currency": "ETH",
		// 			"ask_price": null,
		// 			"recieve": 0.0582085
		// 		}
			
		// }).then((res) => console.log(res.data))
		
		// axios.get(`http://localhost:${PORT}/api/order`, {params: { price: '1300', period: '1658493313415', amount: '1' }}).then((res) => console.log(res.data))
		console.log(`listen on port ${PORT}`)
	})
})
.catch((e) => console.log(e))