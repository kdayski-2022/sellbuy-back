const axios = require('axios')
const dotenv = require('dotenv');
const { auth_data } = require('../config/requestData.json')
const db = require('../database')
dotenv.config();
const apiUrl = process.env.API_URL;


const  getAccessToken = async () => {
	try {
		let authData = await db.models.Auth.findAll()
		if (authData.length) {
			const { auth_roken, updatedAt, expire_in } = authData[0]
			if (Date.now() > new Date(updatedAt).getTime() + (expire_in ? expire_in : 0)) {
				const { data: { result: { expires_in, access_token, refresh_token, token_type } } } = await axios.post(apiUrl, auth_data)
				
				await db.models.Auth.update({ expire_in: expires_in, auth_roken: access_token, refresh_token}, { where: { id: 1 } })
				const authData = await db.models.Auth.findAll()
				return authData[0].auth_roken
			}
			return auth_roken
		}
		const { data: { result: { expires_in, access_token, refresh_token, token_type } } } = await axios.post(apiUrl, auth_data)
		await db.models.Auth.create({ expire_in: expires_in, auth_roken: access_token, refresh_token})
		authData = await db.models.Auth.findAll()
		return authData[0].auth_roken
	} catch(e) {
		return e
	}
}

module.exports = { getAccessToken }