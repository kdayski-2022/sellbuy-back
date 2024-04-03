const db = require('../database');
const Web3 = require('web3');
const Eth = require('../lib/etherscan');
const ReferralAbi = require('../abi/Referral.json');
const { CHAIN_NETWORKS, REFERRAL_CONTRACT_ADDRESS, TOKEN_ADDRESS } = require('../config/network');
const DB_ENV = process.env.DB_ENV;

  const getReferralContractBalance = async (address) => {
	const chain_id =
	  DB_ENV === 'production' ? CHAIN_NETWORKS.Arbitrum : CHAIN_NETWORKS.Mumbai;
  
	//! There will be a lot of requests. so be careful
	const web3 = await new Web3(
	  new Web3.providers.HttpProvider(INFURA_PROVIDERS[chain_id])
	);
	const contract = new web3.eth.Contract(
	  ReferralAbi,
	  REFERRAL_CONTRACT_ADDRESS[chain_id]
	);
  
	let balance = await contract.methods.balanceOf(address).call();
	balance = Eth.tokenFromWei(balance, TOKEN_ADDRESS[chain_id].USDC, chain_id);
	return balance;
  };

const getReferralPayouts = async (address) => {
	const balance = await getReferralContractBalance(address);
	return parseFloat(balance)
  };
  
const main = async () => {
	let allUsers = await db.models.User.findAll()
	let allRP = await db.models.ReferralPayout.findAll()
	let allRCI = await db.models.ReferralContractIncome.findAll()
	let allOrders = await db.models.Order.findAll()
	allUsers = allUsers.map((item) => item.address.toLowerCase())
	allRP = allRP.map((item) => item.address.toLowerCase())
	allRCI = allRCI.map((item) => item.address.toLowerCase())
	allOrders = allOrders.map((item) => item.from.toLowerCase())
	allUsers = [...allUsers, ...allRP, ...allRCI, ...allOrders]
	const uniq = [...new Set(allUsers)];
	console.log(uniq.length)
	// let total = 0
	// for (const address of uniq) {
	// 	total += await getReferralPayouts(address)
	// 	console.log(total)
	// }
	// console.log(total)
}

db.connection.authenticate().then(async () => {
  try {
    await main()
  } catch (e) {
    console.log(e);
  }
});


