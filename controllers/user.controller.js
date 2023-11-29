const axios = require('axios');
const crypto = require('crypto');
const Web3 = require('web3');
const db = require('../database');
const { writeLog, updateLog, getUserData } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');
const { getFirstDayOfNextMonth } = require('../lib/dates');
const ReferralAbi = require('../abi/Referral.json');
const {
  CHAIN_NETWORKS,
  REFERRAL_CONTRACT_ADDRESS,
  TOKEN_ADDRESS,
} = require('../config/network');
const { INFURA_PROVIDERS } = require('../config/infura');
const Eth = require('../lib/etherscan');
const { USER_COMMISSION } = require('../config/constants.json');

const REF_FEE = process.env.REF_FEE;
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const DB_ENV = process.env.DB_ENV;

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

const getReferrals = async (address) => {
  address = address.toLowerCase();
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
  const referralOrders = [];
  for (const referral of referrals) {
    const payouts = await db.models.ReferralPayout.findAll({
      where: {
        address: referral.address,
      },
    });
    referralOrders.push(...payouts);
  }
  return { referralOrders, ref, user };
};

const getReferralContractBalance = async (address) => {
  const chain_id =
    DB_ENV === 'production' ? CHAIN_NETWORKS.Arbitrum : CHAIN_NETWORKS.Mumbai;

  const web3 = await new Web3(
    new Web3.providers.HttpProvider(INFURA_PROVIDERS[chain_id])
  );
  const contract = new web3.eth.Contract(
    ReferralAbi,
    REFERRAL_CONTRACT_ADDRESS[chain_id]
  );

  let balance = await contract.methods.balanceOf(address).call();
  balance = Eth.tokenFromWei(balance, TOKEN_ADDRESS[chain_id].USDC, chain_id);
  return balance;
};

const getReferralPayouts = async (address) => {
  const { referralOrders, ref, user } = await getReferrals(address);
  const orders = await getOrders(referralOrders);
  const { refTable, totals } = await getRefTable(orders, user.ref_fee);
  const balance = await getReferralContractBalance(address);

  return {
    ref,
    referrals: refTable,
    totals,
    balance,
  };
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
      let appRevenue =
        (order.recieve / order.commission) * (1 - order.commission);
      let earn = (appRevenue / 100) * Number(ref_fee);

      appRevenue = appRevenue.toFixed(2);
      earn = earn.toFixed(2);

      refTable.push({
        address,
        earn,
        paid: order.referral_paid ? earn : '0.00',
      });
    }
  }

  for (const item of refTable) {
    const index = result.findIndex(
      (i) => i.address.toLowerCase() === item.address.toLowerCase()
    );
    if (index !== -1) {
      result[index].earn = (
        Number(result[index].earn) + Number(item.earn)
      ).toFixed(2);
      result[index].paid = (
        Number(result[index].paid) + Number(item.paid)
      ).toFixed(2);
    } else {
      result.push(item);
    }
  }

  const wallets = result.length;
  const transactions = refTable.length;
  const totalEarn = result
    .reduce((acc, obj) => Number(acc) + Number(obj.earn), 0)
    .toFixed(2);
  const totalPaid = result
    .reduce((acc, obj) => Number(acc) + Number(obj.paid), 0)
    .toFixed(2);
  const available = (Number(totalEarn) - Number(totalPaid)).toFixed(2);
  const nextUpdate = getFirstDayOfNextMonth();
  const totals = { wallets, transactions, available, nextUpdate };

  return { refTable: result, totals };
};

const verifyCaptchaToken = async (token) => {
  const verificationURL = 'https://www.google.com/recaptcha/api/siteverify';

  try {
    const response = await axios.post(verificationURL, null, {
      params: {
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
      },
    });

    if (response.data.success) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(error);
    return false;
  }
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

    try {
      let { address } = req.params;

      const data = await getReferralPayouts(address);

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data,
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

  async addAmbassador(req, res) {
    const logId = await writeLog({
      action: 'addAmbassador',
      status: 'in progress',
      req,
    });
    const { captcha, agreement, ...createBody } = req.body;

    const isCaptchaValid = await verifyCaptchaToken(captcha);

    if (!isCaptchaValid) {
      updateLog(logId, { status: 'failed', error: 'Invalid CAPTCHA token' });
      res.json({ success: false, error: 'Invalid CAPTCHA token' });
      return;
    }

    try {
      await db.models.Ambassador.create(createBody);
      telegram.send(
        `New ambassador registered.\nName: ${createBody.name}\nCountry: ${
          createBody.country
        }\nPhone: ${createBody.phone}\nWallet: ${createBody.wallet}${
          createBody.experience ? `\nExperience: ${createBody.experience}` : ''
        }${createBody.link ? `\nLink: ${createBody.link}` : ''}`,
        'support'
      );
      updateLog(logId, { status: 'success' });
      res.json({ success: true });
    } catch (e) {
      console.log(e);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        error: e?.response?.data?.error?.message,
      });
    }
  }

  async getLeaderboard(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getLeaderboard',
      status: 'in progress',
      sessionInfo,
      req,
    });

    try {
      const { rangeTime } = req.query;
      const createdAt = new Date(Number(rangeTime) + 1000 * 60 * 60 * 5);
      const orders = await db.models.Order.findAll({
        where: {
          createdAt: {
            [db.Op.gte]: createdAt,
          },
        },
      });
      let leaderboard = [];
      for (const order of orders) {
        const leaderboardItemIndex = leaderboard.findIndex(
          (item) => item.address === order.from
        );
        if (leaderboardItemIndex === -1)
          leaderboard.push({
            address: order.from,
            earned: order.recieve,
            count: 1,
            executed: order.order_executed ? 1 : 0,
          });
        else {
          leaderboard[leaderboardItemIndex].earned += order.recieve;
          leaderboard[leaderboardItemIndex].count += 1;
          if (order.order_executed)
            leaderboard[leaderboardItemIndex].executed += 1;
        }
      }
      leaderboard.sort((a, b) => {
        if (a.earned < b.earned) return 1;
        if (a.earned > b.earned) return -1;
        return 0;
      });
      leaderboard = leaderboard.slice(0, 10);
      for (const [index, item] of leaderboard.entries()) {
        const user = await db.models.User.findOne({
          where: { address: item.address },
        });
        leaderboard[index].club_member = user.club_member;
      }

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data: { leaderboard },
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
}

module.exports = new UserController();
