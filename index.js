const express = require('express')
const axios = require('axios')
const Telegram = require('./lib/telegram')
const telegram = new Telegram()
global.telegram = telegram
const useRouter = require('./rotes/router')
const dotenv = require('dotenv');
const cors = require('cors')
const db = require('./database');
const model = require('./lib/modelWrapper')(db.models)
const { getAccessToken } = require('./lib/auth');
const { get_order, get_index_price } = require('./config/requestData.json');
const Transfer = require('./lib/transfer');
const Web3 = require('web3')
const crud = require('./lib/express-crud')
const { smartRound } = require('./lib/lib')

dotenv.config();

const infuraRpc = process.env.INFURA_RPC;
const apiUrl = process.env.API_URL;
const PORT = process.env.PORT || 8080

const web3 = new Web3(infuraRpc);

const transfer = new Transfer()
transfer.init()
const app = express()
crud(app)
app.use(cors())
app.use(express.json())
app.use('/api', useRouter)
app.crud('/api/order_crud', model.Order)

db.connection
	.sync({ alter: true })
	.then(async () => {
		app.listen(PORT, async () => {
			console.log(`listen on port ${PORT}`)

			// ! auto payment complete
			setInterval(async () => {
				try {
					const orders = await db.models.Order.findAll(
						{
							where: {
								[db.Op.and]: [
									{ execute_date: { [db.Op.gt]: new Date() } },
									{ payment_complete: false }
								]
							}
						}
					)

					if (orders.length) console.log(orders)

					orders.forEach(async ({ user_payment_tx_hash, order_id }) => {
						if (user_payment_tx_hash && order_id) {
							const { status } = await web3.eth.getTransactionReceipt(user_payment_tx_hash)
							if (status) {
								await db.models.Order.update({ payment_complete: true }, { where: { order_id } })
							}
						}
					})
				} catch (e) {
					console.log(e)
				}
			}, 10000)



			// ! auto order complete
			setInterval(async () => {
				try {
					const accessToken = await getAccessToken()

					const orders = await db.models.Order.findAll(
						{
							where: {
								[db.Op.and]: [
									{ execute_date: { [db.Op.lte]: new Date() } },
									{ order_complete: false },
									{ status: { [db.Op.notIn]: ['approved', 'denied'] } }
								]
							}
						}
					)

					orders.forEach(async (order) => {
						try {
							const orderDetails = JSON.parse(order.order) ? JSON.parse(order.order) : null
							if (orderDetails && order.order_id 
								// || order.id === 111
								) {
								get_order.params.order_id = order.order_id
								const { data } = await axios.post(apiUrl, get_order, { headers: { 'Authorization': `Bearer ${accessToken}` } })
								const orderFrashData = data?.result.length ? data?.result[0] : {}
								const executed = orderFrashData.state === 'filled' || orderFrashData.order_state === 'filled' ? true : false
								if (executed 
									// || order.id === 111
									) {
									if (order.status !== 'pending_approve') {
										const indexPriceData = await axios.post(apiUrl, get_index_price)
										await db.models.Order.update({ status: 'pending_approve', end_index_price: indexPriceData?.data?.result?.index_price }, { where: { order_id: order.order_id } })
										const orderUpdated = await db.models.Order.findOne({ where: { order_id: order.order_id } })

										let recieve
										if (orderDetails.direction === 'sell') {
											if (orderUpdated.end_index_price >= orderUpdated.target_index_price) {
												recieve = `${parseFloat(orderUpdated.recieve) + parseFloat(orderUpdated.price)} USDC`
											} else {
												const BN = web3.utils.BN
												const valueWei = await web3.utils.toWei(String(parseFloat(orderUpdated.amount) + (parseFloat(orderUpdated.recieve) / parseFloat(orderUpdated.end_index_price))), 'ether')
												recieve = `${Number(web3.utils.fromWei(new BN(valueWei)))} ETH`
											}
										} else {
											if (orderUpdated.end_index_price <= orderUpdated.target_index_price) {
												recieve = `${smartRound(parseFloat(orderUpdated.recieve) / parseFloat(orderUpdated.end_index_price)) + orderUpdated.amount} ETH`
											} else {
												recieve = `${parseFloat(orderUpdated.price) * parseFloat(orderUpdated.amount) + parseFloat(orderUpdated.recieve)} USDC`
											}
										}
										

										telegram.sendApprove(`Confirm the payment which you're about to make.\n${orderUpdated.from} will recieve ${recieve}\n\n${JSON.stringify(orderUpdated)}`, orderUpdated)
										return
									}
								}
							}
						} catch (e) {
							// return
							// console.log(order)
							console.log(e)
						}
					})
				} catch (e) {
					console.log(e)
				}
			}, 10000)


			// TODO
			// // ! auto send currency
			// setInterval(async () => {
			// 	try {
			// 		const orders = await db.models.Order.findAll(
			// 			{
			// 				where: {
			// 					[db.Op.and]: [
			// 						{ execute_date: { [db.Op.lte]: new Date() } },
			// 						{ order_complete: false },
			// 						{ status: { [db.Op.notIn]: ['approved', 'denied'] } },
			// 						{ confirmation: true }
			// 					]
			// 				}
			// 			}
			// 		)

			// 		orders.forEach(async (order) => {
			// 			try {
			// 				console.log(order)
			// 				const orderDetails = JSON.parse(order.order) ? JSON.parse(order.order) : null
			// 				const order_id = order.order_id
			// 				if (orderDetails && order_id) {
			// 					let status, message, tx
			// 					const isValidToSell = order.end_index_price >= order.target_index_price
			// 					const USDCToPay = Math.floor(parseFloat(order.recieve)) + parseFloat(order.price)
			// 					const ETHToPay = parseFloat(order.amount) + (parseFloat(order.recieve) / parseFloat(order.end_index_price))
								
			// 					if (isValidToSell) {
			// 						const res = await transfer.sendUSDC(order.from, USDCToPay)
			// 						status = res.status
			// 						message = res.message
			// 						tx = res.tx
			// 					} else {
			// 						const res = await transfer.sendETH(order.from, ETHToPay)
			// 						status = res.status
			// 						message = res.message
			// 						tx = res.tx
			// 					}
								
			// 					if (status === true) {
			// 						await db.models.Order.update({ order_complete: true, status: 'approved', settlement_date: new Date(), eth_sold: isValidToSell, payout_eth: ETHToPay, payout_usdc: USDCToPay, payout_tx: tx }, { where: { order_id } })
			// 						telegram.send(`success!\n${message}`)
			// 					} else {
			// 						await db.models.Order.update({ order_complete: false, status }, { where: { order_id } })
			// 						telegram.send(`failed!\n${message}`)
			// 					}
			// 				}
			// 			} catch (e) {
			// 				// return
			// 				// console.log(order)
			// 				console.log(e)
			// 			}
			// 		})
			// 	} catch (e) {
			// 		console.log(e)
			// 	}
			// }, 10000)

			// // ! auto balance updater
			// setInterval(async () => {
			// 	try {
			// 		const web3 = new Web3(infuraRpc);
			// 		const BN = web3.utils.BN
			// 		const tokenRequests = await db.models.BalanceHistory.findAll({ where: { status: 'pending' } })
			// 		tokenRequests.forEach(async ({ address, tx_hash }) => {
			// 			console.log({address, tx_hash})
			// 			if (address && tx_hash) {
			// 				const { status } = await web3.eth.getTransactionReceipt(tx_hash)
			// 				const { value } = await web3.eth.getTransaction(tx_hash)
			// 				const valueEth = web3.utils.fromWei(new BN(value), 'ether')
			// 				if (status) {
			// 					const { balance } = await db.models.User.findOne({ where: { address: address.toLowerCase() } })
			// 					await db.models.User.update({ balance: parseFloat(balance) + parseFloat(valueEth) }, { where: { address: address } })
			// 					await db.models.BalanceHistory.update({ status: 'complete' }, { where: { tx_hash } })

			// 					console.log(`for ${address} updated balance for ${valueEth} total is ${parseFloat(balance) + parseFloat(valueEth)}`)
			// 				}
			// 			}
			// 		})
			// 	} catch (e) {
			// 		console.log(e)
			// 	}
			// }, 5000)
		})
	})
	.catch((e) => console.log(e))