const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

const {
  getDaysDifference,
  formatDate,
  formatTime,
  getTimeLeft,
} = require('./dates');
const { getApr } = require('./utils');
const { writeLog, updateLog } = require('./logger');
const { parseError, smartRound } = require('./lib');

dotenv.config();

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_AUTH_USER = process.env.EMAIL_AUTH_USER;
const EMAIL_AUTH_PASS = process.env.EMAIL_AUTH_PASS;
const BLOCK_EXPLORER = process.env.BLOCK_EXPLORER;

const sendMail = async (to, subject, text = '', html = '') => {
  const logId = await writeLog({
    action: 'system sendMail',
    status: 'in progress',
  });
  try {
    let transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: true,
      auth: {
        user: EMAIL_AUTH_USER,
        pass: EMAIL_AUTH_PASS,
      },
    });

    await transporter.sendMail({
      from: '"TYMIO" <info@tymio.com>',
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });
    updateLog(logId, { status: 'success' });
  } catch (e) {
    console.log(e);
    updateLog(logId, { status: 'failed', error: parseError(e) });
  }
};

const getDealExpirationBody = (order) => {
  try {
    let html;

    order = addMessagePropsToOrder(order);
    const rows = getDealRows(order, 'expiration');
    const header = getDealHeader('expiration');
    const body = getDealBody(rows);
    const footer = getDealFooter();
    html = header + body + footer;

    return html;
  } catch (e) {
    throw e;
  }
};

const getDealInitiationBody = (order) => {
  try {
    let html;

    order = addMessagePropsToOrder(order);
    const rows = getDealRows(order, 'initiation');
    const header = getDealHeader('initiation');
    const body = getDealBody(rows);
    const footer = getDealFooter();
    html = header + body + footer;

    return html;
  } catch (e) {
    throw e;
  }
};

const addMessagePropsToOrder = (order) => {
  const timeToSettlement = getTimeLeft(new Date(), order.execute_date);
  const days_difference = getDaysDifference(order.execute_date);
  const apr = getApr(
    order.estimated_delivery_price,
    order.bid_price,
    order.price,
    order.commission,
    days_difference
  );
  order = { ...order, timeToSettlement, apr };
  return order;
};

const getDealRows = (order, type) => {
  switch (type) {
    case 'initiation':
      return getDealInitiationRows(order);
    case 'expiration':
      return getDealExpirationRows(order);
    default:
      return [];
  }
};

const getDealBody = (rows) => {
  return `${rows
    .map(({ name, value, type }) => {
      if (type === 'link')
        return `<tr><td style="border-bottom: 1px solid #1a0c2b; padding: 13px 0 13px 0;"><span style="padding-bottom: 13px; font-weight: bold; font-size: 18px;">${name}</span><br/><span style="font-size: 12px"><a style="color: #1a0c2b;" href="${value}">${value}</a></span></td></tr>`;
      if (type === 'text')
        return `<tr><td style="text-align: center; border-bottom: 1px solid #1a0c2b; padding: 26px 0 26px 0; font-size: 16px; font-weight: bold; font-size: 16px;">${name}</td></tr>`;
      if (!type && value)
        return `<tr><td style="border-bottom: 1px solid #1a0c2b; padding: 13px 0 13px 0;"><span style="padding-bottom: 13px; font-weight: bold; font-size: 18px;">${name}</span><br/><span style="font-size: 12px">${value}</span></td></tr>`;
    })
    .join('')}`;
};

const getDealFooter = () => {
  return '<tr><td style="padding: 13px 0 13px 0;"><span style="padding-bottom: 13px; font-weight: bold; font-size: 18px;">Contact support:</span><br/><span style="font-size: 12px; padding-bottom: 13px"><a style="color: #1a0c2b;" href="mailto:info@tymio.com">mailto:info@tymio.com</a></span><br/><span style="font-size: 12px"><a style="color: #1a0c2b;" href="https://tymio.com">https://tymio.com ©</a></span></td></tr></tr></table>';
};

const getDealHeader = (type) => {
  let header;
  switch (type) {
    case 'initiation':
      header = 'Trigger: deal initiation';
      break;
    case 'expiration':
      header = 'Trigger: deal expiration';
      break;
    default:
      break;
  }
  return `<table width="520px" border="0" cellspacing="0" cellpadding="0" align="center" style="font-family: 'Poppins', Arial, sans-serif; color: #1a0c2b; word-wrap: break-word;"><tr><td><img src="https://cdn.discordapp.com/attachments/758266712251826246/1100735712665538641/Logo_1.png" alt="logoTymio" style="height: 16px; width: 59px;" /></td><tr><td style="text-align: center; border-bottom: 1px solid #1a0c2b; padding-bottom: 20px; font-size: 16px;">${header}</td></tr>`;
};

const getDealInitiationRows = (order) => {
  return [
    {
      name: 'From:',
      value: `TYMIO “info@tymio.com”`,
    },
    {
      name: 'Subject:',
      value: `Order active: ${order.direction.toUpperCase()} ${
        order.amount
      } ETH for ${order.price} USDC, Earn ${order.recieve.toFixed(2)}$`,
    },
    {
      name: 'You have made a TYMIO transaction, please find details below.',
      value: null,
      type: 'text',
    },
    {
      name: 'Deal date:',
      value: `${formatDate(order.createdAt, 'utc')} ${formatTime(
        order.createdAt,
        'utc'
      )} UTC`,
    },
    {
      name: 'Asset:',
      value: `${order.amount} ETH`,
    },
    {
      name: 'ETH index price on deal date:',
      value: `${order.start_index_price.toFixed(2)}`,
    },
    {
      name: 'Deposit tx:',
      value: `${BLOCK_EXPLORER}/tx/${order.user_payment_tx_hash}`,
      type: 'link',
    },
    {
      name: 'Deposit wallet:',
      value: `${BLOCK_EXPLORER}/address/${order.from}`,
      type: 'link',
    },
    {
      name: 'Earn:',
      value: `${order.recieve.toFixed(2)}$`,
    },
    {
      name: 'APR:',
      value: `${order.apr}%`,
    },
    {
      name: 'Status:',
      value: `${
        order.status === 'created' || order.status === 'pending_approve'
          ? 'Active'
          : 'Complete'
      }`,
    },
    {
      name: 'Settlement date:',
      value: `${formatDate(order.execute_date, 'utc')} ${formatTime(
        order.execute_date,
        'utc'
      )} UTC`,
    },
    {
      name: 'Time to settlement:',
      value: getTimeLeft(order.createdAt, order.execute_date),
    },
    {
      name: 'Contract details:',
      value: order.contract_text,
    },
  ];
};

const getDealExpirationRows = (order) => {
  return [
    {
      name: 'From:',
      value: `TYMIO “info@tymio.com”`,
    },
    {
      name: 'Subject:',
      value: `Order active: ${order.direction.toUpperCase()} ${
        order.amount
      } ETH for ${order.price} USDC, Earn ${order.recieve.toFixed(2)}$`,
    },
    {
      name: 'You have made a TYMIO transaction, please find details below.',
      value: null,
      type: 'text',
    },
    {
      name: 'Deal date:',
      value: `${formatDate(order.createdAt, 'utc')} ${formatTime(
        order.createdAt,
        'utc'
      )} UTC`,
    },
    {
      name: 'Asset:',
      value:
        order.direction === 'sell'
          ? `${order.amount} ETH`
          : `${order.amount * order.price} USDC`,
    },
    {
      name: 'ETH index price on deal date:',
      value: `${order.start_index_price.toFixed(2)}`,
    },
    {
      name: 'Deposit tx:',
      value: `${BLOCK_EXPLORER}/tx/${order.user_payment_tx_hash}`,
      type: 'link',
    },
    {
      name: 'Deposit wallet:',
      value: `${BLOCK_EXPLORER}/address/${order.from}`,
      type: 'link',
    },
    {
      name: 'Earn:',
      value: `${order.recieve.toFixed(2)}$`,
    },
    // TODO
    // {
    //   name: 'APR:',
    //   value: `${order.apr}%`,
    // },
    {
      name: 'Settlement date:',
      value: `${formatDate(order.settlement_date, 'utc')} ${formatTime(
        order.settlement_date,
        'utc'
      )} UTC`,
    },
    {
      name: 'Time to settlement:',
      value: getTimeLeft(order.createdAt, order.execute_date),
    },
    {
      name: 'Contract details:',
      value: order.contract_text,
    },
    {
      name: 'ETH index price on settlement date:',
      value: `${order.end_index_price.toFixed(2)}`,
    },
    {
      name: 'Order executed:',
      value: order.order_executed ? 'Yes' : 'No',
    },
    {
      name: 'Status:',
      value: `${order.status === 'approved' ? 'Paid' : 'Complete'}`,
    },
    {
      name: 'Payout:',
      value:
        order.payout_currency === 'USDC'
          ? `${smartRound(order.payout_usdc)} USDC`
          : `${smartRound(order.payout_eth)} ETH`,
    },
    {
      name: 'Payout tx:',
      value: `${BLOCK_EXPLORER}/tx/${order.payout_tx}`,
      type: 'link',
    },
    {
      name: 'Total earned with  TYMIO:',
      value: `${order.total.earned.toFixed(2)}$ in ${
        order.total.orders
      } orders`,
    },
  ];
};

const getSubject = (type) => {
  switch (type) {
    case 'transaction_notifications':
      return 'Transaction notification';
    case 'news':
      return 'TYMIO news & updates';
    default:
      return '';
  }
};

module.exports = {
  sendMail,
  getDealExpirationBody,
  getDealInitiationBody,
  getSubject,
};
