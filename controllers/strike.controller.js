const axios = require('axios')
const dotenv = require('dotenv');
const { parseError } = require('../lib/lib');
const { updateLog, writeLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
dotenv.config();
const apiUrl = process.env.API_URL;
class StrikeContoller {
	async getStrikes(req, res) {
		const sessionInfo = await checkSession(req)
		const logId = await writeLog({ action: 'getStrikes', status: 'in progress', sessionInfo, req })
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
			res.json({ success: true, data: {  }, sessionInfo })
			//TODO Вытащить все старйки интересующих нас цен
		} catch(e) {
			updateLog(logId, { status: 'failed', error: parseError(e) })
			res.json({ success: false, data: null, sessionInfo })
		}
	}
}

module.exports = new StrikeContoller()