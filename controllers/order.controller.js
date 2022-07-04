const axios = require('axios')
const dotenv = require('dotenv');
const Web3 = require('web3')
const db = require('../db')
const { getLastDayOfWeek, getFirstDayOfWeek } = require('../lib/dates')
const transactionContoller = require('./transaction.controller')
dotenv.config();
const apiUrl = process.env.API_URL;
const infuraRpc = process.env.INFURA_RPC;

class OrderContoller {
	async getOrder(req, res) {
		axios
		.get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`)
		.then((apiRes) => {
		  try {
			const { period, price, amount } = req.query;
	
			const fillteredPrices = apiRes.data.result.filter(
			  (item) =>
				item.estimated_delivery_price > price - 100 &&
				item.estimated_delivery_price <= price
			);
	
			const fillteredDates = fillteredPrices.filter((item) => {
			  const [_, stortedDataUnderlying_index] =
				item.underlying_index.split('-');
				const targetPeriod = new Date(
				Date.parse(stortedDataUnderlying_index)
			  ).getTime();
			 
			  return getFirstDayOfWeek(targetPeriod) <= Number(period) && Number(period) <= getLastDayOfWeek(targetPeriod) ;
			});
			
	
			const bidPriceAvailable = fillteredDates.filter(
			  (item) => item.bid_price
			);
	
			if (!bidPriceAvailable.length) throw "Order wasn't found";
	
			const maxBidPriceObj = bidPriceAvailable
			  .sort((a, b) =>
				a.bid_price > b.bid_price ? 1 : b.bid_price > a.bid_price ? -1 : 0
			  )
			  .reverse()[0];
			const { estimated_delivery_price, bid_price } = maxBidPriceObj;
			const recieve = estimated_delivery_price * bid_price * amount * 0.7;
	
			res.json({ success: true, data: { ...maxBidPriceObj, recieve } });
		  } catch (e) {
			res.json({ success: false, error: e, data: null });
		  }
		});
	}

	async postOrder(req, res) {
		const { amount, hash } = req.body
		const newTransaction = await db.query('INSERT INTO transaction (hash) values ($1) RETURNING *', [hash])
		const web3 = new Web3(infuraRpc);
		const { from } = await web3.eth.getTransaction(hash);
		res.json({ success: true, data: {from} });
	}
}

module.exports = new OrderContoller()