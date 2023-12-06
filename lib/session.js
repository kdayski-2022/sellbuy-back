const db = require('../database');
const crypto = require('crypto');
const { createOrUpdateUserPointsHistory } = require('./user');

const TOKEN_KEY = 'Session-Token';
const USER_ADDRESS = 'User-Address';
const SYSTEM = 'System';

const Session = {
  update: async (req) => {
    const sessionToken = getTokenFromHeader(req);
    const userAddress = getUserAddressFromHeader(req);

    try {
      let userSession;
      if (!sessionToken) {
        if (!userAddress) {
          return await Session.create(req);
        } else {
          userSession = await db.models.UserSession.findOne({
            where: { userAddress },
          });
        }
      } else {
        userSession = await db.models.UserSession.findOne({
          where: { sessionToken },
        });
      }

      if (!userSession) {
        return await Session.create(req);
      }

      const userSessionAddressExist =
        userSession.userAddress && userSession.userAddress !== 'undefined';
      const sameAddress = userSession.userAddress === userAddress;
      const sessionAddressExistSame =
        userSession && userSessionAddressExist && sameAddress;
      const sessionAddressExistDifferent =
        userSession && userSessionAddressExist && !sameAddress;
      const sessionAddressNotExist =
        userSession && !userSessionAddressExist && userAddress;
      const sessionExpired =
        new Date(
          Number(userSession.expire_in) +
            new Date(userSession.createdAt).getTime()
        ) <= new Date();

      if (sessionExpired) {
        return await Session.create(req);
      }

      if (sessionAddressExistSame) {
        return userSession;
      }

      if (sessionAddressExistDifferent || sessionAddressNotExist) {
        await db.models.UserSession.update(
          { userAddress },
          { where: { sessionToken } }
        );
        await createOrUpdateUserPointsHistory(userAddress);
        userSession = await db.models.UserSession.findOne({
          where: { sessionToken },
        });
        return userSession;
      }
    } catch (e) {
      console.log(e);
    }

    return { sessionToken, userAddress };
  },
  create: async (req) => {
    const userAddress = getUserAddressFromHeader(req);
    const sessionToken = crypto.randomBytes(32).toString('hex');

    await db.models.UserSession.create({ sessionToken, userAddress });
    await createOrUpdateUserPointsHistory(userAddress);
    return { sessionToken, userAddress };
  },
};

function getTokenFromHeader(req) {
  return req.headers[TOKEN_KEY.toLowerCase()]
    ? req.headers[TOKEN_KEY.toLowerCase()]
    : null;
}
function getUserAddressFromHeader(req) {
  return req.headers[USER_ADDRESS.toLowerCase()]
    ? req.headers[USER_ADDRESS.toLowerCase()]
    : null;
}

const checkSession = async (req) => {
  const system = req.headers[SYSTEM.toLowerCase()];
  if (system) return;
  let sessionToken = req.headers[TOKEN_KEY.toLowerCase()];
  let sessionInfo;
  if (!sessionToken || sessionToken === 'undefined') {
    sessionInfo = await Session.create(req);
  } else {
    sessionInfo = await Session.update(req);
  }
  return sessionInfo;
};

module.exports = { checkSession };
