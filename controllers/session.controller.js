const db = require('../database');
const crypto = require('crypto');
const MANAGER_TOKEN_KEY = 'A-Auth-Token';
var empty = require('is-empty');
const { checkSession } = require('../lib/session');
const { writeLog, updateLog } = require('../lib/logger');
const { parseError } = require('../lib/lib');
function getManagerTokenFromHeader(req) {
  return !empty(req.headers[MANAGER_TOKEN_KEY.toLowerCase()])
    ? req.headers[MANAGER_TOKEN_KEY.toLowerCase()]
    : null;
}

async function getManagerIdFromToken(accessToken) {
  return new Promise(async (resolve, reject) => {
    const managerSession = await db.models.ManagerSession.findOne({
      where: { accessToken },
    });
    !empty(managerSession) ? resolve(managerSession.managerId) : resolve(null);
  });
}

const Session = {
  generateToken: () => {
    return crypto.randomBytes(32).toString('hex');
  },
  getManagerId: async (req) => {
    return new Promise(async (resolve, reject) => {
      const accessToken = getManagerTokenFromHeader(req);
      if (empty(accessToken)) resolve(null);
      const managerId = await getManagerIdFromToken(accessToken);
      resolve(managerId);
    });
  },
  hasManagerRole: async (roles, managerId) => {
    const manager = await db.models.Manager.findOne({
      where: { id: managerId },
    });
    let has = false;
    if (!empty(manager.role) && Array.isArray(manager.role)) {
      for (role of roles) {
        if (~manager.role.indexOf(role)) {
          has = true;
          break;
        }
      }
    }
    return has;
  },
  create: async (req, res) => {
    const logId = await writeLog({
      action: 'getSession',
      status: 'in progress',
      req,
    });
    try {
      const sessionInfo = await checkSession(req);
      updateLog(logId, { status: 'success', ...sessionInfo });
      res.json({ success: true, sessionInfo });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({ success: false, error: parseError(e), sessionInfo });
    }
  },
};

module.exports = Session;
