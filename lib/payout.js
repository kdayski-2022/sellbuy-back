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
        if (JSON.stringify(data[chain_id]) === '[[],[],[]]') {
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
        const payReport = await contract.methods.getPayoutReport().call();
        const validToSet = this.isValidToSet(data[chain_id], payReport);

        if (!recorded && validToSet) {
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

  isValidToSet(payoutData, contractData) {
    const initData = [[], [], []];
    const emptyPayoutData =
      JSON.stringify(initData) === JSON.stringify(payoutData);
    const dataEquals =
      JSON.stringify(payoutData) === JSON.stringify(contractData);

    if (emptyPayoutData) return false;

    return !dataEquals;
  }
}

module.exports = Payout;
