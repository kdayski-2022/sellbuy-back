const isEmpty = require('is-empty');

const smartRound = (target, decimals = 2) => {
  if (!target || target === '0') return 0;
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

const convertFloatToBnString = (float, decimals) => {
  let result;
  let [left, right] = String(float).split('.');
  result = left;
  if (right) {
    right = right.padEnd(decimals, '0');
    result = left.concat(right);
  } else {
    result = result + '0'.repeat(decimals);
  }
  return result;
};

const removeLeadingZeros = (string) => {
  return string.toString().replace(/^0+/, '');
};

const isIterable = (obj) => {
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === 'function';
};

module.exports = {
  smartRound,
  convertUSDCToETH,
  parseError,
  convertFloatToBnString,
  isIterable,
  removeLeadingZeros,
};
