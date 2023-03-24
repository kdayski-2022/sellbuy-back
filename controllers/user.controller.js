const crypto = require('crypto');
const db = require('../database');
const { writeLog, updateLog, getUserData } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');
const { COMMISSION } = require('../config/constants.json');
const REF_FEE = process.env.REF_FEE;

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

const getReferralPayouts = async (referrals) => {
  const referralsPayouts = [];
  for (const referral of referrals) {
    const payouts = await db.models.ReferralPayout.findAll({
      where: {
        address: referral.address,
      },
    });
    referralsPayouts.push(...payouts);
  }
  return referralsPayouts;
};

const getOrders = async (referralsPayouts) => {
  const orders = [];
  for (const payout of referralsPayouts) {
    const order = await db.models.Order.findOne({
      where: {
        id: payout.order_id,
      },
    });
    order.referral_paid = payout.paid;
    orders.push(order);
  }
  return orders;
};

const getRefTable = async (orders, ref_fee) => {
  ref_fee = ref_fee || REF_FEE || 0;
  const refTable = [];
  for (const order of orders) {
    if (order && order.order_complete && order.status === 'approved') {
      const address = order.from;
      const appRevenue = (order.recieve / (1 - COMMISSION)) * COMMISSION;
      const earn = (appRevenue / 100) * Number(ref_fee);
      refTable.push({
        address,
        earn: `$${earn.toFixed(2)}`,
        paid: order.referral_paid,
      });
    }
  }
  return refTable;
};

class UserController {
  async getSubscription(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getSubscription',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { address } = req.params;
    try {
      const subscription = await db.models.UserSubscription.findOne({
        where: {
          address: address.toLowerCase(),
        },
      });

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data: { subscription },
        sessionInfo,
      });
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

  async postSubscription(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'postSubcription',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { address } = req.params;
    const { type, email } = req.body;
    try {
      let subscription = await db.models.UserSubscription.findOne({
        where: {
          address: address.toLowerCase(),
        },
      });
      if (!subscription) {
        await db.models.UserSubscription.create({
          address: address.toLowerCase(),
          email,
        });
      }
      switch (type) {
        case 'notifications':
          await db.models.UserSubscription.update(
            { notifications: true, email },
            { where: { address: address.toLowerCase() } }
          );
          break;
        default:
          break;
      }
      subscription = await db.models.UserSubscription.findOne({
        where: {
          address: address.toLowerCase(),
        },
      });

      updateLog(logId, { status: 'success' });
      res.json({ success: true, sessionInfo, data: { subscription } });
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

      const referrals = await db.models.User.findAll({
        where: {
          ref_user_id: user.id,
        },
      });
      const referralsPayouts = await getReferralPayouts(referrals);
      const orders = await getOrders(referralsPayouts);
      const refTable = await getRefTable(orders, user.ref_fee);

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data: {
          ref,
          referrals: refTable,
        },
        sessionInfo,
      });
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

  async getUsers(req, res) {
    await checkSession(req);
    const { _end = 10, _order = 'ASC', _sort = 'id', _start = 0 } = req.query;
    const users = await db.models.User.findAndCountAll({
      offset: _start,
      limit: _end,
      order: [[_sort, _order]],
    });
    for (const user of users.rows) {
      if (!user.nick_name) user.nick_name = 'unknown';
      if (!user.ref_fee) user.ref_fee = REF_FEE;
    }
    users.count = users.rows.length;

    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
    res.setHeader('X-Total-Count', users.count);

    return res.status(200).send(users.rows);
  }

  async updateUser(req, res) {
    const sessionInfo = await checkSession(req);
    const user = req.body;

    try {
      const { id } = user;
      await db.models.User.update({ ...user }, { where: { id } });
      res.json(user);
    } catch (e) {
      res.json({
        success: false,
        data: null,
        error: parseError(e),
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

  async addUtm(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'addUtm',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { utm } = req.body;
    const direction = req.headers['direction-type'];
    try {
      const userData = await getUserData(req);
      await db.models.Utm.create({
        utm,
        data: JSON.stringify(userData),
        sessionToken: sessionInfo ? sessionInfo.sessionToken : null,
        direction,
      });
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
