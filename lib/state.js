const Web3 = require('web3');
const axios = require('axios');
const db = require('../database');
const dotenv = require('dotenv');
const { get_order } = require('../config/requestData.json');
const { getAccessToken } = require('./auth');
dotenv.config();
const infuraRpc = process.env.INFURA_RPC;
const apiUrl = process.env.API_URL;

const checkState = async (data) => {
  let {
    address,
    hash,
    order_id,
    order_published,
    payment_complete,
    referral_registration,
    all_stages_succeeded,
    instrument_name,
    error,
  } = data;
  if (error) {
    return {
      order_published,
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
        const web3 = new Web3(infuraRpc);
        const tx = await web3.eth.getTransactionReceipt(hash);
        if (tx) {
          payment_complete = tx.status;
          telegram.send(
            `${address}\nOrder creation attempt has passed payment`
          );
        }
      }
    }
    if (order_id) {
      if (!order_published) {
        order_published = true;
        get_order.params.order_id = order_id;
        const accessToken = await getAccessToken();
        const { data } = await axios.post(apiUrl, get_order, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        instrument_name = data.result.instrument_name;
        telegram.send(
          `${address}\nOrder creation attempt has passed derebit api`
        );
      }
    }
    if (payment_complete && order_published) {
      if (!referral_registration) {
        const referral = await db.models.User.findOne({ where: { address } });
        if (referral && referral.ref_user_id) {
          await db.models.ReferralPayout.create({
            address,
            order_id,
            tx_hash: hash,
          });
          telegram.send(
            `${address}\nOrder creation attempt has passed referral registration`
          );
        }
        referral_registration = true;
      }
    }
    if (payment_complete && order_published && referral_registration) {
      if (!all_stages_succeeded) {
        all_stages_succeeded = true;
        telegram.send(
          `${address}\nOrder creation attempt has passed all stages`
        );
      }
    }
    return {
      order_published,
      payment_complete,
      all_stages_succeeded,
      instrument_name,
      referral_registration,
    };
  } catch (e) {
    return {
      order_published,
      payment_complete,
      all_stages_succeeded,
      instrument_name,
      referral_registration,
      error: e.message,
    };
  }
};

module.exports = { checkState };
