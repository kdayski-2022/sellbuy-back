const smartRound = (target) => {
	if (!target) return 0
	const rounded = String(target.toFixed(Math.max(-Math.log10(target) + 2, 2)))
	if (rounded.length > 4) return parseFloat(rounded.substring(0, rounded.length - 1))
	return parseFloat(rounded)
  }

module.exports = { smartRound }