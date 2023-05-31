const {
  SERVICE_WALLET_ADDRESS,
  PAYOUT_CONTRACT_ADDRESS,
  CHAIN_NAMES,
  CHAIN_LIST,
  CHAIN_GAS_LIMITS,
  WITHDRAWAL_TOKEN_ADDRESS,
} = require('../config/network');

const getConfigByEnv = (env) => {
  let SWA,
    PCA,
    CN,
    CGP,
    CL,
    WTA = null;
  switch (env) {
    case 'production':
      SWA = {
        1: SERVICE_WALLET_ADDRESS[1],
        42161: SERVICE_WALLET_ADDRESS[42161],
      };
      PCA = {
        1: PAYOUT_CONTRACT_ADDRESS[1],
        42161: PAYOUT_CONTRACT_ADDRESS[42161],
      };
      CN = {
        1: CHAIN_NAMES[1],
        42161: CHAIN_NAMES[42161],
      };
      CGP = {
        1: CHAIN_GAS_LIMITS[1],
        42161: CHAIN_GAS_LIMITS[42161],
      };
      CL = [1, 42161];
      WTA = {
        1: WITHDRAWAL_TOKEN_ADDRESS[1],
        42161: WITHDRAWAL_TOKEN_ADDRESS[42161],
      };
      break;
    case 'development':
      SWA = {
        80001: SERVICE_WALLET_ADDRESS[80001],
        421613: SERVICE_WALLET_ADDRESS[421613],
      };
      PCA = {
        80001: PAYOUT_CONTRACT_ADDRESS[80001],
        421613: PAYOUT_CONTRACT_ADDRESS[421613],
      };
      CN = {
        80001: CHAIN_NAMES[80001],
        421613: CHAIN_NAMES[421613],
      };
      CGP = {
        80001: CHAIN_GAS_LIMITS[80001],
        421613: CHAIN_GAS_LIMITS[421613],
      };
      CL = [80001, 421613];
      WTA = {
        80001: WITHDRAWAL_TOKEN_ADDRESS[80001],
        421613: WITHDRAWAL_TOKEN_ADDRESS[421613],
      };
      break;

    default:
      SWA = SERVICE_WALLET_ADDRESS;
      PCA = PAYOUT_CONTRACT_ADDRESS;
      CN = CHAIN_NAMES;
      CL = CHAIN_LIST;
      CGP = CHAIN_GAS_LIMITS;
      WTA = WITHDRAWAL_TOKEN_ADDRESS;
      break;
  }
  return {
    SERVICE_WALLET_ADDRESS: SWA,
    PAYOUT_CONTRACT_ADDRESS: PCA,
    CHAIN_NAMES: CN,
    CHAIN_LIST: CL,
    CHAIN_GAS_LIMITS: CGP,
    WITHDRAWAL_TOKEN_ADDRESS: WTA,
  };
};

module.exports = {
  getConfigByEnv,
};
