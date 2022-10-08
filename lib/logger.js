const db = require('../database')

const writeLog = async (fields) => {
	try {
		const { req } = fields
		const userAgent = req.headers['user-agent']
		const requestParams = JSON.stringify({ ...req.query, ...req.params, ...req.body })
		const { id } = await db.models.Log.create({ ...fields, userAgent, requestParams })
		return id
	} catch(e) {
		throw new Error(e)
	}
}

const updateLog = async (id, fields) => {
	try {
		await db.models.Log.update({ ...fields }, { where: { id } })
	} catch(e) {
		throw new Error(e)
	}
}

module.exports = { writeLog, updateLog }