const isEmpty = require("is-empty")

const smartRound = (target) => {
	if (!target) return 0
	const rounded = String(target.toFixed(Math.max(-Math.log10(target) + 2, 2)))
	if (rounded.length > 4) return parseFloat(rounded.substring(0, rounded.length - 1))
	return parseFloat(rounded)
}

const convertUSDCToETH = (amount, rate) => {
	if (parseFloat(amount) && parseFloat(rate)) return parseFloat(amount) / parseFloat(rate)
	return 0
}

const isSystemError = (e) => {
	return isEmpty(JSON.parse(JSON.stringify(e)))
}

const parseError = (e) => {
	if (isSystemError(e) || e.message) return JSON.stringify(e.message)
	return JSON.stringify(e)
}

module.exports = { smartRound, convertUSDCToETH, parseError }