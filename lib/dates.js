const { TOMORROW, WEEK, TWO_WEEK, MONTH } = require('../config/constants.json');

const getCurrentDay = () => {
  return new Date().getTime();
};

const getFirstDayOfWeek = (timestamp = Date.now()) => {
  const day = new Date(timestamp);
  const firstDayOfWeek = new Date(
    day.setDate(day.getDate() - day.getDay() + 1)
  ).getTime();
  return firstDayOfWeek;
};

const getLastDayOfWeek = (timestamp = Date.now()) => {
  const day = new Date(timestamp);
  const lastDayOfWeek = new Date(
    day.setDate(day.getDate() - day.getDay() + 7)
  ).getTime();
  return lastDayOfWeek;
};

const getTargetDays = (interval, targetPeriod) => {
  const targetDays = [new Date(getTimestamp(targetPeriod)).getDate()];
  for (let i = interval; i > 0; i--) {
    targetDays.push(new Date(getTimestamp(targetPeriod, 'sub', i)).getDate());
    targetDays.push(new Date(getTimestamp(targetPeriod, 'plus', i)).getDate());
  }
  return targetDays.sort((a, b) => a - b);
};

const getValidDays = (daysDifference = 0, targetPeriod = new Date()) => {
  if (daysDifference >= 28) return getTargetDays(3, targetPeriod);
  if (daysDifference >= 14) return getTargetDays(2, targetPeriod);
  if (daysDifference >= 7) return getTargetDays(1, targetPeriod);
  if (daysDifference >= 1) return getTargetDays(0, targetPeriod);
  return getTargetDays(0, targetPeriod);
};

const getTimestamp = (period = Date.now(), action = 'sub', days = 0) => {
  const date = new Date(period);
  switch (action) {
    case 'sub':
      return date.setDate(date.getDate() - days);
    case 'plus':
      return date.setDate(date.getDate() + days);
    default:
      return date.setDate(date.getDate() - days);
  }
};

const getDaysDifference = (timestamp) => {
  const date1 = new Date();
  const date2 = new Date(Number(timestamp));
  const diffTime = Math.abs(date2 - date1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getFutureTimestamp = (weeks) => {
  const day = new Date();
  let weeksForward = 0;
  if (weeks === 0) {
    const nextDayofWeek = new Date(day.setDate(day.getDate() + 1)).setHours(
      11,
      0,
      10,
      0
    );
    return nextDayofWeek;
  }

  weeksForward = day.getDay() === 4 ? weeks : weeks - 1;
  const week = new Date(
    day.setDate(
      day.getDate() + ((((7 - day.getDay()) % 7) + 5) % 7) + 7 * weeksForward
    )
  ).setHours(11, 0, 10, 0);
  return week;

  switch (chooseableDay) {
    case TOMORROW:
      const nextDayofWeek = new Date(day.setDate(day.getDate() + 1)).setHours(
        11,
        0,
        10,
        0
      );
      return nextDayofWeek;

    case WEEK:
      weeksForward = day.getDay() === 4 ? 1 : 0;
      const week = new Date(
        day.setDate(
          day.getDate() +
            ((((7 - day.getDay()) % 7) + 5) % 7) +
            7 * weeksForward
        )
      ).setHours(11, 0, 10, 0);
      return week;

    case TWO_WEEK:
      weeksForward = day.getDay() === 4 ? 2 : 1;
      const twoWeek = new Date(
        day.setDate(
          day.getDate() +
            ((((7 - day.getDay()) % 7) + 5) % 7) +
            7 * weeksForward
        )
      ).setHours(11, 0, 10, 0);
      return twoWeek;

    case MONTH:
      weeksForward = day.getDay() === 4 ? 3 : 2;
      const month = new Date(
        day.setDate(
          day.getDate() +
            ((((7 - day.getDay()) % 7) + 5) % 7) +
            7 * weeksForward
        )
      ).setHours(11, 0, 10, 0);
      return month;

    default:
      return day.setHours(11, 0, 10, 0);
  }
};

module.exports = {
  getCurrentDay,
  getLastDayOfWeek,
  getFirstDayOfWeek,
  getFutureTimestamp,
  getTimestamp,
  getDaysDifference,
  getValidDays,
};

//ТЗ сформировать current day of week и last day of week внутри запроса/ов где они используются
