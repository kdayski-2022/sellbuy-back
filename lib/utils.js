const getApr = (
  estimated_delivery_price,
  bid_price,
  price,
  commission,
  days_difference
) => {
  const recieveForEach = estimated_delivery_price * bid_price * 1 * commission;
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
