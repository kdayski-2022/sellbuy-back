const crypto = require('crypto');
const db = require('../database');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');

const generateRef = async () => {
  let ref_code = crypto.randomBytes(3).toString('hex');
  let user = await db.models.User.findOne({
    where: {
      ref_code,
    },
  });
  if (!user) {
    return ref_code;
  } else {
    for (let i = 0; i < 5; i++) {
      ref_code = crypto.randomBytes(3).toString('hex');
      user = await db.models.User.findOne({
        where: {
          ref_code,
        },
      });
      if (!user) {
        break;
      }
    }
    return ref_code;
  }
};

const createUser = async (address) => {
  try {
    ref_code = await generateRef();
    await db.models.User.create({
      address,
      ref_code,
    });
    const user = await db.models.User.findOne({
      where: {
        address,
        ref_code,
      },
    });
    return user;
  } catch (e) {
    throw e;
  }
};

const updateUser = async (user, data) => {
  try {
    await db.models.User.update(data, { where: user });
    const result = await db.models.User.findOne({
      where: {
        address: user.address,
        ref_code: user.ref_code,
      },
    });
    return result;
  } catch (e) {
    throw e;
  }
};

class UserController {
  async getRef(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getRef',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { address } = req.params;

    try {
      let ref;
      let user = await db.models.User.findOne({
        where: {
          address,
        },
      });
      if (!user) {
        user = await createUser(address);
      }
      ref = user.ref_code;
      const referrals = [
        { address, earn: '$12' },
        { address, earn: '$12' },
      ];

      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: { ref, referrals }, sessionInfo });
    } catch (e) {
      console.log(e);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        data: null,
        error: e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }
  async addReferral(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'addReferral',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { ref_code } = req.params;
    const { address } = req.body;
    try {
      let parent = await db.models.User.findOne({
        where: {
          ref_code,
        },
      });
      let referral = await db.models.User.findOne({
        where: {
          address,
        },
      });
      if (!referral) {
        referral = await createUser(address);
      }
      if (
        !referral.ref_user_id &&
        parent &&
        parent.ref_user_id !== referral.id
      ) {
        await updateUser(referral, { ref_user_id: parent.id });
      }

      updateLog(logId, { status: 'success' });
      res.json({ success: true, sessionInfo });
    } catch (e) {
      console.log(e);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        error: e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }
}

module.exports = new UserController();
