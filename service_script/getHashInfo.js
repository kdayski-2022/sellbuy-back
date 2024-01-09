const db = require('../database');
const Web3 = require('web3');
const { INFURA_PROVIDERS } = require('../config/network');
const { getPayin } = require('../lib/order');

const getHashInfo = async () => {
  try {
    const hash =
      '0xac0398761008c60fc9a2ce64a08d1e968b3694621ee2073afa6bd736f3118713';
    // const hash = '0x7b19bdb1f1d63bd2976a2c90b528a38a033ff24cb0a0d9837b526439fc1d26fe';
    const chain_id = 42161;
    const amount = 2;
    const price = 2250;
    const direction = 'sell';

    const web3 = new Web3(INFURA_PROVIDERS[chain_id]);
    const tx = await web3.eth.getTransactionReceipt(hash);

    console.log(tx);
    if (tx) {
      const address = tx.from;
      payment_complete = tx.status;
      const user_payment_tx_hash = tx.transactionHash;
      const payedIn = await getPayin(web3, {
        chain_id,
        user_payment_tx_hash,
        from: address,
        amount,
        price,
        direction,
      });
      console.log(payedIn);
      if (tx.status === false) {
        const errMessage = `${tx.transactionHash}\nTransaction failed with error`;
        console.log(errMessage);
        throw new Error(errMessage);
      }
      if (!payedIn) {
        const errMessage = `${tx.transactionHash}\nTransaction has invalid amount`;
        console.log(errMessage);
        throw new Error(errMessage);
      }
      console.log(`${address}\nOrder creation attempt has passed payment`);
    }
  } catch (e) {
    throw e;
  }
};

db.connection.authenticate().then(async () => {
  try {
    await getHashInfo();
  } catch (e) {
    console.log(e);
  }
});
