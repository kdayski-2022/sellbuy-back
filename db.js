const Pool = require('pg').Pool

const pool = new Pool({
	user: 'sellbuy',
	password: 'sellbuy',
	host: 'localhost',
	port: 5438,
	database: 'sellbuy'
})

module.exports = pool