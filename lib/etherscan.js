const axios = require('axios');
const Web3 = require('web3');
const web3 = new Web3();
const {
  API_URLS,
  API_KEYS,
  PAYOUT_CONTRACT_ADDRESS,
  INFURA_PROVIDERS,
} = require('../config/network');
const { convertFloatToBnString, removeLeadingZeros } = require('./lib');
const ERC20Abi = require('../abi/ERC20.json');

function Eth() {
  if (!(this instanceof Eth)) {
    return new Eth();
  }
}

Eth.decodeErc20Input = (input) => {
  const params = input.replace('0xa9059cbb', '0x');
  const result = web3.eth.abi.decodeParameters(['address', 'uint256'], params);
  return Object.keys(result).map((key) => result[key]);
};

Eth.fromWei = (value, currency) => {
  const BN = web3.utils.BN;
  switch (currency) {
    case 'ETH':
      return web3.utils.fromWei(value, 'ether');
    case 'USDC':
      const valueWeiBN = new BN(value);
      const delimiterBN = new BN('10').pow(new BN('6'));
      return valueWeiBN.div(delimiterBN).toString();
    default:
      return value;
  }
};

Eth.getTokenName = (address) => {
  if (address === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') {
    return 'USDC';
  }
  return 'Unlisted token name';
};

Eth.getAverageBlockTime = async (chain_id, currentBlockNumber) => {
  const blockDifference = 110;
  const latestBlockNumber = currentBlockNumber - 10;
  const earliestBlockNumber = latestBlockNumber - blockDifference;
  const earliestBlockTimestamp = await Eth.getBlockTimestamp(
    chain_id,
    earliestBlockNumber
  );
  const latestBlockTimestamp = await Eth.getBlockTimestamp(
    chain_id,
    latestBlockNumber
  );
  const averageBlockTime =
    (latestBlockTimestamp - earliestBlockTimestamp) /
    (latestBlockNumber - earliestBlockNumber);
  return averageBlockTime;
};

Eth.getBlockTimestamp = async (chain_id, blockNumber) => {
  const url = `${API_URLS[chain_id]}/api?apikey=${API_KEYS[chain_id]}&`;
  const response = await request(url, {
    module: 'block',
    action: 'getblockreward',
    blockno: blockNumber,
  });
  return Number(response.timeStamp);
};

Eth.getCurrentBlockNumber = async (chain_id) => {
  const url = `${API_URLS[chain_id]}/api?apikey=${API_KEYS[chain_id]}&`;
  const currentBlock = await request(url, {
    module: 'proxy',
    action: 'eth_blockNumber',
  });
  const currentBlockNumber = parseInt(currentBlock, 16);
  return currentBlockNumber;
};

Eth.getBlockNumberSecondsAgo = async (
  chain_id,
  currentBlockNumber,
  timestamp
) => {
  const averageBlockTime = await Eth.getAverageBlockTime(
    chain_id,
    currentBlockNumber
  );
  const blocksAgo = Math.floor(timestamp / averageBlockTime);
  return currentBlockNumber - blocksAgo;
};

Eth.getServiceTxList = async function getOrders(
  chain_id,
  startblock = 0,
  endblock = 0
) {
  return new Promise(async (resolve, reject) => {
    const address = PAYOUT_CONTRACT_ADDRESS[chain_id];
    const url = `${API_URLS[chain_id]}/api?apikey=${API_KEYS[chain_id]}&`;
    if (!endblock) endblock = await Eth.getCurrentBlockNumber(chain_id);

    const ethTransactions = await request(url, {
      module: 'account',
      action: 'txlist',
      address,
      startblock,
      endblock,
      sort: 'desc',
    });

    const erc20Transactions = await request(url, {
      module: 'account',
      action: 'tokentx',
      address,
      startblock,
      endblock,
      sort: 'desc',
    });

    resolve({
      ethTransactions,
      erc20Transactions,
    });
  });
};

Eth.getServiceBalance = async function getOrders(chain_id) {
  return new Promise(async (resolve, reject) => {
    try {
    } catch (error) {}
    const url = `${API_URLS[chain_id]}/api?apikey=${API_KEYS[chain_id]}&`;
    const res = await axios.get(
      `${url}&module=account&action=balance&address=${serviceAddress}&tag=latest`
    );
    resolve(res);
  });
};

Eth.getTokenBalance = async function getTokenBalance(tokenAddress) {
  return new Promise(async (resolve, reject) => {
    try {
    } catch (error) {}
    const url = `${API_URLS[chain_id]}/api?apikey=${API_KEYS[chain_id]}&`;
    const res = await axios.get(
      `${url}&module=account&action=tokenbalance&address=${serviceAddress}&contractaddress=${tokenAddress}&tag=latest`
    );
    resolve(parseFloat((res.data.result / 1000000).toFixed(2)));
  });
};

Eth.tokenToWei = async (amount, tokenAddress, chain_id) => {
  try {
    const provider = new Web3.providers.HttpProvider(
      INFURA_PROVIDERS[chain_id]
    );
    const web3 = new Web3(provider);
    const contract = new web3.eth.Contract(ERC20Abi, tokenAddress);
    const decimals = await contract.methods.decimals().call();
    const value = removeLeadingZeros(convertFloatToBnString(amount, decimals));
    return value;
  } catch (e) {
    throw new Error(e.message);
  }
};

Eth.ethToWei = async (amount, chain_id) => {
  try {
    const provider = new Web3.providers.HttpProvider(
      INFURA_PROVIDERS[chain_id]
    );
    const web3 = new Web3(provider);
    return web3.utils.toWei(String(amount), 'ether');
  } catch (e) {
    throw new Error(e.message);
  }
};

Eth.tokenFromWei = async (amount, tokenAddress, chain_id) => {
  try {
    const provider = new Web3.providers.HttpProvider(
      INFURA_PROVIDERS[chain_id]
    );
    const web3 = new Web3(provider);
    const BN = web3.utils.BN;
    const contract = new web3.eth.Contract(ERC20Abi, tokenAddress);
    let result;
    const decimals = await contract.methods.decimals().call();
    if (decimals === '18') {
      result = web3.utils.fromWei(amount, 'ether');
    }
    if (decimals !== '18') {
      const delimiter = new BN('10')
        .pow(new BN(String(18 - Number(decimals))))
        .toString();
      const value = new BN(String(amount)).mul(new BN(delimiter)).toString();
      result = web3.utils.fromWei(value, 'ether');
    }
    return result;
  } catch (e) {
    throw new Error(e.message);
  }
};

Eth.ethFromWei = async (amount, chain_id) => {
  try {
    const web3 = new Web3(
      new Web3.providers.HttpProvider(INFURA_PROVIDERS[chain_id])
    );
    return web3.utils.fromWei(String(amount), 'ether');
  } catch (e) {
    throw new Error(e.message);
  }
};

function request(url, params) {
  return new Promise(async (resolve, reject) => {
    const qs = Object.keys(params)
      .map((key) => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    try {
      const res = await axios.get(url + qs);
      resolve(res.data.result);
    } catch (error) {
      console.log(error);
      reject(false);
    }
  });
}
module.exports = Eth;
