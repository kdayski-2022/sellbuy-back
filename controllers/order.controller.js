const axios = require('axios')
const dotenv = require('dotenv');
const Web3 = require('web3')
const db = require('../database')
const { buy_data, auth_data } = require('../config/requestData.json')
const { getLastDayOfWeek, getFirstDayOfWeek, getTimestamp, getDaysDifference, getValidDays } = require('../lib/dates')
const { getAccessToken } = require('../lib/auth')
dotenv.config();
const apiUrl = process.env.API_URL;
const infuraRpc = process.env.INFURA_RPC;

class OrderContoller {
	async getOrder(req, res) {
		axios
		.get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
		.then((apiRes) => {
		  try {
			console.log(req.query)
			const { period, price, amount } = req.query;

			const filteredTypes = apiRes.data.result.filter((item) => {
				const typesArray = item.instrument_name.split('-')
				const type = typesArray[typesArray.length - 1]
				return type === 'C'
			})
	
			const fillteredPrices = filteredTypes.filter(
			  (item) => {
				const priceArray = item.instrument_name.split('-')
				const instrument_price = priceArray[priceArray.length - 2]
				return instrument_price === price
			  }
			);
	
			const fillteredDates = fillteredPrices.filter((item) => {
				const [_, stortedDataUnderlying_index] = item.underlying_index.split('-');
				const targetPeriod = Date.parse(stortedDataUnderlying_index);
				const daysDifference = getDaysDifference(period)
				const validDays = getValidDays(daysDifference, targetPeriod)
				const choosenDay = new Date(Number(period)).getDate()
				const targetDay = new Date(Number(getTimestamp(targetPeriod))).getDate()
				console.log({targetDay, choosenDay})
				if (validDays.includes(choosenDay)) return item
			});

			console.log({fillteredDates})

			const bidPriceAvailable = fillteredDates.filter(
			  (item) => item.bid_price
			);
	
			if (!bidPriceAvailable.length) throw new Error("Order wasn't found");
	
			const maxBidPriceObj = bidPriceAvailable
			  .sort((a, b) =>
				a.bid_price > b.bid_price ? 1 : b.bid_price > a.bid_price ? -1 : 0
			  )
			  .reverse()[0];
			const { estimated_delivery_price, bid_price } = maxBidPriceObj;
			const recieve = estimated_delivery_price * bid_price * amount * 0.7;
	
			res.json({ success: true, data: { ...maxBidPriceObj, recieve } });
		  } catch (e) {
			res.json({ success: false, data: null });
		  }
		});
	}

	async postOrder(req, res) {
		const { amount, price, period, hash, orderData } = req.body
		const { instrument_name } = orderData
		buy_data.params.instrument_name = instrument_name
		buy_data.params.amount = Number(amount)

		// Запись в бд (пока не нужно)
		const newTransaction = await db.models.Order.create({ tx_hash: hash, instrument_name, execute_date: period })

		const web3 = new Web3(infuraRpc);
		const { from } = await web3.eth.getTransaction(hash);

		try {
			const accessToken = await getAccessToken()
			const buyRes = await axios.post(apiUrl, buy_data, { headers: {'Authorization': `Bearer ${accessToken}`} })

			res.json({ success: true, data: { from }, message: 'Order was made' });
		} catch(e) {
			res.json({ success: false, data: null, error: e?.response?.data?.error?.message });
		}
	}
}

module.exports = new OrderContoller()