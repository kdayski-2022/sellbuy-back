const getApr = (
  recieve,
  price,
  amount,
  days_difference
) => {
  const recieveForEach = recieve / amount
  const percentForEach = (recieveForEach / price) * 100;
  const apr =
    Math.round(
      parseFloat((percentForEach / (days_difference + 1)) * 365) * 100
    ) / 100;
  return apr;
};

module.exports = {
  getApr,
};
