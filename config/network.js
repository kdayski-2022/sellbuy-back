const CHAIN_LIST = [1, 80001, 42161, 421613];

const CHAIN_LIST_ENV = {
  production: [1, 42161],
  development: [80001, 421613],
};

const CHAIN_TOKENS = {
  1: 'ETH',
  80001: 'MATIC',
  42161: 'ETH',
  421613: 'ETH',
};

const CHAIN_NAMES = {
  1: 'Ethereum',
  80001: 'Mumbai',
  42161: 'Arbitrum',
  421613: 'Arbitrum Goerli',
};

const CHAIN_GAS_LIMITS = {
  1: 22000,
  80001: 22000,
  42161: 2500000,
  421613: 2500000,
};

const SERVICE_WALLET_ADDRESS = {
  1: '0x69f6b72A414A15fa0c02B41F4E53fA964b74B27f',
  80001: '0x05528440b9e0323D7CCb9Baf88b411CE481694a0',
  42161: '0x69f6b72A414A15fa0c02B41F4E53fA964b74B27f',
  421613: '0x05528440b9e0323D7CCb9Baf88b411CE481694a0',
};

const PAYOUT_CONTRACT_ADDRESS = {
  1: '0x1cc15fc92c0d4cd9e9bfeee6905c0b0fcaa261cd',
  80001: '0xF14d2a92fFd8358F43c518c301B826c298341719',
  42161: '0x1cc15fc92c0d4cd9e9bfeee6905c0b0fcaa261cd',
  421613: '0x6aF384fA1a026b3633613aE9668CAFED7C78C085',
};

const WITHDRAWAL_TOKEN_ADDRESS = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  80001: '0x2A54CCDBc7b39a153dB26E3F72aEdbe2ad1609F2',
  42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  421613: '0x5Ad4923d37f6D203d8a452E8936AaD423D3d4ea9',
};

const INFURA_PROVIDERS = {
  1: 'https://mainnet.infura.io/v3/facd693a8e764005bf265d603b34a4f9',
  80001: 'https://polygon-mumbai.infura.io/v3/facd693a8e764005bf265d603b34a4f9',
  42161:
    'https://arbitrum-mainnet.infura.io/v3/dbfff08523c14a52b0280dc383126193',
  421613:
    'https://arbitrum-goerli.infura.io/v3/dbfff08523c14a52b0280dc383126193',
};

const BLOCK_EXPLORERS = {
  1: 'https://etherscan.io',
  80001: 'https://mumbai.polygonscan.com',
  42161: 'https://arbiscan.io',
  421613: 'https://goerli-rollup-explorer.arbitrum.io',
};

const API_URLS = {
  1: 'https://api.etherscan.io',
  80001: 'https://api-testnet.polygonscan.com',
  42161: 'https://api.arbiscan.io',
  421613: 'https://api-goerli.arbiscan.io',
};

const API_KEYS = {
  1: 'B7B8APXXS198MJ9GEA5S9G32WKTUF9XJAB',
  80001: '2DB6GJUGAN57R9DBG4586KJGEM11DSUSWF',
  42161: 'PZAWVZRJXA5AX3MIN9NPC4VATACGXK7YPN',
  421613: 'PZAWVZRJXA5AX3MIN9NPC4VATACGXK7YPN',
};

module.exports = {
  CHAIN_LIST,
  SERVICE_WALLET_ADDRESS,
  PAYOUT_CONTRACT_ADDRESS,
  WITHDRAWAL_TOKEN_ADDRESS,
  CHAIN_NAMES,
  CHAIN_GAS_LIMITS,
  INFURA_PROVIDERS,
  BLOCK_EXPLORERS,
  API_URLS,
  API_KEYS,
  CHAIN_TOKENS,
  CHAIN_LIST_ENV,
};
