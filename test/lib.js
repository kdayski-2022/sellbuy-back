const { RESPONSE, RESPONSE_DATA, SESSION_INFO, PRICE_DATA, PERIOD_DATA, PERIOD_ITEM, VALID_PERIOD_ITEM, ORDER_DATA, POST_ORDER_DATA, USER_ORDER_DATA, USER_ORDER_DATA_ORDER, USER_ORDER_DATA_PERPETUAL, USER_ORDER_DATA_PERPETUAL_RESULT, USER_ORDER_DATA_PERPETUAL_RESULT_TRADE } = require("./constants")
const { getTransactionReceipt } = require("./transfer")

const propertiesTest = (obj, properties) => {
	properties.forEach((property) => expect(obj).toHaveProperty(property))
}

const isEmptyArray = (arr) => {
	expect(Array.isArray(arr)).toBe(true)
	expect(arr.length).toBeGreaterThan(0)
}

const testDefaultGetRequestProperties = (obj) => {
	propertiesTest(obj, RESPONSE)
	propertiesTest(obj.data, RESPONSE_DATA)
	propertiesTest(obj.data.sessionInfo, SESSION_INFO)
}

const pricesTest = (prices, direction) => {
	testDefaultGetRequestProperties(prices)
	propertiesTest(prices.data.data, PRICE_DATA)
	expect(prices.status).toBe(200)
	expect(prices.data && typeof prices.data === 'object').toBe(true)
	expect(prices.data.success).toBe(true)
	expect(prices.data.data && typeof prices.data.data === 'object').toBe(true)
	expect(typeof prices.data.data.currentPrice).toBe("number")
	isEmptyArray(prices.data.data.prices)
	expect(['sell', 'buy']).toContain(direction);
	prices.data.data.prices.forEach((price) => {
		switch (direction) {
			case 'buy':
				expect(price).toBeLessThan(prices.data.data.currentPrice)
				break;
			case 'sell':
				expect(price).toBeGreaterThan(prices.data.data.currentPrice)
				break;
		}
	})
	expect(prices.data.sessionInfo && typeof prices.data.sessionInfo === 'object').toBe(true)
	expect(typeof prices.data.sessionInfo.sessionToken).toBe("string")
}

const periodsTest = (periods) => {
	isEmptyArray(periods)
	periods.forEach((period) => {
		testDefaultGetRequestProperties(period)
		propertiesTest(period.data.data, PERIOD_DATA)
		expect(Array.isArray(period.data.data.periods)).toBe(true)
		expect(period.data.data.periods.length).toBeGreaterThan(0)
		const periodItem = period.data.data.periods[0]
		expect(periodItem && typeof periodItem === 'object').toBe(true)
		propertiesTest(periodItem, PERIOD_ITEM)
		expect(typeof periodItem.title).toBe("string")
		expect(typeof periodItem.timestamp).toBe("number")
	})
}

const validPeriodsTest = (validPeriods) => {
	isEmptyArray(validPeriods)
	validPeriods.forEach((period) => {
		expect(period && typeof period === 'object').toBe(true)
		propertiesTest(period, VALID_PERIOD_ITEM)
		expect(typeof period.title).toBe("string")
		expect(typeof period.timestamp).toBe("number")
		expect(typeof period.recieve).toBe("number")
		expect(typeof period.percent).toBe("number")
		expect(typeof period.apr).toBe("number")
		expect(typeof period.days).toBe("number")
		expect(typeof period.price).toBe("string")
		expect(period.error).toBe(null)
	})
}

const ordersTest = (orders) => {
	isEmptyArray(orders)
	orders.forEach((order) => {
		testDefaultGetRequestProperties(order)
		const orderItem = order.data.data
		expect(orderItem && typeof orderItem === 'object').toBe(true)
		propertiesTest(orderItem, ORDER_DATA)
		expect(typeof orderItem.volume).toBe("number")
		expect(typeof orderItem.underlying_price).toBe("number")
		expect(typeof orderItem.underlying_index).toBe("string")
		expect(typeof orderItem.quote_currency).toBe("string")
		expect(typeof orderItem.open_interest).toBe("number")
		expect(typeof orderItem.mark_price).toBe("number")
		expect(typeof orderItem.interest_rate).toBe("number")
		expect(typeof orderItem.instrument_name).toBe("string")
		expect(typeof orderItem.estimated_delivery_price).toBe("number")
		expect(typeof orderItem.creation_timestamp).toBe("number")
		expect(typeof orderItem.bid_price).toBe("number")
		expect(typeof orderItem.base_currency).toBe("string")
		expect(typeof orderItem.recieve).toBe("number")
		expect(typeof orderItem.amount).toBe("number")
		expect(typeof orderItem.price).toBe("number")
		expect(orderItem.price).toBeGreaterThan(0)
		expect(orderItem.amount).toBeGreaterThanOrEqual(1)
		expect(orderItem.recieve).toBeGreaterThanOrEqual(1)
		// ? unnecessary
		// expect(typeof orderItem.last).toBe("number")
		// expect(typeof orderItem.price_change).toBe("number")
		// expect(typeof orderItem.mid_price).toBe("number")
		// expect(typeof orderItem.low).toBe("number")
		// expect(typeof orderItem.high).toBe("number")
		// expect(typeof orderItem.ask_price).toBe("number")
	})
}

const txHashesTest = (tx_hashes) => {
	isEmptyArray(tx_hashes)
	tx_hashes.forEach((tx_hash) => {
		expect(tx_hash && typeof tx_hash === 'object').toBe(true)
		expect(tx_hash.status).toBe(true)
		expect(typeof tx_hash.message).toBe("string")
		expect(typeof tx_hash.tx).toBe("string")
		expect(typeof tx_hash.instrument_name).toBe("string")
	})
}

const postOrdersTest = (postOrders) => {
	isEmptyArray(postOrders)
	postOrders.forEach((postOrder) => {
		testDefaultGetRequestProperties(postOrder)
		expect(postOrder.data).toHaveProperty('message')
		expect(postOrder.data.message).toBe('Order was made')
	})
}

const userOrderTypesCheck = (userOrder) => {
	expect(userOrder && typeof userOrder === 'object').toBe(true)
	propertiesTest(userOrder, USER_ORDER_DATA)
	expect(typeof userOrder.id).toBe("number")
	expect(typeof userOrder.user_payment_tx_hash).toBe("string")
	expect(typeof userOrder.amount).toBe("number")
	expect(typeof userOrder.price).toBe("number")
	expect(typeof userOrder.instrument_name).toBe("string")
	expect(typeof userOrder.execute_date).toBe("string")
	expect(typeof userOrder.order).toBe("string")
	const order = JSON.parse(userOrder.order)
	expect(order && typeof order === 'object').toBe(true)
	expect(typeof userOrder.from).toBe("string")
	expect(typeof userOrder.order_id).toBe("string")
	expect(typeof userOrder.payment_complete).toBe("boolean")
	expect(typeof userOrder.order_complete).toBe("boolean")
	expect(typeof userOrder.recieve).toBe("number")
	expect(typeof userOrder.status).toBe("string")
	expect(typeof userOrder.target_index_price).toBe("number")
	expect(typeof userOrder.direction).toBe("string")
	expect(typeof userOrder.createdAt).toBe("string")
	expect(typeof userOrder.updatedAt).toBe("string")
	// if (userOrder.direction === 'buy') {
	// 	expect(typeof userOrder.perpetual).toBe("string")
	// 	const perpetual = JSON.parse(userOrder.perpetual)
	// 	expect(perpetual && typeof perpetual === 'object').toBe(true)
	// }
	if (userOrder.payment_complete && userOrder.order_complete && userOrder.status === 'approved') {
		expect(typeof userOrder.end_index_price).toBe("number")
		expect(typeof userOrder.start_index_price).toBe("number")
		expect(typeof userOrder.settlement_date).toBe("string")
		expect(typeof userOrder.eth_sold).toBe("boolean")
		expect(typeof userOrder.payout_eth).toBe("number")
		expect(typeof userOrder.payout_usdc).toBe("number")
		expect(typeof userOrder.payout_tx).toBe("string")
	}
}

const userOrderWebTypesCheck = (orderWeb) => {
	expect(orderWeb && typeof orderWeb === 'object').toBe(true)
	propertiesTest(orderWeb, USER_ORDER_DATA_ORDER)
	expect(typeof orderWeb.web).toBe("boolean")
	expect(typeof orderWeb.time_in_force).toBe("string")
	expect(typeof orderWeb.risk_reducing).toBe("boolean")
	expect(typeof orderWeb.replaced).toBe("boolean")
	expect(typeof orderWeb.reduce_only).toBe("boolean")
	expect(typeof orderWeb.profit_loss).toBe("number")
	expect(typeof orderWeb.price).toBe("number")
	expect(typeof orderWeb.post_only).toBe("boolean")
	expect(typeof orderWeb.order_type).toBe("string")
	expect(typeof orderWeb.order_state).toBe("string")
	expect(typeof orderWeb.order_id).toBe("string")
	expect(typeof orderWeb.mmp).toBe("boolean")
	expect(typeof orderWeb.max_show).toBe("number")
	expect(typeof orderWeb.last_update_timestamp).toBe("number")
	expect(typeof orderWeb.label).toBe("string")
	expect(typeof orderWeb.is_liquidation).toBe("boolean")
	expect(typeof orderWeb.instrument_name).toBe("string")
	expect(typeof orderWeb.filled_amount).toBe("number")
	expect(typeof orderWeb.direction).toBe("string")
	expect(typeof orderWeb.creation_timestamp).toBe("number")
	expect(typeof orderWeb.commission).toBe("number")
	expect(typeof orderWeb.average_price).toBe("number")
	expect(typeof orderWeb.api).toBe("boolean")
	expect(typeof orderWeb.amount).toBe("number")
}

const userOrderPerpetualTradeTypesCheck = (trade) => {
	expect(trade && typeof trade === 'object').toBe(true)
	propertiesTest(trade, USER_ORDER_DATA_PERPETUAL_RESULT_TRADE)
	expect(typeof trade.trade_seq).toBe("number")
	expect(typeof trade.trade_id).toBe("string")
	expect(typeof trade.timestamp).toBe("number")
	expect(typeof trade.tick_direction).toBe("number")
	expect(typeof trade.state).toBe("string")
	expect(typeof trade.self_trade).toBe("boolean")
	expect(typeof trade.risk_reducing).toBe("boolean")
	expect(typeof trade.reduce_only).toBe("boolean")
	expect(typeof trade.profit_loss).toBe("number")
	expect(typeof trade.price).toBe("number")
	expect(typeof trade.post_only).toBe("boolean")
	expect(typeof trade.order_type).toBe("string")
	expect(typeof trade.order_id).toBe("string")
	expect(typeof trade.mmp).toBe("boolean")
	expect(typeof trade.mark_price).toBe("number")
	expect(typeof trade.liquidity).toBe("string")
	expect(typeof trade.label).toBe("string")
	expect(typeof trade.instrument_name).toBe("string")
	expect(typeof trade.index_price).toBe("number")
	expect(typeof trade.fee_currency).toBe("string")
	expect(typeof trade.fee).toBe("number")
	expect(typeof trade.direction).toBe("string")
	expect(typeof trade.api).toBe("boolean")
	expect(typeof trade.amount).toBe("number")
	// matching_id: null,
}

const userOrderPerpetualTypesCheck = (perpetual) => {
	expect(perpetual && typeof perpetual === 'object').toBe(true)
	propertiesTest(perpetual, USER_ORDER_DATA_PERPETUAL)
	expect(typeof perpetual.jsonrpc).toBe("string")
	expect(perpetual.result && typeof perpetual.result === 'object').toBe(true)
	expect(typeof perpetual.usIn).toBe("number")
	expect(typeof perpetual.usOut).toBe("number")
	expect(typeof perpetual.usDiff).toBe("number")
	expect(typeof perpetual.testnet).toBe("boolean")

	propertiesTest(perpetual.result, USER_ORDER_DATA_PERPETUAL_RESULT)
	expect(Array.isArray(perpetual.result.trades)).toBe(true)
	expect(perpetual.result.order && typeof perpetual.result.order === 'object').toBe(true)

	if (perpetual.result.trades.length) {
		perpetual.result.trades.forEach((trade) => {
			userOrderPerpetualTradeTypesCheck(trade)
		})
	}

	userOrderWebTypesCheck(perpetual.result.order)
}

const userOrdersTest = (userOrders) => {
	testDefaultGetRequestProperties(userOrders)
	isEmptyArray(userOrders.data.data)
	userOrders.data.data.forEach((userOrder) => {
		userOrderTypesCheck(userOrder)
		const orderWeb = JSON.parse(userOrder.order)
		userOrderWebTypesCheck(orderWeb)
		// if (userOrder.direction === 'buy') {
		// 	const perpetual = JSON.parse(userOrder.perpetual)
		// 	userOrderPerpetualTypesCheck(perpetual)
		// }
	})
}

const payoutReadyTest = async (web3, userOrders) => {
	await Promise.all(userOrders.forEach(async (order) => {
		const { status } = await getTransactionReceipt(order.user_payment_tx_hash)
		// { execute_date: { [db.Op.lte]: new Date() } },
		// { order_complete: false },
		// { status: { [db.Op.notIn]: ['approved', 'denied'] } }
		

		// const orderDetails = JSON.parse(order.order)
		// get_order.params.order_id = order.order_id
		// const { data } = await axios.post(apiUrl, get_order, { headers: { 'Authorization': `Bearer ${accessToken}` } })
		// const orderFrashData = data?.result.length ? data?.result[0] : {}
		// const executed = orderFrashData.state === 'filled' || orderFrashData.order_state === 'filled' ? true : false
		// 		if (executed) {
		// 			if (order.status !== 'pending_approve') {
		// 				const indexPriceData = await axios.post(apiUrl, get_index_price)
		// 				await db.models.Order.update({ status: 'pending_approve', end_index_price: indexPriceData?.data?.result?.index_price }, { where: { order_id: order.order_id } })
		// 				const orderUpdated = await db.models.Order.findOne({ 
		// 					attributes: {exclude: ['perpetual']}, 
		// 					where: { order_id: order.order_id } })

		// 				let recieve
		// 				if (order.direction === 'sell') {
		// 					if (orderUpdated.end_index_price >= orderUpdated.target_index_price) {
		// 						recieve = `${parseFloat(orderUpdated.recieve) + parseFloat(orderUpdated.price)} USDC`
		// 					} else {
		// 						const BN = web3.utils.BN
		// 						const valueWei = await web3.utils.toWei(String(parseFloat(orderUpdated.amount) + (parseFloat(orderUpdated.recieve) / parseFloat(orderUpdated.end_index_price))), 'ether')
		// 						recieve = `${Number(web3.utils.fromWei(new BN(valueWei)))} ETH`
		// 					}
		// 				} else {
		// 					if (orderUpdated.end_index_price <= orderUpdated.target_index_price) {
		// 						recieve = `${smartRound(parseFloat(orderUpdated.recieve) / parseFloat(orderUpdated.end_index_price)) + orderUpdated.amount} ETH`
		// 					} else {
		// 						recieve = `${parseFloat(orderUpdated.price) * parseFloat(orderUpdated.amount) + parseFloat(orderUpdated.recieve)} USDC`
		// 					}
		// 				}
						

		// 				telegram.sendApprove(`Confirm the payment which you're about to make.\n${orderUpdated.from} will recieve ${recieve}\n\n${JSON.stringify(orderUpdated)}`, orderUpdated)
		// 				return
		// 			}
		// 		}
	}))
}

module.exports = { pricesTest, periodsTest, validPeriodsTest, ordersTest, txHashesTest, postOrdersTest, userOrdersTest, payoutReadyTest }