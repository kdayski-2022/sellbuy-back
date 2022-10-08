const axios = require('axios')
const dotenv = require('dotenv');
const { strike_step } = require('../config/constants.json');
const { writeLog, updateLog } = require('../lib/logger');
dotenv.config();
const apiUrl = process.env.API_URL;

class PriceContoller {
	async getPrices(req, res) {
		const logId = await writeLog({ action: 'getPrices', status: 'in progress', req })
		axios
			.get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
			.then((apiRes) => {

				const currentPrice = apiRes.data.result[0].estimated_delivery_price;
				const prices = [];
				const formatedCurrentPrice = Math.round(currentPrice / 100) * 100;

				for (let i = -4; i < 4; i++)
					prices.push(formatedCurrentPrice + i * strike_step);
				
				updateLog(logId, { status: 'success' })
				res.json({ success: true, data: { currentPrice, prices } });
			})
			.catch((err) => {
				console.log(err)
				updateLog(logId, { status: 'failed', error: JSON.stringify(err) })
				res.json({ success: false, data: null });
			});
	}

	async getCurrentPrice(req, res) {
		const logId = await writeLog({ action: 'getCurrentPrice', status: 'in progress', req })
		axios
			.get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
			.then((apiRes) => {
				const currentPrice = apiRes.data.result[0].estimated_delivery_price;
				updateLog(logId, { status: 'success' })
				res.json({ success: true, data: { currentPrice } });
			})
			.catch((err) => {
				console.log(err)
				updateLog(logId, { status: 'failed', error: JSON.stringify(err) })
				res.json({ success: false, data: null });
			});
	}

	async getSellPrices(req, res) {
		const logId = await writeLog({ action: 'getSellPrices', status: 'in progress', req })
		axios
			.get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
			.then((apiRes) => {
				try {
					const currentPrice = apiRes.data.result[0].estimated_delivery_price;
					const prices = [];
					const formatedCurrentPrice = Math.ceil(currentPrice / 100) * 100;
					for (let i = 0; i < 4; i++)
						prices.push(formatedCurrentPrice + i * strike_step);

					updateLog(logId, { status: 'success' })
					res.json({ success: true, data: { currentPrice, prices } });
				} catch (e) {
					throw new Error(e.message)
				}
			})
			.catch((err) => {
				updateLog(logId, { status: 'failed', error: JSON.stringify(err) })
				res.json({ success: false, data: null, error: err })
			});
	}

	async getBuyPrices(req, res) {
		const logId = await writeLog({ action: 'getBuyPrices', status: 'in progress', req })
		axios
			.get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
			.then((apiRes) => {
				try {
					const currentPrice = apiRes.data.result[0].estimated_delivery_price;
					const prices = [];
					const formatedCurrentPrice = Math.ceil(currentPrice / 100) * 100;
					
					for (let i = -4; i < 0; i++)
						prices.push(formatedCurrentPrice + i * strike_step);

					updateLog(logId, { status: 'success' })
					res.json({ success: true, data: { currentPrice, prices } });
				} catch (e) {
					throw new Error(e.message)
				}
			})
			.catch((err) => {
				updateLog(logId, { status: 'failed', error: JSON.stringify(err) })
				res.json({ success: false, data: null, error: err })
			});
	}
}

module.exports = new PriceContoller()
