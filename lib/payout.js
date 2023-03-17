const Web3 = require('web3');
const dotenv = require('dotenv');
const PayoutAbi = require('../abi/Payout.json');
const { arraysEqual } = require('./lib');
dotenv.config();

class Payout {
  constructor() {
    this.infuraRpc = process.env.INFURA_RPC;
    this.privateKey = process.env.METAMASK_PRIV_KEY;
    this.serviceWalletAddress = process.env.SERVICE_WALLET_ADDRESS;
    this.withdrawalTokenAddress = process.env.WITHDRAWAL_TOKEN_ADDRESS;
    this.payoutAddress = process.env.PAYOUT_CONTRACT_ADDRESS;
    this.gasETH = 21000;
    this.gasToken = 48600;
    this.gasLimit = 1000000;
  }

  async init() {
    this.web3 = await new Web3(new Web3.providers.HttpProvider(this.infuraRpc));
    await this.web3.eth.accounts.wallet.add(this.privateKey);
  }

  async create(data) {
    try {
      const contract = new this.web3.eth.Contract(
        PayoutAbi,
        this.payoutAddress,
        {
          from: this.serviceWalletAddress,
        }
      );
      const recorded = await contract.methods.recorded().call();
      const payReport = await contract.methods.getPayReport().call();
      const equals = this.compareCreateData(data, payReport);

      if (!recorded && !equals) {
        await contract.methods
          .create(...data)
          .send({ from: this.serviceWalletAddress, gasLimit: this.gasLimit });
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

    return JSON.stringify(initData) === JSON.stringify(transformedData);
  }
}

module.exports = Payout;
