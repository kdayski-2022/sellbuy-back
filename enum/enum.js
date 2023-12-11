const ACTIVITY_NAMES = {
  WALLET_CONNECT: 'wallet connect',
  FIRST_TX: 'first tx',
  AMOUNT_EARNED: 'amount earned',
  TIME_ON_PLATFORM: 'time on platform',
  REFERRAL_AMOUNT_EARNED: 'referral amount earned',
};

const ACTIVITY_VALUES = {
  WALLET_CONNECT: 5,
  FIRST_TX: 10,
};

const ACTIVITY_MODIFICATIONS = {
  AMOUNT_EARNED: 1,
  TIME_ON_PLATFORM: 1,
  REFERRAL_AMOUNT_EARNED: 0.2,
};

const ORDER_STATUSES = {
  APPROVED: 'approved',
  CREATED: 'created',
};

const CHAT = {
  SUPPORT: 'support',
  CLUB: 'club',
  LOGS: 'logs',
};

const DIRECTION = {
  SELL: 'sell',
  BUY: 'buy',
};

module.exports = {
  ACTIVITY_NAMES,
  ACTIVITY_VALUES,
  ACTIVITY_MODIFICATIONS,
  ORDER_STATUSES,
  CHAT,
  DIRECTION,
};
