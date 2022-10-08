const express = require('express')
const cors = require('cors')
const responseData = require('./config/responseData.json')

const app = express()
app.use(cors())
app.use(express.json())

app.listen(5212, async () => {
	app.post('/', (req, res) => {
		if (req.body.method === 'private/get_user_trades_by_order') res.send(responseData.get_user_trades_by_order)
		if (req.body.method === 'private/sell') res.send(responseData.buy_data)
		if (req.body.method === 'public/auth') res.send(responseData.auth_data)
		if (req.body.method === 'public/get_index_price') res.send(responseData.get_index_price)
	})
	app.get('/public/get_book_summary_by_currency', (req, res) => {
		res.send(responseData.get_book_summary_by_currency)
	})
})
