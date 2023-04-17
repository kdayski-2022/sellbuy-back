const db = require('../database');
const { writeLog, updateLog } = require('../lib/logger');
const { parseError } = require('../lib/lib');
const {
  sendMail,
  parseTransactionDetails,
  getSubject,
} = require('../lib/email');

class EmailController {
  async sendMailingList(req, res) {
    const logId = await writeLog({
      action: 'sendMailingList',
      status: 'in progress',
      req,
    });
    let { orders, type, transactionHash } = req.body;
    try {
      const subscriptions = await db.models.UserSubscription.findAll({
        where: {
          address: {
            [db.Op.in]: orders.map((order) => order.from.toLowerCase()),
          },
          transaction_notifications: true,
        },
      });
      const subscriptionAddresses = subscriptions.map((sub) =>
        sub.address.toLowerCase()
      );
      orders = orders.filter(({ from }) =>
        subscriptionAddresses.includes(from.toLowerCase())
      );
      orders = orders.map((order) => ({
        ...order,
        subscription: subscriptions.find(
          ({ address }) => address.toLowerCase() === order.from.toLowerCase()
        ),
      }));

      if (orders && orders.length) {
        const subject = getSubject(type);
        for (const order of orders) {
          const html = parseTransactionDetails(order, transactionHash);
          const res = await sendMail(
            [order.subscription.email],
            subject,
            '',
            html
          );
        }
      }

      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: { subscription: subscriptions } });
    } catch (e) {
      const error =
        e && e.message ? e.message : e?.response?.data?.error?.message;
      console.log(error);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        error,
      });
    }
  }

  async sendPersonalEmail(req, res) {
    const logId = await writeLog({
      action: 'sendPersonalEmail',
      status: 'in progress',
      req,
    });
    let { address } = req.params;
    address = address.toLowerCase();
    const { message, type } = req.body;
    try {
      const subscription = await db.models.UserSubscription.findOne({
        where: { address, transaction_notifications: true },
      });

      if (subscription) {
        const subject = getSubject(type);
        await sendMail([subscription.email], subject, message);
      }

      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: { subscription } });
    } catch (e) {
      const error =
        e && e.message ? e.message : e?.response?.data?.error?.message;
      console.log(error);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        error,
      });
    }
  }
}

module.exports = new EmailController();
