const Web3 = require('web3');
const dotenv = require('dotenv');
const PayoutAbi = require('../abi/Payout.json');
const {
  PAYOUT_CONTRACT_ADDRESS,
  SERVICE_WALLET_ADDRESS,
  INFURA_PROVIDERS,
} = require('../config/network');

dotenv.config();

class Payout {
  constructor() {
    this.privateKey = process.env.METAMASK_PRIV_KEY;
  }

  async create(data) {
    try {
      for (const chain_id of Object.keys(data)) {
        const web3 = await new Web3(
          new Web3.providers.HttpProvider(INFURA_PROVIDERS[chain_id])
        );
        await web3.eth.accounts.wallet.add(this.privateKey);
        if (JSON.stringify(data[chain_id]) === '[[],[],[],[]]') {
          continue;
        }
        const contract = new web3.eth.Contract(
          PayoutAbi,
          PAYOUT_CONTRACT_ADDRESS[chain_id],
          {
            from: SERVICE_WALLET_ADDRESS[chain_id],
          }
        );
        const recorded = await contract.methods.recorded().call();
        const payReport = await contract.methods.getPayReport().call();
        const equals = this.compareCreateData(data[chain_id], payReport);

        if (!recorded && !equals) {
          const gasEstimate = await contract.methods
            .create(...data[chain_id])
            .estimateGas({ from: SERVICE_WALLET_ADDRESS[chain_id] });

          const gasLimit = Math.ceil(gasEstimate * 1.1);

          await contract.methods.create(...data[chain_id]).send({
            from: SERVICE_WALLET_ADDRESS[chain_id],
            gasLimit: gasLimit,
          });
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  compareCreateData(payoutData, contractData) {
    const initData = [[], [], [], []];
    const transformedData = [[], [], [], []];
    const addresses = contractData['0'];
    const amounts = contractData['1'];
    const isUsdc = contractData['2'];
    for (let i = 0; i < addresses.length; i++) {
      if (isUsdc[i] === false) {
        transformedData[0].push(addresses[i]);
        transformedData[1].push(amounts[i]);
      } else {
        transformedData[2].push(addresses[i]);
        transformedData[3].push(amounts[i]);
      }
    }

    if (
      transformedData[0].length !== payoutData[0].length ||
      transformedData[2].length !== payoutData[2].length
    )
      return false;

    transformedData[0] = transformedData[0].filter(
      (val) => !payoutData[0].includes(val.toLowerCase())
    );
    transformedData[1] = transformedData[1].filter(
      (val) => !payoutData[1].includes(val.toLowerCase())
    );
    transformedData[2] = transformedData[2].filter(
      (val) => !payoutData[2].includes(val.toLowerCase())
    );
    transformedData[3] = transformedData[3].filter(
      (val) => !payoutData[3].includes(val.toLowerCase())
    );

    if (
      JSON.stringify(initData) !== JSON.stringify(payoutData) &&
      !contractData['0'].length &&
      !contractData['1'].length &&
      !contractData['2'].length
    ) {
      return false;
    }
    return JSON.stringify(initData) === JSON.stringify(transformedData);
  }
}

module.exports = Payout;
