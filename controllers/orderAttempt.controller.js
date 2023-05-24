const dotenv = require('dotenv');
const db = require('../database');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');
const { checkState } = require('../lib/state');
const { CHAIN_NAMES } = require('../config/network');
dotenv.config();

class OrderAttemptController {
  async postOrderAttempt(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'postOrderAttempt',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { address } = req.body;
    const direction = req.headers['direction-type'];
    let state = {};
    let id;
    try {
      telegram.send(
        `${address}\nOrder creation attempt has registered on chain ${
          CHAIN_NAMES[req.body.chain_id]
        }`
      );
      state = await checkState(req.body);
      const orderAttempt = await db.models.OrderAttempt.create({
        ...req.body,
        ...state,
        direction,
      });
      id = orderAttempt.id;
      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data: { ...req.body, ...state, id },
        sessionInfo,
      });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      await db.models.OrderAttempt.create({
        ...req.body,
        ...state,
        direction,
        error,
      });
      updateLog(logId, { status: 'failed', error });
      telegram.send(
        `${address}\nOrder creation attempt failed with message\n${JSON.stringify(
          e?.response?.data?.error
        )}`
      );
      res.json({
        success: false,
        data: null,
        error: e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }

  async updateOrderAttempt(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'updateOrderAttempt',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { id, address } = req.body;
    const direction = req.headers['direction-type'];
    let state = {};

    try {
      state = await checkState(req.body);
      await db.models.OrderAttempt.update(
        { ...req.body, ...state, direction },
        { where: { id } }
      );
      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data: { ...req.body, ...state },
        sessionInfo,
      });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      await db.models.OrderAttempt.update(
        {
          ...req.body,
          ...state,
          direction,
          id,
          error,
        },
        { where: { id } }
      );
      updateLog(logId, { status: 'failed', error });
      telegram.send(
        `${address}\nOrder creation attempt failed with message\n${JSON.stringify(
          e?.response?.data?.error
        )}`
      );
      res.json({
        success: false,
        data: null,
        error: e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }
}

module.exports = new OrderAttemptController();
