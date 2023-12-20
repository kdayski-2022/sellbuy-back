const db = require('../database');
const crypto = require('crypto');
const {
  ACTIVITY_NAMES,
  ACTIVITY_VALUES,
  ACTIVITY_MODIFICATIONS,
} = require('../enum/enum');
const { USER_COMMISSION } = require('../config/constants.json');

const generateUniqueKey = (address) => {
  const hash = crypto.createHash('sha256').update(address).digest('hex');
  return parseInt(hash.substring(0, 8), 16);
};

const createOrUpdateUserPointsHistory = async (userAddress) => {
  if (userAddress === 'undefined' || !userAddress) return;

  const address = userAddress.toLowerCase();

  try {
    await db.connection.transaction(async (transaction) => {
      const lockKey = generateUniqueKey(address);
      await db.connection.query(`SELECT pg_advisory_xact_lock(${lockKey});`, {
        transaction,
      });

      let userPoints = await db.models.UserPointsHistory.findOne({
        where: { address, type: ACTIVITY_NAMES.WALLET_CONNECT },
        transaction,
      });

      if (!userPoints) {
        userPoints = await db.models.UserPointsHistory.create(
          {
            address,
            type: ACTIVITY_NAMES.WALLET_CONNECT,
            multiply: 1,
            value: ACTIVITY_VALUES.WALLET_CONNECT,
          },
          { transaction }
        );
      }

      return userPoints;
    });
  } catch (e) {
    console.error('Error in createOrUpdateUserPointsHistory', e);
  }
};

const checkFirstTx = async (address) => {
  const second = await db.models.UserPointsHistory.findOne({
    where: {
      address,
      type: ACTIVITY_NAMES.FIRST_TX,
    },
  });
  if (!second) {
    await db.models.UserPointsHistory.create({
      address,
      type: ACTIVITY_NAMES.FIRST_TX,
      multiply: 1,
      value: ACTIVITY_VALUES.FIRST_TX,
    });
  }
};

const createAmountEarned = async (address, earned) => {
  await db.models.UserPointsHistory.create({
    address,
    type: ACTIVITY_NAMES.AMOUNT_EARNED,
    multiply: 1,
    value: earned * ACTIVITY_MODIFICATIONS.AMOUNT_EARNED,
  });
};

const createTimeOnPlatform = async (address, days) => {
  await db.models.UserPointsHistory.create({
    address,
    type: ACTIVITY_NAMES.TIME_ON_PLATFORM,
    multiply: 1,
    value: days * ACTIVITY_MODIFICATIONS.TIME_ON_PLATFORM,
  });
};

const createReferralAmountEarned = async (address, earned) => {
  await db.models.UserPointsHistory.create({
    address,
    type: ACTIVITY_NAMES.REFERRAL_AMOUNT_EARNED,
    multiply: 1,
    value: earned * ACTIVITY_MODIFICATIONS.REFERRAL_AMOUNT_EARNED,
  });
};

const getUserInfo = async (address) => {
  address = address.toLowerCase();
  let user = null;
  let parent = null;
  let ordersCount = 0;
  let commission = USER_COMMISSION;
  if (address) {
    user = await db.models.User.findOne({
      where: { address },
    });
  }
  if (user) {
    commission = user.commission;
    const orders = await db.models.Order.findAll({
      where: { from: address },
    });
    ordersCount = orders.length;
  }
  if (user && user.ref_user_id) {
    parent = await db.models.User.findOne({
      where: { id: user.ref_user_id },
    });
  }
  return { user, parent, ordersCount, commission };
};

module.exports = {
  createOrUpdateUserPointsHistory,
  checkFirstTx,
  createAmountEarned,
  createTimeOnPlatform,
  createReferralAmountEarned,
  getUserInfo,
};
