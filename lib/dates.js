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

const getFirstDayOfNextMonth = (today = new Date()) => {
  const nextMonth = today.getMonth() + 1;
  const year = today.getFullYear() + (nextMonth === 12 ? 1 : 0);
  return new Date(year, nextMonth % 12, 1);
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
  if (daysDifference >= 28) return getTargetDays(0, targetPeriod);
  if (daysDifference >= 14) return getTargetDays(0, targetPeriod);
  if (daysDifference >= 7) return getTargetDays(0, targetPeriod);
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

const getDaysDifference = (timestamp, date1 = new Date()) => {
  let date2 = Number(timestamp);
  if (date2 === NaN) date2 = new Date(timestamp);
  else date2 = new Date(date2);
  const diffTime = Math.abs(date2 - date1);
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getTimeDifference = (timestamp, date1 = new Date()) => {
  let date2 = Number(timestamp);
  if (date2 === NaN) date2 = new Date(timestamp);
  else date2 = new Date(date2);
  const diffTime = Math.abs(date2 - date1);
  const result = {};
  result.seconds = Math.ceil((diffTime / 1000) % 60);
  result.minutes = Math.floor(diffTime / 1000 / 60);
  result.formatted = `${result.minutes} min. ${result.seconds} sec.`;
  return result;
};

const formatDate = (date, format = 'default', price = 0) => {
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
  const year = new Date(date).getFullYear();
  const month = monthNames[new Date(date).getMonth()];
  const monthNumber = new Date(date).getMonth() + 1;
  const day = new Date(date).getDate();

  switch (format) {
    case 'dot':
      return `${day < 10 ? `0${day}` : day}.${
        monthNumber < 10 ? `0${monthNumber}` : monthNumber
      }.${year}`;
    case 'utc':
      return `${day}/${monthNumber}/${year}`;
    case 'derebit':
      return `${day}${String(month).toUpperCase()}${String(year).substring(
        2,
        4
      )}-${price}-H`;
    default:
      const daySrt = String(day);
      let postfix = 'th';
      if (daySrt[daySrt.length - 1] === '1') postfix = 'st';
      if (daySrt[daySrt.length - 1] === '2') postfix = 'nd';
      if (daySrt[daySrt.length - 1] === '3') postfix = 'rd';
      return `${day}${postfix} of ${month} ${year}`;
  }
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

const formatTime = (date, format = 'default') => {
  const hours = new Date(date).getUTCHours();
  let minutes = new Date(date).getMinutes();
  if (minutes < 10) minutes = `0${minutes}`;
  if (format === 'utc') return `${hours}:${minutes}`;
  return `${hours}.${minutes}`;
};

const getTimeLeft = (startDate, endDate) => {
  const date1 = new Date(startDate);
  const date2 = new Date(endDate);
  if (date1 > date2) return `Paid`;
  let delta = Math.abs(date2 - date1) / 1000;

  const days = Math.floor(delta / 86400);
  delta -= days * 86400;

  const hours = Math.floor(delta / 3600) % 24;
  delta -= hours * 3600;

  const minutes = Math.floor(delta / 60) % 60;
  delta -= minutes * 60;

  // const seconds = Math.floor(delta % 60);

  return `${days} days, ${hours} hours, ${minutes} minutes`;
};

const getUntilExpirationDays = (period) => {
  return getDaysDifference(Number(period)) > 1
    ? `${getDaysDifference(Number(period))} days`
    : `${getDaysDifference(Number(period))} day`;
};

module.exports = {
  getCurrentDay,
  getLastDayOfWeek,
  getFirstDayOfWeek,
  getFutureTimestamp,
  getTimestamp,
  getDaysDifference,
  getValidDays,
  formatDate,
  formatTime,
  getTimeLeft,
  getUntilExpirationDays,
  getFirstDayOfNextMonth,
  getTimeDifference,
};
