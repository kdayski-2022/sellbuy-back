const Web3 = require('web3')
const ERC20Abi = require('../abi/ERC20.json')

const RECIEVER_WALLET_ADDRESS = '0xf77910ec0af169265ce0fe660a4d3f0b4b57d890'
const INFURA_RPC = 'https://polygon-mumbai.infura.io/v3/dbfff08523c14a52b0280dc383126193'
const METAMASK_PRIV_KEY = 'ddc0242adad04467e00b6883d07df19e8c5026bd933defe178d019505a61d043'
const SENDER_WALLET_ADDRESS = '0x05528440b9e0323D7CCb9Baf88b411CE481694a0'
const WITHDRAWAL_TOKEN_ADDRESS = '0x1D9e08Aad6126FD225171F81e4c4f2AbB2F79e2a'

const getTransactionReceipt = async (user_payment_tx_hash) => {
	const web3 = await new Web3(new Web3.providers.HttpProvider(INFURA_RPC))
	return await web3.eth.getTransactionReceipt(user_payment_tx_hash)
}

const sendUSDC = async (amount, i) => {
	try {
		const web3 = await new Web3(new Web3.providers.HttpProvider(INFURA_RPC))
		await web3.eth.accounts.wallet.add(METAMASK_PRIV_KEY);

		const BN = web3.utils.BN
		const contract = new web3.eth.Contract(ERC20Abi, WITHDRAWAL_TOKEN_ADDRESS, { from: SENDER_WALLET_ADDRESS })
		const decimals = await contract.methods.decimals().call()
		const delimeter = new BN('10').pow(new BN(String(decimals))).toString()
		const value = new BN(String(amount)).mul(new BN(delimeter)).toString()
		const balance = await contract.methods.balanceOf(SENDER_WALLET_ADDRESS).call()

		const valueTokens = new BN(value).div(new BN(delimeter)).toNumber()
		const balanceTokens = new BN(balance).div(new BN(delimeter)).toNumber()
		
		if (valueTokens > balanceTokens) return { status: 'need_balance', message: 'Service wallet has not enough USDC tokens', tx: '' }

		let gas = await contract.methods.transfer(RECIEVER_WALLET_ADDRESS, value).estimateGas({from: SENDER_WALLET_ADDRESS})
		//! ONLY DEV
		gas += Math.ceil(gas * (i / 7))
		console.log(gas)

		const { status, transactionHash } = await contract.methods.transfer(RECIEVER_WALLET_ADDRESS, value).send({from: SENDER_WALLET_ADDRESS, gas})
		return { status, message: transactionHash, tx: transactionHash }
	} catch(e) {
		return { status: 'broken', message: e.message }
	}
}

const sendETH = async (amount, i) => {
	try {
		const web3 = await new Web3(new Web3.providers.HttpProvider(INFURA_RPC))
		await web3.eth.accounts.wallet.add(METAMASK_PRIV_KEY);

		const BN = web3.utils.BN
		const gas = 21000
		//! ONLY DEV
		gas += Math.ceil(gas * (i / 7))
		const valueWei = web3.utils.toWei(String(amount), 'ether')
		const balance = await web3.eth.getBalance(SENDER_WALLET_ADDRESS)

		const valueETH = Number(web3.utils.fromWei(new BN(valueWei)))
		const balanceETH = Number(web3.utils.fromWei(new BN(balance)))
		if (valueETH > balanceETH) return { status: 'need_balance', message: 'Service wallet has not enough ETH tokens', tx: '' }
		
		const tx = await web3.eth.accounts.signTransaction({ from: SENDER_WALLET_ADDRESS, to: RECIEVER_WALLET_ADDRESS, value: valueWei, gas }, METAMASK_PRIV_KEY)
		const { status, transactionHash } = await web3.eth.sendSignedTransaction(tx.rawTransaction)
		return { status, message: transactionHash, tx: transactionHash }
	} catch(e) {
		return { status: 'broken', message: e.message }
	}
}

module.exports = { sendUSDC, sendETH, getTransactionReceipt }