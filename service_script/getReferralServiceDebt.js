const db = require('../database');
const Web3 = require('web3');

const {
  CHAIN_NETWORKS,
  INFURA_PROVIDERS,
  REFERRAL_CONTRACT_ADDRESS,
  SERVICE_WALLET_ADDRESS,
  TOKEN_ADDRESS,
} = require('../config/network');
const ReferralAbi = require('../abi/Referral.json');
const Eth = require('../lib/etherscan');

db.connection.authenticate().then(async () => {
  try {
    const incomes = await db.models.ReferralContractIncome.findAll();

    const result = [];
    let sum = 0;
    for (const income of incomes) {
      const index = result.findIndex((item) => item.address === income.address);
      if (index === -1) {
        result.push({ address: income.address, amount: Number(income.amount) });
      } else {
        result[index].amount += Number(income.amount);
      }
      sum += Number(income.amount);
    }

    const chain_id = CHAIN_NETWORKS.Arbitrum;

    const web3 = await new Web3(
      new Web3.providers.HttpProvider(INFURA_PROVIDERS[chain_id])
    );
    const contract = new web3.eth.Contract(
      ReferralAbi,
      REFERRAL_CONTRACT_ADDRESS[chain_id],
      {
        from: SERVICE_WALLET_ADDRESS[chain_id],
      }
    );
    const balanceWei = await contract.methods
      .getTokenBalance(TOKEN_ADDRESS[chain_id].USDC)
      .call();

    const balance = await Eth.tokenFromWei(
      balanceWei,
      TOKEN_ADDRESS[chain_id].USDC,
      chain_id
    );

    const duty = Number(sum.toFixed(2)) - Number(balance);

    console.log({ balance, sum: sum.toFixed(2), duty: duty.toFixed(2) });

    console.log('done');
  } catch (e) {
    console.log(e);
  }
});
