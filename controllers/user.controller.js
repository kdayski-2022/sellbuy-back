const crypto = require('crypto');
const db = require('../database');
const { writeLog, updateLog, getUserData } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');
const { getFirstDayOfWeek, getFirstDayOfNextMonth } = require('../lib/dates');
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
    if (order) {
      order.referral_paid = payout.paid;
      orders.push(order);
    }
  }
  return orders;
};

const getRefTable = async (orders, ref_fee) => {
  ref_fee = ref_fee || REF_FEE || 0;
  let result = [];
  const refTable = [];
  for (const order of orders) {
    if (order && (order.status === 'approved' || order.status === 'created')) {
      const address = order.from;
      const appRevenue =
        (order.recieve / order.commission) * (1 - order.commission);
      const earn = (appRevenue / 100) * Number(ref_fee);
      refTable.push({
        address,
        earn,
        paid: order.referral_paid ? earn : 0,
      });
    }
  }

  for (const item of refTable) {
    const index = result.findIndex(
      (i) => i.address.toLowerCase() === item.address.toLowerCase()
    );
    if (index !== -1) {
      result[index].earn += item.earn;
      result[index].paid += item.paid;
    } else {
      result.push(item);
    }
  }

  const wallets = result.length;
  const transactions = refTable.length;
  const totalEarn = result.reduce((acc, obj) => acc + obj.earn, 0);
  const totalPaid = result.reduce((acc, obj) => acc + obj.paid, 0);
  const available = totalEarn - totalPaid;
  const nextUpdate = getFirstDayOfNextMonth();
  const totals = { wallets, transactions, available, nextUpdate };

  return { refTable: result, totals };
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
      let subscription = await db.models.UserSubscription.findOne({
        where: {
          address: address.toLowerCase(),
        },
      });

      if (!subscription) {
        subscription = {
          address,
          email: '',
          telegram: '',
          notifications: null,
          transaction_notifications: null,
          news: null,
          terms: null,
        };
      }

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
    const { subsctiptions, email, telegram } = req.body;
    const { news, transaction_notifications, terms } = subsctiptions;
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
          telegram,
        });
      }

      await db.models.UserSubscription.update(
        { news, transaction_notifications, email, telegram, terms },
        { where: { address: address.toLowerCase() } }
      );

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
    let { address } = req.params;
    address = address.toLowerCase();
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
      const { refTable, totals } = await getRefTable(orders, user.ref_fee);

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data: {
          ref,
          referrals: refTable,
          totals,
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

  async addReferral(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'addReferral',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { ref_code } = req.params;
    let { address } = req.body;
    address = address.toLowerCase();
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
    const { utm, ref } = req.body;
    const direction = req.headers['direction-type'];
    try {
      const userData = await getUserData(req);
      await db.models.Utm.create({
        utm,
        ref,
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
