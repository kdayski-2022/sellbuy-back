const db = require('../database')

class TransactionContoller {
	async createTransaction(req, res) {
		const { amount, hash } = req.body
		const newTransaction = await db.query('INSERT INTO transaction (hash) values ($1) RETURNING *', [hash])
		res.json(newTransaction.rows[0])
	}

	async getTransactions(req, res) {
		const transactions = await db.query('SELECT * FROM transaction')
		res.json(transactions.rows)
	}

	async getTransaction(req, res) {
		const {hash} = req.params
		const transaction = await db.query('SELECT * FROM transaction where hash = $1', [hash])
		res.json(transaction.rows[0])
	}

	async deleteTransaction(req, res) {
		const {hash} = req.params
		const transaction = await db.query('DELETE FROM transaction where hash = $1', [hash])
		res.json(transaction.rows[0])
	}

	async deleteAllTransaction(req, res) {
		const transactions = await db.query('DELETE FROM transaction')
		res.json(transactions.rows)
	}
}

module.exports = new TransactionContoller()