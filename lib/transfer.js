const Web3 = require('web3')
const dotenv = require('dotenv');
const ERC20Abi = require('../abi/ERC20.json')
dotenv.config();

class Transfer {
	constructor() {
		this.infuraRpc = process.env.INFURA_RPC
		this.privateKey = process.env.METAMASK_PRIV_KEY
		this.serviceWalletAddress = process.env.SERVICE_WALLET_ADDRESS;
		this.withdrawalTokenAddress = process.env.WITHDRAWAL_TOKEN_ADDRESS;
	}

	async init() {
		this.web3 = await new Web3(new Web3.providers.HttpProvider(this.infuraRpc))
		await this.web3.eth.accounts.wallet.add(this.privateKey);
	}

	async sendUSDC(to, amount) {
		try {
			const BN = this.web3.utils.BN
			const contract = new this.web3.eth.Contract(ERC20Abi, this.withdrawalTokenAddress, { from: this.serviceWalletAddress })
			const decimals = await contract.methods.decimals().call()
			const delimeter = new BN('10').pow(new BN(String(decimals))).toString()
			const value = new BN(String(amount)).mul(new BN(delimeter)).toString()
			const balance = await contract.methods.balanceOf(this.serviceWalletAddress).call()

			const valueTokens = new BN(value).div(new BN(delimeter)).toNumber()
			const balanceTokens = new BN(balance).div(new BN(delimeter)).toNumber()
			
			if (valueTokens > balanceTokens) return { status: 'need_balance', message: 'Service wallet has not enough USDC tokens', tx: '' }

			const gas = await contract.methods.transfer(to, value).estimateGas({from: this.serviceWalletAddress})

			const { status, transactionHash } = await contract.methods.transfer(to, value).send({from: this.serviceWalletAddress, gas})
			return { status, message: transactionHash, tx: transactionHash }
		} catch(e) {
			return { status: 'broken', message: e.message }
		}
	}

	async sendETH(to, amount) {
		try {
			const BN = this.web3.utils.BN
			const gas = 21000
			const valueWei = this.web3.utils.toWei(String(amount), 'ether')
			const balance = await this.web3.eth.getBalance(this.serviceWalletAddress)

			const valueETH = Number(this.web3.utils.fromWei(new BN(valueWei)))
			const balanceETH = Number(this.web3.utils.fromWei(new BN(balance)))
			if (valueETH > balanceETH) return { status: 'need_balance', message: 'Service wallet has not enough ETH tokens', tx: '' }
			
			const tx = await this.web3.eth.accounts.signTransaction({ from: this.serviceWalletAddress, to, value: valueWei, gas }, this.privateKey)
			const { status, transactionHash } = await this.web3.eth.sendSignedTransaction(tx.rawTransaction)
			return { status, message: transactionHash, tx: transactionHash }
		} catch(e) {
			return { status: 'broken', message: e.message }
		}
	}

	async sendTokens(to, amount) {
		try {
			// TODO gas
			const gas = 2000000
			const valueWei = this.web3.utils.toWei(String(amount))
			const tx = await this.web3.eth.accounts.signTransaction({ from: this.serviceWalletAddress, to, value: valueWei, gas }, this.privateKey)
			const res = await this.web3.eth.sendSignedTransaction(tx.rawTransaction)
			return res
		} catch(e) {
			throw e
		}
	}
}

module.exports = Transfer