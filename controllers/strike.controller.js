const axios = require('axios')
const dotenv = require('dotenv');
const { updateLog, writeLog } = require('../lib/logger');
dotenv.config();
const apiUrl = process.env.API_URL;

class StrikeContoller {
	async getStrikes(req, res) {
		const logId = await writeLog({ action: 'getStrikes', status: 'in progress', req })
		try {
			let strikes = [];
			axios
				.get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
				.then((apiRes) => {});
			
			// for (data of jsonData) {
			// 	const strike = Number(data.instrument_name.split('-')[2]);
			// 	strikes.push({ strike, data });
			// }
			for (data of strikes) {
			}
			updateLog(logId, { status: 'success' })
			res.json({ success: true, data: {  } })
			//TODO Вытащить все старйки интересующих нас цен
		} catch(e) {
			updateLog(logId, { status: 'failed', error: JSON.stringify(e) })
			res.json({ success: false, data: null })
		}
	}
}

module.exports = new StrikeContoller()