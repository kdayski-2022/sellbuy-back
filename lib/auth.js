const axios = require('axios')
const dotenv = require('dotenv');
const { auth_data } = require('../config/requestData.json')
const db = require('../database')
dotenv.config();
const apiUrl = process.env.API_URL;
const client_id = process.env.DEREBIT_CLIENT_ID
const client_secret = process.env.DEREBIT_CLIENT_SECRET


const getAccessToken = async () => {
	try {
		let authData = await db.models.Auth.findAll({ where: { api_url: apiUrl } })
		auth_data.params.client_id = client_id
		auth_data.params.client_secret = client_secret
		if (authData.length) {
			const { auth_roken, updatedAt, expire_in } = authData[0]
			if (Date.now() > new Date(updatedAt).getTime() + (expire_in ? expire_in * 1000 : 0)) {
				const { data: { result: { expires_in, access_token, refresh_token, token_type } } } = await axios.post(apiUrl, auth_data)
				await db.models.Auth.update({ expire_in: expires_in, auth_roken: access_token, refresh_token}, { where: { api_url: apiUrl } })
				const authData = await db.models.Auth.findAll({ where: { api_url: apiUrl } })
				return authData[0].auth_roken
			}
			return auth_roken
		}
		const { data: { result: { expires_in, access_token, refresh_token, token_type } } } = await axios.post(apiUrl, auth_data)
		await db.models.Auth.create({ expire_in: expires_in, auth_roken: access_token, refresh_token, api_url: apiUrl})
		authData = await db.models.Auth.findAll({ where: { api_url: apiUrl } })
		return authData[0].auth_roken
	} catch(e) {
		throw e
	}
}

module.exports = { getAccessToken }