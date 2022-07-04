const axios = require('axios')
const dotenv = require('dotenv');
const { getFutureTimestamp } = require('../lib/dates')
const { TOMORROW, WEEK, TWO_WEEK, MONTH } = require('../config/constants.json')
dotenv.config();
const apiUrl = process.env.API_URL;

class PeriodContoller {
	async getPeriods(req, res) {
			const periods = [
			  {
				title: 'Tomorow',
				key: 'tomorow',
				timestamp: getFutureTimestamp(TOMORROW),
			  },
			  { title: 'One Week', key: '1week', timestamp: getFutureTimestamp(WEEK) },
			  {
				title: 'Two Week',
				key: '2week',
				timestamp: getFutureTimestamp(TWO_WEEK),
			  },
			  { title: 'One Month', key: '1month', timestamp: getFutureTimestamp(MONTH) },
			];
			res.json({ success: true, data: { periods } });
	}
}

module.exports = new PeriodContoller()