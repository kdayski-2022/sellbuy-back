const { getFutureTimestamp, getDaysDifference, getValidDays, getTimestamp } = require('../lib/dates')
const { TOMORROW, WEEK, TWO_WEEK, MONTH } = require('../config/constants.json');
const axios = require('axios')
const dotenv = require('dotenv');
const { writeLog, updateLog } = require('../lib/logger');
dotenv.config();
const apiUrl = process.env.API_URL;

class PeriodContoller {
	async getPeriods(req, res) {
		const logId = await writeLog({ action: 'getPeriods', status: 'in progress', req })
		try {
			const periods = [
				{
				  title: '1 day',
				  timestamp: getFutureTimestamp(TOMORROW),
				},
				{ title: `${getDaysDifference(getFutureTimestamp(WEEK))} days`, timestamp: getFutureTimestamp(WEEK) },
				{
				  title: `${getDaysDifference(getFutureTimestamp(TWO_WEEK))} days`,
				  timestamp: getFutureTimestamp(TWO_WEEK),
				},
				{ title: `${getDaysDifference(getFutureTimestamp(MONTH))} days`, timestamp: getFutureTimestamp(MONTH) },
			  ];
			  updateLog(logId, { status: 'success' })
			  res.json({ success: true, data: { periods } });
		} catch(e) {
			updateLog(logId, { status: 'failed', error: JSON.stringify(e) })
			res.json({ success: false, data: null });
		}
	}

	async getPricePeriods(req, res) {
		const logId = await writeLog({ action: 'getPricePeriods', status: 'in progress', req })
		axios
		.get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
		.then((apiRes) => {
		  try {
			const { price, amount } = req.query;
			const periods = [
				{
					title: '1 day',
					timestamp: getFutureTimestamp(TOMORROW),
				},
				{ title: `${getDaysDifference(getFutureTimestamp(WEEK))} days`, timestamp: getFutureTimestamp(WEEK) },
				{
					title: `${getDaysDifference(getFutureTimestamp(TWO_WEEK))} days`,
					timestamp: getFutureTimestamp(TWO_WEEK),
				},
				{ title: `${getDaysDifference(getFutureTimestamp(MONTH))} days`, timestamp: getFutureTimestamp(MONTH) },
			];
			const result = []

			periods.forEach(({title, timestamp}) => {
				if (title === '1 days') return
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
					const daysDifference = getDaysDifference(timestamp)
					const validDays = getValidDays(daysDifference, targetPeriod)
					const choosenDay = new Date(Number(timestamp)).getDate()
					const choosenMonth = new Date(Number(timestamp)).getMonth()
					const targetMonth = new Date(getTimestamp(targetPeriod)).getMonth()
					if (validDays.includes(choosenDay) && choosenMonth === targetMonth) return item
				});

				// ! ONLY FOR DEV
				// const bidPriceAvailable = fillteredDates.map(
				// 	(item) => item.bid_price ? item : {...item, bid_price: Math.random() / 10}
				//   );

				const bidPriceAvailable = fillteredDates.filter(
				  (item) => item.bid_price
				);
				
				if (!bidPriceAvailable.length) return result.push({ title, timestamp, recieve: null, percent: null, error: "Order wasn't found" })
		
				const maxBidPriceObj = bidPriceAvailable
				  .sort((a, b) =>
					a.bid_price > b.bid_price ? 1 : b.bid_price > a.bid_price ? -1 : 0
				  )
				  .reverse()[0];
				const { estimated_delivery_price, bid_price } = maxBidPriceObj;
				const recieve = estimated_delivery_price * bid_price * amount * 0.7;
				const recieveForEach = estimated_delivery_price * bid_price * 1 * 0.7;
				const percentForEach = recieveForEach / price * 100
				const percent = recieve / price * 100
				const days = getDaysDifference(timestamp)
				const apr = Math.round(parseFloat(percentForEach / days * 365) * 100) / 100
				result.push( { title, timestamp, recieve, percent, apr, days, error: null })
			})
			
			updateLog(logId, { status: 'success' })
			res.json({ success: true, data: { periods: result } });
		  } catch (e) {
			console.log(e)
			updateLog(logId, { status: 'failed', error: JSON.stringify(e) })
			res.json({ success: false, data: { periods: [] }, error: e.message });
		  }
		});
	}
}

module.exports = new PeriodContoller()