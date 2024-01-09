const md5 = require('md5');
const Web3 = require('web3');
const db = require('../database');
const { writeLog, updateLog, getUserData } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError, verifyCaptchaToken } = require('../lib/lib');
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
const { createUser, updateUser, generateRef } = require('../lib/user');

const md5Salt = process.env.md5Salt;
const REF_FEE = process.env.REF_FEE;
const DB_ENV = process.env.DB_ENV;

const getReferrals = async (address) => {
  address = address.toLowerCase();
  let ref_list = [];
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
  ref_list = user.ref_code_list;
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
  return { referralOrders, ref, ref_list, user };
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
  const { referralOrders, ref, ref_list, user } = await getReferrals(address);
  const orders = await getOrders(referralOrders);
  const { refTable, totals } = await getRefTable(orders, user.ref_fee);
  const balance = await getReferralContractBalance(address);

  return {
    ref,
    ref_list,
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
    const address_hash = md5(md5Salt + address.toLowerCase());
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
          address_hash,
          telegram,
        });
      }

      await db.models.UserSubscription.update(
        {
          address_hash,
          news,
          transaction_notifications,
          email,
          telegram,
          terms,
        },
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
          [db.Op.or]: [
            { ref_code },
            { ref_code_list: { [db.Op.contains]: [ref_code] } },
          ],
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
      const referralOrders = await db.models.Order.findAll({
        where: {
          from: address,
        },
      });
      const noOrders = referralOrders.length === 0;
      if (
        noOrders &&
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

  async editReferral(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'editReferral',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { ref_code } = req.params;
    let { address, idx } = req.body;
    address = address.toLowerCase();
    try {
      let user = await db.models.User.findOne({
        where: {
          address,
        },
      });
      const isAlreadyInUse = await db.models.User.findOne({
        where: {
          [db.Op.or]: [
            { ref_code },
            { ref_code_list: { [db.Op.contains]: [ref_code] } },
          ],
        },
      });
      if (isAlreadyInUse) throw new Error('Ref code is already in use');
      const ref_code_list = JSON.parse(JSON.stringify(user.ref_code_list));
      ref_code_list[idx] = ref_code;
      await updateUser(user, { ref_code, ref_code_list });

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        sessionInfo,
        data: { ref_list: ref_code_list },
      });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        error: e?.message || e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }

  async removeRefCode(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'removeRefCode',
      status: 'in progress',
      sessionInfo,
      req,
    });
    let { address, idx } = req.body;
    address = address.toLowerCase();
    try {
      let user = await db.models.User.findOne({
        where: {
          address,
        },
      });
      let ref_code_list = [];
      if (idx > -1) {
        ref_code_list = JSON.parse(JSON.stringify(user.ref_code_list));
        if (ref_code_list.length <= 1)
          throw new Error('There need to be at least 1 link');
        ref_code_list.splice(idx, 1);
      }
      await updateUser(user, {
        ref_code: ref_code_list.length ? ref_code_list[0] : '',
        ref_code_list,
      });

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        sessionInfo,
        data: { ref_list: ref_code_list },
      });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        error: e?.message || e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }

  async generateRefCode(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'generateRefCode',
      status: 'in progress',
      sessionInfo,
      req,
    });
    let { address } = req.params;
    address = address.toLowerCase();
    try {
      let user = await db.models.User.findOne({
        where: {
          address,
        },
      });
      const ref_code = await generateRef();
      const ref_code_list = JSON.parse(JSON.stringify(user.ref_code_list));
      if (ref_code_list.length >= 3) throw new Error('Ref links limit reached');
      ref_code_list.push(ref_code);
      await updateUser(user, { ref_code, ref_code_list });

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        sessionInfo,
        data: { ref_list: ref_code_list },
      });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        error: e?.message || e?.response?.data?.error?.message,
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

  async addClubMember(req, res) {
    const logId = await writeLog({
      action: 'addClubMember',
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
      await db.models.ClubMember.create(createBody);
      telegram.send(
        `New club member requested.\nName: ${createBody.name}\nWallet: ${createBody.wallet}\nAlias: ${createBody.alias}\nEmail: ${createBody.email}`,
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
        leaderboard[index].club_member =
          user && user.commission > USER_COMMISSION;
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

  async unsubscribe(req, res) {
    const logId = await writeLog({
      action: 'unsubscribe',
      status: 'in progress',
      req,
    });

    try {
      const { hash } = req.params;
      let message = '';
      const subscription = await db.models.UserSubscription.findOne({
        where: { address_hash: hash },
      });
      if (subscription && subscription.email) {
        await db.models.UserSubscription.update(
          {
            email: '',
            transaction_notifications: false,
            news: false,
            terms: false,
          },
          {
            where: { id: subscription.id },
          }
        );
        message =
          '<html><head>Server Response</head><body><h1>You are successfully unsubscribed!</h1></body></html>';
      } else {
        message =
          '<html><head>Server Response</head><body><h1>You are not subscribed!</h1></body></html>';
      }

      updateLog(logId, { status: 'success' });
      res.send(message);
    } catch (e) {
      console.log(e);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.send(
        '<html><head>Server Response</head><body><h1>Something went wrong</h1></body></html>'
      );
    }
  }

  async getUserPoints(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getUserPoints',
      status: 'in progress',
      sessionInfo,
      req,
    });

    try {
      const { address } = req.params;

      const userPoints = await db.models.UserPointsHistory.sum('value', {
        where: { address: address.toLowerCase() },
      });

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data: { userPoints },
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
