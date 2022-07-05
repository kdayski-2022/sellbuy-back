const axios = require('axios')
const dotenv = require('dotenv');
const { getCurrentDay, getLastDayOfWeek } = require('../lib/dates')
dotenv.config();
const apiUrl = process.env.API_URL;

class DateContoller {
	async getDates(req, res) {
      axios
        .get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`)
        .then((apiRes) => {
          const fillteredDate = apiRes.data.result.filter((item) => {
            const [_, stortedDataUnderlying_index] =
              item.underlying_index.split('-');
            const date = new Date(Date.parse(stortedDataUnderlying_index));
            return date >= getCurrentDay() && date <= getLastDayOfWeek();
          });
          res.json(fillteredDate);
        })
        .catch((err) => console.log(err));
	}
}

module.exports = new DateContoller()