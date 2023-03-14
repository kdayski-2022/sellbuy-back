const isEmpty = require('is-empty');
const db = require('../database');

const getUserData = async (req) => {
  try {
    const userAgent = req ? req.headers['user-agent'] : '';
    const ipAddress = req
      ? req.headers['x-forwarded-for'] || req.socket.remoteAddress
      : '';
    const browser = userAgent ? getBrowserByUserAgent(userAgent) : '';
    const typeMobile = userAgent ? getTypeMobileByUserAgent(userAgent) : '';

    return {
      userAgent,
      ipAddress,
      browser,
      typeMobile,
    };
  } catch (e) {
    throw new Error(e);
  }
};

const writeLog = async (fields) => {
  try {
    const { req, sessionInfo } = fields;
    const { userAddress, sessionToken } = sessionInfo || {};

    const userAgent = req ? req.headers['user-agent'] : '';
    const ipAddres = req
      ? req.headers['x-forwarded-for'] || req.socket.remoteAddress
      : '';
    const requestParams = req
      ? JSON.stringify({ ...req.query, ...req.params, ...req.body })
      : '';

    const browser = userAgent ? getBrowserByUserAgent(userAgent) : '';
    const typeMobile = userAgent ? getTypeMobileByUserAgent(userAgent) : '';
    // walletType
    !isEmpty(sessionInfo) && (await updateLogUserAddress(sessionInfo));

    const { id } = await db.models.Log.create({
      ...fields,
      userAgent,
      userAddress,
      sessionToken,
      ipAddres,
      browser,
      typeMobile,
      requestParams,
    });
    return id;
  } catch (e) {
    throw new Error(e);
  }
};

const destroyLog = async (id) => {
  try {
    await db.models.Log.destroy({ where: { id } });
  } catch (e) {
    throw new Error(e);
  }
};

const updateLog = async (id, fields) => {
  try {
    delete fields['id'];
    await db.models.Log.update({ ...fields }, { where: { id } });
  } catch (e) {
    if (e.errors && e.errors['0'] && e.errors['0'].message) {
      throw new Error(e.errors['0'].message);
    } else {
      throw new Error(e.message);
    }
  }
};

const updateLogUserAddress = async (sessionInfo) => {
  const { userAddress, sessionToken } = sessionInfo;
  if (userAddress) {
    await db.models.Log.update({ userAddress }, { where: { sessionToken } });
  }
};

const getTypeMobileByUserAgent = (userAgent) => {
  let typeMobile;

  if (userAgent.match(/android/i)) {
    typeMobile = 'Android';
  } else if (userAgent.match(/iphone/i)) {
    typeMobile = 'iPhone';
  } else {
    typeMobile = 'Unknown';
  }

  return typeMobile;
};

const getBrowserByUserAgent = (userAgent) => {
  let browserName;

  if (userAgent.match(/chrome|chromium|crios/i)) {
    browserName = 'Chrome';
  } else if (userAgent.match(/firefox|fxios/i)) {
    browserName = 'Firefox';
  } else if (userAgent.match(/safari/i)) {
    browserName = 'Safari';
  } else if (userAgent.match(/opr\//i)) {
    browserName = 'Opera';
  } else if (userAgent.match(/edg/i)) {
    browserName = 'Edge';
  } else {
    browserName = 'Unknown';
  }

  return browserName;
};

module.exports = { writeLog, updateLog, destroyLog, getUserData };
