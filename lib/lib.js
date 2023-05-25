const isEmpty = require('is-empty');

const smartRound = (target, decimals = 2) => {
  if (!target) return 0;
  const rounded = String(
    parseFloat(target).toFixed(
      Math.max(-Math.log10(target) + decimals, decimals)
    )
  );
  if (rounded.length > 2 + decimals)
    return parseFloat(rounded.substring(0, rounded.length - 1));
  return parseFloat(rounded);
};

const convertUSDCToETH = (amount, rate) => {
  if (parseFloat(amount) && parseFloat(rate))
    return parseFloat(amount) / parseFloat(rate);
  return 0;
};

const isSystemError = (e) => {
  return isEmpty(JSON.parse(JSON.stringify(e)));
};

const parseError = (e) => {
  if (isSystemError(e) || e.message) return JSON.stringify(e.message);
  return JSON.stringify(e);
};

const getDaysDifference = (date1, date2 = new Date()) => {
  const diffTime = Math.abs(date2 - date1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

module.exports = {
  smartRound,
  convertUSDCToETH,
  parseError,
  getDaysDifference,
};
