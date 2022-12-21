const db = require('../database');
var empty = require('is-empty');
const crypto = require('crypto');
const TOKEN_KEY = 'Session-Token';
const USER_ADDRESS = 'User-Address';

const Session = {
  update: async (req) => {
    const sessionToken = getTokenFromHeader(req);
    const userAddress = getUserAddressFromHeader(req);

    const userSession = await db.models.UserSession.findOne({
      where: { sessionToken },
    });

    if (!userSession) {
      return await Session.create(req);
    }

    if (userSession && userSession.userAddress) {
      const { sessionToken, userAddress } = userSession;
      return { sessionToken, userAddress };
    }

    if (userSession && !userSession.userAddress && !empty(userAddress)) {
      await db.models.UserSession.update(
        { userAddress },
        { where: { sessionToken } }
      );
      const { sessionToken, userAddress } = await db.models.UserSession.findOne(
        {
          where: { sessionToken },
        }
      );
      return { sessionToken, userAddress };
    }

    return { sessionToken, userAddress };
  },
  create: async (req) => {
    const userAddress = getUserAddressFromHeader(req);
    const sessionToken = crypto.randomBytes(32).toString('hex');

    await db.models.UserSession.create({ sessionToken, userAddress });

    return { sessionToken, userAddress };
  },
};

function getTokenFromHeader(req) {
  return !empty(req.headers[TOKEN_KEY.toLowerCase()])
    ? req.headers[TOKEN_KEY.toLowerCase()]
    : null;
}
function getUserAddressFromHeader(req) {
  return !empty(req.headers[USER_ADDRESS.toLowerCase()])
    ? req.headers[USER_ADDRESS.toLowerCase()]
    : null;
}

const checkSession = async (req) => {
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
