const Web3 = require('web3');
const dotenv = require('dotenv');
const ERC20Abi = require('../abi/ERC20.json');
const { INFURA_PROVIDERS } = require('../config/infura');
const {
  WITHDRAWAL_TOKEN_ADDRESS,
  SERVICE_WALLET_ADDRESS,
} = require('../config/network');
dotenv.config();

class Transfer {
  constructor() {
    this.privateKey = process.env.METAMASK_PRIV_KEY;
    this.gasETH = 21000;
    this.gasToken = 48600;
  }

  async init(chain_id) {
    this.chain_id = chain_id;
    this.web3 = await new Web3(
      new Web3.providers.HttpProvider(INFURA_PROVIDERS[chain_id])
    );
    await this.web3.eth.accounts.wallet.add(this.privateKey);
  }

  async usdcToWei(amount) {
    try {
      const contract = new this.web3.eth.Contract(
        ERC20Abi,
        WITHDRAWAL_TOKEN_ADDRESS[this.chain_id],
        { from: SERVICE_WALLET_ADDRESS[this.chain_id] }
      );
      const decimals = await contract.methods.decimals().call();
      const value = this.convertFloatToBnString(amount, decimals);
      return value;
    } catch (e) {
      return { status: 'broken', message: e.message };
    }
  }

  async ethToWei(amount) {
    try {
      return this.web3.utils.toWei(String(amount), 'ether');
    } catch (e) {
      return { status: 'broken', message: e.message };
    }
  }

  async usdcFromWei(amount) {
    try {
      const BN = this.web3.utils.BN;
      const contract = new this.web3.eth.Contract(
        ERC20Abi,
        WITHDRAWAL_TOKEN_ADDRESS[this.chain_id],
        { from: SERVICE_WALLET_ADDRESS[this.chain_id] }
      );
      let result;
      const decimals = await contract.methods.decimals().call();
      if (decimals === '18') {
        result = this.web3.utils.fromWei(amount, 'ether');
      }
      if (decimals !== '18') {
        const delimiter = new BN('10')
          .pow(new BN(String(18 - Number(decimals))))
          .toString();
        const value = new BN(String(amount)).mul(new BN(delimiter)).toString();
        result = this.web3.utils.fromWei(value, 'ether');
      }
      return result;
    } catch (e) {
      console.log(e);
    }
  }

  async getFeePrice(amount, price, estimated_delivery_price, direction) {
    let gasAmount = 0;
    switch (direction) {
      case 'sell':
        await this.#getETHGasAmount(amount);
        break;
      case 'buy':
        await this.#getERC20GasAmount(amount, price);
        break;
      default:
        break;
    }
    if (!gasAmount) return 0;
    const gasPrice = await this.web3.eth.getGasPrice();
    const fee = gasPrice * gasAmount;
    const eth = await this.web3.utils.fromWei(`${fee}`, 'ether');
    const feePrice = estimated_delivery_price * eth;
    return feePrice;
  }

  async convertFloatToBnString(float, decimals) {
    let result;
    let [left, right] = String(float).split('.');
    result = left;
    if (right) {
      right = right.padEnd(decimals, '0');
      result = left.concat(right);
    } else {
      result = result + '0'.repeat(decimals);
    }
    return result;
  }

  async #getETHGasAmount(amount) {
    const gasAmount = await this.web3.eth.estimateGas({
      to: SERVICE_WALLET_ADDRESS[this.chain_id],
      from: SERVICE_WALLET_ADDRESS[this.chain_id],
      value: await this.web3.utils.toWei(`${amount}`, 'ether'),
    });
    return gasAmount;
  }

  async #getERC20GasAmount(amount, price) {
    const contract = new this.web3.eth.Contract(
      ERC20Abi,
      WITHDRAWAL_TOKEN_ADDRESS[this.chain_id],
      { from: SERVICE_WALLET_ADDRESS[this.chain_id] }
    );
    const gasAmount = await contract.methods
      .transfer(SERVICE_WALLET_ADDRESS[this.chain_id], amount * price)
      .estimateGas({ from: SERVICE_WALLET_ADDRESS[this.chain_id] });
    return gasAmount;
  }
}

module.exports = Transfer;
