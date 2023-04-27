const db = require('../database');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');
const { COMMISSION } = require('../config/constants.json');
const isEmpty = require('is-empty');
const REF_FEE = process.env.REF_FEE;

class ReferralPayoutController {
  async getReferralPayout(req, res) {
    await checkSession(req);
    const {
      _end = 10,
      _order = 'ASC',
      _sort = 'id',
      _start = 0,
      paid,
    } = req.query;
    const where = paid === 0 || paid ? { paid } : {};
    const referralPayouts = await db.models.ReferralPayout.findAndCountAll({
      where,
      offset: _start,
      limit: _end,
      order: [[_sort, _order]],
    });
    for (const referralPayout of referralPayouts.rows) {
      const user = await db.models.User.findOne({
        where: { address: referralPayout.address },
      });
      const parent = await db.models.User.findOne({
        where: { id: user.ref_user_id },
      });
      const ref_fee = parent.ref_fee || REF_FEE || 0;
      const order = await db.models.Order.findOne({
        where: { id: referralPayout.order_id },
      });
      const appRevenue =
        (order.recieve / order.commission) * (1 - order.commission);
      const earn = (appRevenue / 100) * Number(ref_fee);
      referralPayout.app_revenue = appRevenue;
      referralPayout.earn = earn;
      referralPayout.parent = parent.address;
    }
    referralPayouts.count = referralPayouts.rows.length;

    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
    res.setHeader('X-Total-Count', referralPayouts.count);

    return res.status(200).send(referralPayouts.rows);
  }

  async updateReferralPayout(req, res) {
    const sessionInfo = await checkSession(req);
    const referralPayout = req.body;

    try {
      const { id } = referralPayout;
      await db.models.ReferralPayout.update(
        { ...referralPayout },
        { where: { id } }
      );
      res.json(referralPayout);
    } catch (e) {
      res.json({
        success: false,
        data: null,
        error: parseError(e),
        sessionInfo,
      });
    }
  }

  async makePayment(req, res) {
    const sessionInfo = await checkSession(req);
    try {
      const { data } = req.body;
      if (!isEmpty(data)) {
        for (const id of Object.keys(data)) {
          await db.models.ReferralPayout.update(
            { paid: true },
            { where: { id } }
          );
        }
      }
      res.json({ success: true, sessionInfo });
    } catch (e) {
      console.log(e);
      res.json({
        success: false,
        error: e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }
}

module.exports = new ReferralPayoutController();
