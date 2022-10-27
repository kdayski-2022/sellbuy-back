const axios = require('axios')
const dotenv = require('dotenv');
const { getCurrentDay, getLastDayOfWeek } = require('../lib/dates');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
dotenv.config();
const apiUrl = process.env.API_URL;

class DateContoller {
	async getDates(req, res) {
    const sessionInfo = await checkSession(req)
    const logId = await writeLog({ action: 'getDates', status: 'in progress', sessionInfo, req })
      axios
        .get(`${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`)
        .then((apiRes) => {
          const fillteredDate = apiRes.data.result.filter((item) => {
            const [_, stortedDataUnderlying_index] =
              item.underlying_index.split('-');
            const date = new Date(Date.parse(stortedDataUnderlying_index));
            return date >= getCurrentDay() && date <= getLastDayOfWeek();
          });
          updateLog(logId, { status: 'success' })
          res.json(fillteredDate);
        })
        .catch((err) => {
          console.log(err)
          updateLog(logId, { status: 'failed', error: JSON.stringify(err) })
          res.json({ success: false, data: null, error: e.message, sessionInfo })
        });
	}
}

module.exports = new DateContoller()