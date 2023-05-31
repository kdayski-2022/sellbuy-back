const Web3 = require('web3');
const axios = require('axios');
const db = require('../database');
const dotenv = require('dotenv');
const { get_order } = require('../config/requestData.json');
const { getAccessToken } = require('./auth');
const { INFURA_PROVIDERS } = require('../config/infura');
const { getPayin } = require('./order');
dotenv.config();
const apiUrl = process.env.API_URL;

const checkState = async (data) => {
  let {
    amount,
    price,
    direction,
    address,
    hash,
    order_id,
    order_published,
    order_hedged,
    payment_complete,
    referral_registration,
    all_stages_succeeded,
    instrument_name,
    chain_id,
    error,
  } = data;
  if (error) {
    return {
      order_published,
      order_hedged,
      payment_complete,
      all_stages_succeeded,
      instrument_name,
      referral_registration,
      error: error.message,
    };
  }
  try {
    if (hash) {
      if (!payment_complete) {
        const web3 = new Web3(INFURA_PROVIDERS[chain_id]);
        const tx = await web3.eth.getTransactionReceipt(hash);
        if (tx) {
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
          if (tx.status === false) {
            const errMessage = `${tx.transactionHash}\nTransaction failed with error`;
            await telegram.send(errMessage);
            throw new Error(errMessage);
          }
          if (!payedIn) {
            const errMessage = `${tx.transactionHash}\nTransaction has invalid amount`;
            await telegram.send(errMessage);
            throw new Error(errMessage);
          }
          telegram.send(
            `${address}\nOrder creation attempt has passed payment`
          );
        }
      }
    }
    if (order_id) {
      if (parseFloat(amount) >= 1) {
        if (!order_published) {
          get_order.params.order_id = order_id;
          const accessToken = await getAccessToken();
          const { data } = await axios.post(apiUrl, get_order, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          order_published = true;
          instrument_name = data.result.instrument_name;
          telegram.send(
            `${address}\nOrder creation attempt has passed derebit api`
          );
        }
      } else {
        if (!order_hedged) {
          order_hedged = true;
        }
      }
    }
    if (payment_complete && (order_published || order_hedged)) {
      if (!referral_registration) {
        const referral = await db.models.User.findOne({ where: { address } });
        if (referral && referral.ref_user_id) {
          const order = await db.models.Order.findOne({ where: { order_id } });
          if (order) {
            await db.models.ReferralPayout.create({
              address,
              order_id: order.id,
              tx_hash: hash,
            });
            telegram.send(
              `${address}\nOrder creation attempt has passed referral registration`
            );
          }
        }
        referral_registration = true;
      }
    }
    if (
      payment_complete &&
      (order_published || order_hedged) &&
      referral_registration
    ) {
      if (!all_stages_succeeded) {
        all_stages_succeeded = true;
        telegram.send(
          `${address}\nOrder creation attempt has passed all stages`
        );
      }
    }
    return {
      order_published,
      order_hedged,
      payment_complete,
      all_stages_succeeded,
      instrument_name,
      referral_registration,
    };
  } catch (e) {
    return {
      order_published,
      order_hedged,
      payment_complete,
      all_stages_succeeded,
      instrument_name,
      referral_registration,
      error: e.message,
    };
  }
};

module.exports = { checkState };
