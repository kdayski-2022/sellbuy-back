const axios = require('axios')
const dotenv = require('dotenv');
const { strike_step } = require('../config/constants.json')
dotenv.config();
const apiUrl = process.env.API_URL;

class PriceContoller {
	async getPrices(req, res) {
		axios
		  .get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`)
		  .then((apiRes) => {
			const currentPrice = apiRes.data.result[0].estimated_delivery_price;
			const prices = [];
			const formatedCurrentPrice = Math.round(currentPrice / 100) * 100;
			for (let i = -4; i < 4; i++)
			  prices.push(formatedCurrentPrice + i * strike_step);
			res.json({ success: true, data: { currentPrice, prices } });
		  })
		  .catch((err) => console.log(err));
	}

	async getSellPrices(req, res) {
		axios
		  .get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`)
		  .then((apiRes) => {
			const currentPrice = apiRes.data.result[0].estimated_delivery_price;
			const prices = [];
			const formatedCurrentPrice = Math.round(currentPrice / 100) * 100;
			for (let i = 0; i < 4; i++)
			  prices.push(formatedCurrentPrice + i * strike_step);
			res.json({ success: true, data: { currentPrice, prices } });
		  })
		  .catch((err) => console.log(err));
	}

	async getBuyPrices(req, res) {
		axios
		  .get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`)
		  .then((apiRes) => {
			const currentPrice = apiRes.data.result[0].estimated_delivery_price;
			const prices = [];
			const formatedCurrentPrice = Math.round(currentPrice / 100) * 100;
			for (let i = -4; i < 0; i++)
			  prices.push(formatedCurrentPrice + i * strike_step);
			res.json({ success: true, data: { currentPrice, prices } });
		  })
		  .catch((err) => console.log(err));
	}
}

module.exports = new PriceContoller()
