const { default: axios } = require('axios')
const { 
	pricesTest, 
	periodsTest, 
	validPeriodsTest, 
	ordersTest, 
	// txHashesTest 
	postOrdersTest,
	userOrdersTest,
	payoutReadyTest
} = require('./lib')
// const { sendETH, sendUSDC } = require('./transfer');

const direction = 'buy'
const address = "0x05528440b9e0323d7ccb9baf88b411ce481694a0"
const hashForTest = "0xb865c49e93b51ac37b43b54cba4443d3661bff8304decdaf5ea69a8dbbbab0c3"
const amount = 2
const headers = {
	'Direction-Type': 'buy',
	'Session-Token': '4ff90acd0460c2683c445ee2789d472c56322a6aee7672ec562a67c114a2f411',
	'User-Address': '0x05528440b9e0323d7ccb9baf88b411ce481694a0'
}

jest.setTimeout(600000)

let prices, periods, validPeriods, orders, postOrders, tx_hashes, userOrders


describe('API', () => {
	describe("GET /api/prices", () => {
		beforeAll(
			() => {
				return new Promise(async resolve => {
					// Get all prices
					prices = await axios.get(`http://dev.fanil.ru:5211/api/prices/${direction}`, { headers })
					resolve()
				})
			})

		test("Is valid prices", () => {
			pricesTest(prices, direction);
		})
	})

	describe("GET /api/periods_price", () => {
		beforeAll(
			() => {
				return new Promise(async resolve => {
					// Get all periods
					periods = await Promise.all(prices.data.data.prices.map(async (price) => await axios.get(`http://dev.fanil.ru:5211/api/periods_price?amount=${amount}&price=${price}`, { headers })))

					// Filter all periods by price
					const totalPeriods = []
					const allPeriods = periods.map((period) => period.data.data.periods)
					allPeriods.forEach((periods) => {
						periods.forEach((period) => totalPeriods.push(period))
					})
					validPeriods = totalPeriods.filter((period) => period.price && period.amount && period.timestamp)
					resolve()
				})
			})

		test("Is valid periods", () => {
			periodsTest(periods);
		})
		test("Is there any valid period to order", () => {
			validPeriodsTest(validPeriods);
		})
	})

	describe("GET /api/order", () => {
		beforeAll(
			() => {
				return new Promise(async resolve => {
					// Get all orders
					orders = await Promise.all(validPeriods.map(async (period) => 
						await axios.get(`http://dev.fanil.ru:5211/api/order?price=${period.price}&period=${period.timestamp}&amount=${period.amount}`, { headers })
					))
					orders = orders.filter((order) => order.data.data.recieve >= 1)
					resolve()
				})
			})

		test("Is valid orders", () => {
			ordersTest(orders);
		})
	})

	describe("POST /api/order", () => {
		beforeAll(
			() => {
				return new Promise(async resolve => {
					// Post all orders

					// TODO блокчейн не может несколько транз в ряд обработать (ругается на газ)
					// tx_hashes = await Promise.all(orders.map(async (order, i) => {
					// 	let tx_hash
					// 	if (direction === 'sell') tx_hash = await sendETH(order.data.data.amount, i + 1)
					// 	if (direction === 'buy') tx_hash = await sendUSDC(order.data.data.amount * order.data.data.price, i + 1)
					// 	return { ...tx_hash, instrument_name: order.data.data.instrument_name }
					// }))
					
					// TODO апи деребита почему-то решает инструмент нейм не менять, хотя ей приходят разные (мб просто не успевает понять) - попробовать сделать задержку
					postOrders = await Promise.all(orders.map(async (order) => {
						const orderData = order.data.data
						const { amount, price, period } = orderData
						const data = {
							hash: hashForTest,
							amount,
							price,
							period,
							orderData,
							address,
							direction
						}
						return await axios.post('http://dev.fanil.ru:5211/api/order', data, { headers })
					}))
					resolve()
				})
			})

		// test("Is valid tx_hash", () => {
		// 	txHashesTest(tx_hashes)
		// })

		test("Is valid post order", () => {
			postOrdersTest(postOrders)
		})
	})
})

describe('AUTO PAYMENT', () => {
	describe("GET /api/user_orders", () => {
		beforeAll(
			() => {
				return new Promise(async resolve => {
					// Get all user orders
					userOrders = await axios.get(`http://dev.fanil.ru:5211/api/user_orders?userAddress=${address}`, { headers })
					resolve()
				})
			})

		test("Is valid user orders", () => {
			userOrdersTest(userOrders);
		})

		// test("Is there any user order that ready for payment", async () => {
		// 	await payoutReadyTest(userOrders.data.data);
		// })
	})
})