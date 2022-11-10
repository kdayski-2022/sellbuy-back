const axios = require('axios')
const dotenv = require('dotenv');
const { strike_step_sell, strike_step_buy } = require('../config/constants.json');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
dotenv.config();
const apiUrl = process.env.API_URL;

class PriceContoller {

	async getCurrentPrice(req, res) {
		const sessionInfo = await checkSession(req)
		const logId = await writeLog({ action: 'getCurrentPrice', status: 'in progress', sessionInfo, req })
		axios
			.get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
			.then((apiRes) => {
				const currentPrice = apiRes.data.result[0].estimated_delivery_price;
				updateLog(logId, { status: 'success' })
				res.json({ success: true, data: { currentPrice }, sessionInfo });
			})
			.catch((err) => {
				updateLog(logId, { status: 'failed', error: JSON.stringify(err) })
				res.json({ success: false, data: null, sessionInfo });
			});
	}

	async getSellPrices(req, res) {
		const sessionInfo = await checkSession(req)
		const logId = await writeLog({ action: 'getSellPrices', status: 'in progress', sessionInfo, req })
		axios
			.get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
			.then((apiRes) => {
				try {
					const currentPrice = apiRes.data.result[0].estimated_delivery_price;
					const prices = [];
					const formatedCurrentPrice = Math.ceil(currentPrice / strike_step_sell) * strike_step_sell;
					for (let i = 0; i < 4; i++)
						prices.push(formatedCurrentPrice + i * strike_step_sell);

					updateLog(logId, { status: 'success' })
					res.json({ success: true, data: { currentPrice, prices }, sessionInfo });
				} catch (e) {
					throw new Error(e.message)
				}
			})
			.catch((err) => {
				updateLog(logId, { status: 'failed', error: JSON.stringify(err) })
				res.json({ success: false, data: null, error: err, sessionInfo })
			});
	}

	async getBuyPrices(req, res) {
		const sessionInfo = await checkSession(req)
		const logId = await writeLog({ action: 'getBuyPrices', status: 'in progress', sessionInfo, req })
		axios
			.get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
			.then((apiRes) => {
				try {
					const currentPrice = apiRes.data.result[0].estimated_delivery_price;
					const prices = [];
					const formatedCurrentPrice = Math.ceil(currentPrice / strike_step_buy) * strike_step_buy;
					for (let i = -4; i < 0; i++)
						prices.push(formatedCurrentPrice + i * strike_step_buy);

					updateLog(logId, { status: 'success' })
					res.json({ success: true, data: { currentPrice, prices }, sessionInfo });
				} catch (e) {
					throw new Error(e.message)
				}
			})
			.catch((err) => {
				updateLog(logId, { status: 'failed', error: JSON.stringify(err) })
				res.json({ success: false, data: null, error: err, sessionInfo })
			});
	}
}

module.exports = new PriceContoller()
