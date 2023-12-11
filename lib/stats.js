const db = require('../database');
const isEmpty = require('is-empty');
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

    const data2 = {};
    orders.forEach(({ execute_date, recieve, commission }) => {
      const ex = new Date(execute_date);
      data2[ex.getFullYear()] = data2[ex.getFullYear()]
        ? [
            ...data2[ex.getFullYear()],
            {
              month: ex.getMonth(),
              recieve: (recieve / commission) * (1 - commission),
            },
          ]
        : [
            {
              month: ex.getMonth(),
              recieve: (recieve / commission) * (1 - commission),
            },
          ];
    });

    let sumByMonth2 = {};
    for (let year in data2) {
      sumByMonth2[year] = data2[year].reduce((result, item) => {
        if (!result[item.month]) {
          result[item.month] = 0;
        }
        result[item.month] += item.recieve;
        return result;
      }, {});
    }

    let income = [];
    if (!isEmpty(sumByMonth2)) {
      Object.keys(sumByMonth2).forEach((year) => {
        if (isEmpty(sumByMonth2[year])) return [];
        return Object.keys(sumByMonth2[year]).forEach((month) =>
          income.push({
            year: Number(year),
            month: Number(month),
            count: sumByMonth2[year][month],
            monthLong: monthNames[month],
          })
        );
      });
    }

    return { income, recieve };
  } catch (e) {
    throw new Error(e);
  }
};

const formatActivityToChartData = (activities) => {
  try {
    const aggregateDataByYearAndMonth = (data, { createdAt }) => {
      const ex = new Date(createdAt);
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

    const aggregatedData = activities.reduce(aggregateDataByYearAndMonth, {});

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

    const activitiesCount = Object.keys(aggregatedData).reduce(
      convertAggregatedDataToOrderCountArray,
      []
    );

    return { activities: activitiesCount };
  } catch (e) {
    throw e;
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

const formatToWebStatistics = (orders) => {
  const totalTradedVolume = orders
    .map(({ payout_usdc, status, order_complete }) =>
      payout_usdc && status === 'approved' && order_complete ? payout_usdc : 0
    )
    .reduce((a, b) => a + b, 0);

  const totalPremiumGenerated = orders
    .map(({ recieve, status, order_complete, commission }) =>
      recieve && status === 'approved' && order_complete
        ? recieve + (recieve / commission) * (1 - commission)
        : 0
    )
    .reduce((a, b) => a + b, 0);

  const totalValueLocked = orders
    .map((order) => getValueLocked(order))
    .reduce((a, b) => a + b, 0);

  const users = orders
    .map(({ from }) => from)
    .filter((value, index, array) => array.indexOf(value) === index).length;

  const totalOrders = orders.length;

  let APYs = orders.map(
    ({ execute_date, recieve, price, createdAt, amount }) => {
      const days = getDaysDifference(
        new Date(execute_date),
        new Date(createdAt)
      );
      const percentForEach = ((recieve / price) * 100) / amount;
      if (!days) return 0;
      const apr =
        Math.round(parseFloat((percentForEach / days) * 365) * 100) / 100;
      return apr;
    }
  );
  APYs = APYs.filter((apy) => apy);
  const averageAPY = APYs.reduce((a, b) => a + b, 0) / APYs.length;

  let totalTradedVolume_formatted =
    totalTradedVolume > 999
      ? `$${Math.round((totalTradedVolume / 1000) * 10) / 10}K`
      : `$${Math.round(totalTradedVolume * 100) / 100}`;
  totalTradedVolume_formatted =
    totalTradedVolume > 999999
      ? `$${Math.round((totalTradedVolume / 1000000) * 10) / 10}M`
      : totalTradedVolume_formatted;

  const totalValueLocked_formatted =
    totalValueLocked > 999
      ? `$${Math.round((totalValueLocked / 1000) * 10) / 10}K`
      : `$${Math.round(totalValueLocked * 100) / 100}`;

  const users_formatted =
    users > 999 ? `${Math.round((users / 1000) * 10) / 10}K` : `${users}`;

  const totalOrders_formatted =
    totalOrders > 999
      ? `${Math.round((totalOrders / 1000) * 10) / 10}K`
      : `${totalOrders}`;

  const totalPremiumGenerated_formatted =
    totalPremiumGenerated > 999
      ? `$${Math.round((totalPremiumGenerated / 1000) * 10) / 10}K`
      : `$${Math.round(totalPremiumGenerated * 100) / 100}`;

  const averageAPY_formatted = `${Math.round(averageAPY * 100) / 100}%`;
  return {
    totalTradedVolume,
    totalPremiumGenerated,
    totalValueLocked,
    totalOrders,
    users,
    averageAPY,
    formatted: {
      totalTradedVolume: totalTradedVolume_formatted,
      totalPremiumGenerated: totalPremiumGenerated_formatted,
      totalValueLocked: totalValueLocked_formatted,
      totalOrders: totalOrders_formatted,
      users: users_formatted,
      averageAPY: averageAPY_formatted,
    },
  };
};

const getLtv = (order) => {
  const { recieve, status, commission } = order;
  if (status !== 'approved') return 0;
  return (recieve / commission) * (1 - commission);
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
    .map(({ recieve, status, order_complete, commission }) =>
      recieve && status === 'approved' && order_complete
        ? recieve / commission
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

const getLogsByAction = async (action) => {
  try {
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    return await db.models.Log.findAll({
      where: {
        action,
        createdAt: {
          [db.Op.between]: [startOfMonth, endOfMonth],
        },
      },
    });
  } catch (e) {
    throw e;
  }
};

const updateActivities = async (activities) => {
  for (const item of activities) {
    try {
      const activity = await db.models.Activity.findOne({
        where: {
          month: item.month,
          year: item.year,
        },
      });
      if (activity) {
        await db.models.Activity.update(
          { count: item.count },
          {
            where: {
              month: item.month,
              year: item.year,
            },
          }
        );
      } else {
        await db.models.Activity.create({
          count: item.count,
          month: item.month,
          monthLong: item.monthLong,
          year: item.year,
        });
      }
    } catch (e) {
      console.log(e);
    }
  }
};

module.exports = {
  getLogsByAction,
  updateActivities,
  formatToChartData,
  formatToWebStatistics,
  formatToAdminStatistics,
  formatActivityToChartData,
  formatToOrdersCountChartData,
  formatToUniqueAddressesChartData,
};
