const axios = require('axios')
const dotenv = require('dotenv');
const Web3 = require('web3')
const db = require('../database')
const { buy_data, sell_data, get_index_price } = require('../config/requestData.json')
const { getDaysDifference, getValidDays, getTimestamp } = require('../lib/dates')
const { getAccessToken } = require('../lib/auth');
const { writeLog, updateLog } = require('../lib/logger');
dotenv.config();
const apiUrl = process.env.API_URL;
const infuraRpc = process.env.INFURA_RPC;

class OrderContoller {
	async getOrder(req, res) {
		const logId = await writeLog({ action: 'getOrder', status: 'in progress', req })
		axios
		.get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
		.then((apiRes) => {
		  try {
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
				const choosenMonth = new Date(Number(period)).getMonth()
				const targetMonth = new Date(getTimestamp(targetPeriod)).getMonth()
				if (validDays.includes(choosenDay) && choosenMonth === targetMonth) return item
			});
			
			// Bid price is not stable

			// ! ONLY FOR DEV
			// const bidPriceAvailable = fillteredDates.map(
			// 	(item) => item.bid_price ? item : {...item, bid_price: Math.random() / 10}
			//   );

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

			updateLog(logId, { status: 'success' })
			res.json({ success: true, data: { ...maxBidPriceObj, recieve } });
		  } catch (e) {
			updateLog(logId, { status: 'failed', error: JSON.stringify(e) })
			res.json({ success: false, data: null, message: e.message });
		  }
		});
	}

	async postOrder(req, res) {
		const logId = await writeLog({ action: 'postOrder', status: 'in progress', req })
		const { amount, price, period, orderData, address, hash, direction } = req.body
		const { instrument_name, estimated_delivery_price, bid_price  } = orderData
		const postData = direction === 'sell' ? sell_data : buy_data
		postData.params.instrument_name = instrument_name
		postData.params.amount = Number(amount)

		try {
			// add balance
			direction === 'sell' ? telegram.send(`User ${address} deposited ${amount} ETH`) : telegram.send(`User ${address} deposited ${Number(amount) * Number(price)} USDC`) 
			await db.models.BalanceHistory.create({ address, tx_hash: hash, status: 'pending' })
			let user = await db.models.User.findOne({ where: { address: address.toLowerCase() } })
			if (!user) user = await db.models.User.create({ address, balance: 0 })
			const web3 = new Web3(infuraRpc);

			const { status } = await web3.eth.getTransactionReceipt(hash)

			// post order
			if (status) {
				await db.models.Order.create({
					from: address.toLowerCase(),
					user_payment_tx_hash: hash,
					amount,
					price,
					order_complete: false,
					payment_complete: status ? true : false,
					instrument_name,
					execute_date: period,
					recieve: estimated_delivery_price * bid_price * amount * 0.7,
					status: 'pending',
				})
				const accessToken = await getAccessToken()
				
				console.log({ accessToken })
				console.log({ apiUrl, postData })

				const { data } = await axios.post(apiUrl, postData, { headers: {'Authorization': `Bearer ${accessToken}`} })
				const indexPriceData = await axios.post(apiUrl, get_index_price)

				await db.models.Order.update({
					status: 'created',
					order_id: data?.result?.order?.order_id,
					order: JSON.stringify(data?.result?.order) || '{}',
					target_index_price: price,
					start_index_price: indexPriceData?.data?.result?.index_price
				}, { where: { user_payment_tx_hash: hash } })
				
				telegram.send(`Order was made by user ${address}\n${JSON.stringify(data?.result?.order) || '{}'}`)
				const orders = await db.models.Order.findAll({ where: { from: address.toLowerCase() } })
				const { balance } = await db.models.User.findOne({ where: { address: address.toLowerCase() } })
				if (parseFloat(balance) >= parseFloat(amount)) {
					await db.models.User.update({ balance: parseFloat(balance) - parseFloat(amount) }, { where: { address: address.toLowerCase() } })
					res.json({ success: true, data: { orders }, message: 'Order was made' });
				} else {
					res.json({ success: true, data: { orders }, message: 'Payment is pending' });
				}
			} else {
				console.log('Transaction was not mined')
				res.json({ success: false, data: null, error: 'Transaction was not mined' });
			}
			updateLog(logId, { status: 'success' })
		} catch(e) {
			updateLog(logId, { status: 'failed', error: JSON.stringify(e) })
			await db.models.ErrorLog.create({ log: JSON.stringify(e) })
			telegram.send(`Order ${instrument_name} creation failed by user ${address}\n${JSON.stringify(e?.response?.data?.error)}`)
			res.json({ success: false, data: null, error: e?.response?.data?.error?.message });
		}
	}

	async getUserOrders(req, res) {
		const logId = await writeLog({ action: 'getUserOrders', status: 'in progress', req })
		const { userAddress } = req.query

		try {
			const orders = await db.models.Order.findAll({where: {from: userAddress.toLowerCase()}})
			updateLog(logId, { status: 'success' })
			res.json({ success: true, data: orders });
		} catch(e) {
			console.log(e)
			updateLog(logId, { status: 'failed', error: JSON.stringify(e) })
			res.json({ success: false, data: null, error: e?.response?.data?.error?.message });
		}
	}
}

module.exports = new OrderContoller()