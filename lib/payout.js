const Web3 = require('web3');
const dotenv = require('dotenv');
const PayoutAbi = require('../abi/Payout.json');
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
      const BN = this.web3.utils.BN;
      const contract = new this.web3.eth.Contract(
        PayoutAbi,
        this.payoutAddress,
        {
          from: this.serviceWalletAddress,
        }
      );
      await contract.methods
        .create(...data)
        .send({ from: this.serviceWalletAddress, gasLimit: this.gasLimit });
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = Payout;
