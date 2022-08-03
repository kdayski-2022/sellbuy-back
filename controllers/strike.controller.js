const axios = require('axios')
const dotenv = require('dotenv');
dotenv.config();
const apiUrl = process.env.API_URL;

class StrikeContoller {
	async getStrikes(req, res) {
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
		res.json({ success: true, data: {  } })
		//TODO Вытащить все старйки интересующих нас цен
	}
}

module.exports = new StrikeContoller()