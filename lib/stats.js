const isEmpty = require('is-empty');
const { COMMISSION } = require('../config/constants.json');
const { getDaysDifference } = require('./dates');

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const formatToChartData = (orders) => {
  try {
    const data = {};
    orders.forEach(({ execute_date, recieve }) => {
      const ex = new Date(execute_date);
      data[ex.getFullYear()] = data[ex.getFullYear()]
        ? [...data[ex.getFullYear()], { month: ex.getMonth(), recieve }]
        : [{ month: ex.getMonth(), recieve }];
    });

    let sumByMonth = {};
    for (let year in data) {
      sumByMonth[year] = data[year].reduce((result, item) => {
        if (!result[item.month]) {
          result[item.month] = 0;
        }
        result[item.month] += item.recieve;
        return result;
      }, {});
    }

    let recieve = [];
    if (!isEmpty(sumByMonth)) {
      Object.keys(sumByMonth).forEach((year) => {
        if (isEmpty(sumByMonth[year])) return [];
        return Object.keys(sumByMonth[year]).forEach((month) =>
          recieve.push({
            year: Number(year),
            month: Number(month),
            count: sumByMonth[year][month],
            monthLong: monthNames[month],
          })
        );
      });
    }

    const income = getIncome(recieve);

    return { income, recieve };
  } catch (e) {
    throw new Error(e);
  }
};

const formatToOrdersCountChartData = (orders) => {
  try {
    const aggregateDataByYearAndMonth = (data, { execute_date }) => {
      const ex = new Date(execute_date);
      const year = ex.getFullYear();
      const month = ex.getMonth();

      if (!data[year]) {
        data[year] = {};
      }
      if (!data[year][month]) {
        data[year][month] = 0;
      }

      data[year][month] += 1;

      return data;
    };

    const aggregatedData = orders.reduce(aggregateDataByYearAndMonth, {});

    const convertAggregatedDataToOrderCountArray = (result, year) => {
      const yearData = aggregatedData[year];

      for (const month in yearData) {
        result.push({
          year: Number(year),
          month: Number(month),
          count: yearData[month],
          monthLong: monthNames[month],
        });
      }

      return result;
    };

    const ordersCount = Object.keys(aggregatedData).reduce(
      convertAggregatedDataToOrderCountArray,
      []
    );

    return { orders: ordersCount };
  } catch (e) {
    throw new Error(e);
  }
};

const formatToUniqueAddressesChartData = (orders) => {
  try {
    const aggregateDataByYearAndMonth = (data, { execute_date, from }) => {
      const ex = new Date(execute_date);
      const year = ex.getFullYear();
      const month = ex.getMonth();

      if (!data[year]) {
        data[year] = {};
      }
      if (!data[year][month]) {
        data[year][month] = new Set();
      }

      data[year][month].add(from);

      return data;
    };

    const aggregatedData = orders.reduce(aggregateDataByYearAndMonth, {});

    const convertAggregatedDataToOrderCountArray = (result, year) => {
      const yearData = aggregatedData[year];

      for (const month in yearData) {
        result.push({
          year: Number(year),
          month: Number(month),
          count: yearData[month].size,
          monthLong: monthNames[month],
        });
      }

      return result;
    };

    const uniqueAddresses = Object.keys(aggregatedData).reduce(
      convertAggregatedDataToOrderCountArray,
      []
    );

    return { addresses: uniqueAddresses };
  } catch (e) {
    throw new Error(e);
  }
};

const getIncome = (recieve) => {
  try {
    if (isEmpty(recieve)) return [];
    return recieve.map((item) => ({
      ...item,
      count: (item.count / (1 - COMMISSION)) * COMMISSION,
    }));
  } catch (e) {
    throw new Error(e);
  }
};

const formatToWebStatistics = (orders) => {
  const totalTradedVolume = orders
    .map(({ payout_usdc, status, order_complete }) =>
      payout_usdc && status === 'approved' && order_complete ? payout_usdc : 0
    )
    .reduce((a, b) => a + b, 0);

  const totalPremiumGenerated = orders
    .map(({ recieve, status, order_complete }) =>
      recieve && status === 'approved' && order_complete
        ? recieve + (recieve / (1 - COMMISSION)) * COMMISSION
        : 0
    )
    .reduce((a, b) => a + b, 0);

  const totalValueLocked = orders
    .map((order) => getValueLocked(order))
    .reduce((a, b) => a + b, 0);

  const users = orders
    .map(({ from }) => from)
    .filter((value, index, array) => array.indexOf(value) === index).length;

  const APYs = orders.map(
    ({ execute_date, recieve, price, createdAt, amount }) => {
      const days = getDaysDifference(
        new Date(execute_date),
        new Date(createdAt)
      );
      const percentForEach = ((recieve / price) * 100) / amount;
      const apr =
        Math.round(parseFloat((percentForEach / days) * 365) * 100) / 100;
      return apr;
    }
  );
  const averageAPY = APYs.reduce((a, b) => a + b, 0) / APYs.length;

  const totalTradedVolume_formatted =
    totalTradedVolume > 999
      ? `$${Math.round((totalTradedVolume / 1000) * 10) / 10}K`
      : `$${Math.round(totalTradedVolume * 100) / 100}`;

  const totalValueLocked_formatted =
    totalValueLocked > 999
      ? `$${Math.round((totalValueLocked / 1000) * 10) / 10}K`
      : `$${Math.round(totalValueLocked * 100) / 100}`;

  const users_formatted =
    users > 999 ? `${Math.round((users / 1000) * 10) / 10}K` : `${users}`;

  const totalPremiumGenerated_formatted =
    totalPremiumGenerated > 999
      ? `$${Math.round((totalPremiumGenerated / 1000) * 10) / 10}K`
      : `$${Math.round(totalPremiumGenerated * 100) / 100}`;

  const averageAPY_formatted = `${Math.round(averageAPY * 100) / 100}%`;
  return {
    totalTradedVolume,
    totalPremiumGenerated,
    totalValueLocked,
    users,
    averageAPY,
    formatted: {
      totalTradedVolume: totalTradedVolume_formatted,
      totalPremiumGenerated: totalPremiumGenerated_formatted,
      totalValueLocked: totalValueLocked_formatted,
      users: users_formatted,
      averageAPY: averageAPY_formatted,
    },
  };
};

const getLtv = (order) => {
  const { recieve, status } = order;
  if (status !== 'approved') return 0;
  return (recieve / (1 - COMMISSION)) * COMMISSION;
};

const getValueLocked = (order) => {
  const { start_index_price, direction, status, amount, price } = order;
  if (status !== 'created' && status !== 'pending_approve') return 0;
  if (direction === 'sell') return amount * start_index_price;
  return amount * price;
};

const formatToAdminStatistics = (orders) => {
  const totalTradedVolume = orders
    .map(({ payout_usdc, status, order_complete }) =>
      payout_usdc && status === 'approved' && order_complete ? payout_usdc : 0
    )
    .reduce((a, b) => a + b, 0);

  const totalPremiumPayout = orders
    .map(({ recieve, status, order_complete }) =>
      recieve && status === 'approved' && order_complete ? recieve : 0
    )
    .reduce((a, b) => a + b, 0);

  const totalPremiumPayoutWithoutCommission = orders
    .map(({ recieve, status, order_complete }) =>
      recieve && status === 'approved' && order_complete
        ? recieve / (1 - COMMISSION)
        : 0
    )
    .reduce((a, b) => a + b, 0);

  const totalValueLocked = orders
    .map((order) => getValueLocked(order))
    .reduce((a, b) => a + b, 0);

  const allUsers = orders.map(({ from }) => from);
  const uniqueUsers = allUsers.filter(
    (value, index, array) => array.indexOf(value) === index
  );
  const loyalUsers = findDuplicates(allUsers).length;
  const usersOrders = uniqueUsers.map((address) => {
    return {
      address,
      count: orders.filter(({ from }) => from === address).length,
      ltv: orders
        .filter(({ from }) => from === address)
        .map((order) => getLtv(order))
        .reduce((a, b) => a + b, 0),
    };
  });
  const totalAverageLtv =
    usersOrders.reduce((a, b) => a + b.ltv, 0) / usersOrders.length;

  return {
    uniqueUsers: uniqueUsers.length,
    loyalUsers,
    usersOrders,
    totalTradedVolume: Math.round(totalTradedVolume),
    totalPremiumPayout: Math.round(totalPremiumPayout),
    totalPremiumPayoutWithoutCommission: Math.round(
      totalPremiumPayoutWithoutCommission
    ),
    totalValueLocked: Math.round(totalValueLocked),
    totalAverageLtv: Math.round(totalAverageLtv),
  };
};

const findDuplicates = (arr) => {
  const uniq = arr
    .map((name) => {
      return {
        count: 1,
        name: name,
      };
    })
    .reduce((result, b) => {
      result[b.name] = (result[b.name] || 0) + b.count;

      return result;
    }, {});
  const duplicates = Object.keys(uniq).filter((a) => uniq[a] > 1);
  return duplicates;
};

module.exports = {
  formatToChartData,
  formatToWebStatistics,
  formatToAdminStatistics,
  formatToOrdersCountChartData,
  formatToUniqueAddressesChartData,
};
