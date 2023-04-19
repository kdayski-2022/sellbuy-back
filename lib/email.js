const { writeLog, updateLog } = require('./logger');
const dotenv = require('dotenv');
const { parseError, smartRound } = require('./lib');
dotenv.config();

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_AUTH_USER = process.env.EMAIL_AUTH_USER;
const EMAIL_AUTH_PASS = process.env.EMAIL_AUTH_PASS;
const BLOCK_EXPLORER = process.env.BLOCK_EXPLORER;

const nodemailer = require('nodemailer');
const { getDaysDifference, formatDate, formatTime } = require('./dates');

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

    const res = await transporter.sendMail({
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

const parseTransactionDetails = (order, transactionHash) => {
  try {
    let rows = [
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
        value: Math.floor(order.start_index_price),
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
        value: `${Math.floor(order.recieve)}$`,
      },
      {
        name: 'Status:',
        value: 'Paid',
      },
    ];
    if (order.settlement_date) {
      rows.push(
        {
          name: 'Settlement date:',
          value: `${formatDate(order.settlement_date, 'utc')} ${formatTime(
            order.settlement_date,
            'utc'
          )} UTC`,
        },
        {
          name: 'Time to settlement:',
          value: getTimeLeft(order.createdAt, order.settlement_date),
        }
      );
    }
    if (order.end_index_price) {
      rows.push({
        name: 'ETH index price on settlement date:',
        value: Math.floor(order.end_index_price),
      });
    }
    if (order.direction === 'sell') {
      rows.push({
        name: 'Order executed:',
        value: order.order_executed ? 'Yes' : 'No',
      });
    }
    rows.push(
      {
        name: 'Payout:',
        value:
          order.payout_currency === 'USDC'
            ? `${smartRound(order.payout)} USDC`
            : `${smartRound(order.payout)} ETH`,
      },
      {
        name: 'Payout tx:',
        value: `${BLOCK_EXPLORER}/tx/${transactionHash}`,
        type: 'link',
      }
    );
    let html = '<ul>';
    rows.forEach(
      ({ name, value, type }) =>
        (html += `<li>${name}<br/>${
          type === 'link' ? `<a href=${value}>${value}</a>` : value
        }</li>`)
    );
    html += '</ul>';
    return html;
  } catch (e) {
    throw e;
  }
};

const getSubject = (type, order) => {
  switch (type) {
    case 'transaction_notifications':      
      return `Transaction notification`
    case 'news':
      return 'TYMIO news & updates';
    default:
      return '';
  }
};

const getUntilExpirationDays = (period) => {
  return getDaysDifference(Number(period)) > 1
    ? `${getDaysDifference(Number(period))} days`
    : `${getDaysDifference(Number(period))} day`;
};

const getText = (order, options) => {
  const { start_index_price } = options;
  let recieveETH = 0;
  if (parseFloat(order.recieve) && parseFloat(start_index_price)) {
    recieveETH =
      parseFloat(order.amount) +
      smartRound(parseFloat(order.recieve) / parseFloat(start_index_price));
  }
  const lock = parseFloat(order.amount) * parseFloat(order.price);
  const recieveUSDC = Math.floor(
    parseFloat(order.amount) * parseFloat(order.price) +
      parseFloat(order.recieve)
  );
  const USDC = Math.floor(parseFloat(order.price) * parseFloat(order.amount));
  const floorRecieve = Math.floor(parseFloat(order.recieve));
  const untilExpirationDays = getUntilExpirationDays(order.execute_date);
  const expirationDate = formatDate(order.execute_date);
  let message;
  if (order.direction === 'buy') {
    message = `You are going to lock ${lock} USDC for ${untilExpirationDays} to receive either ${recieveUSDC} USDC (${USDC} + ${floorRecieve}) if on the ${expirationDate} 8:00 UTC. ETH price will be above ${
      order.price
    }, or ${recieveETH} ETH (${order.amount} + ${smartRound(
      parseFloat(order.recieve) / parseFloat(start_index_price)
    )}) if ETH price will be below ${
      order.price
    }. Funds will be returned to your wallet automatically before ${expirationDate} 9:00 UTC.`;
  }

  if (order.direction === 'sell') {
    message = `You are going to lock ${
      order.amount
    } ETH for ${untilExpirationDays} to receive
		either ${recieveETH} ETH (${order.amount} + ${smartRound(
      parseFloat(order.recieve) / parseFloat(start_index_price)
    )}) if on the ${expirationDate} 8:00 UTC. ETH price will be below ${
      order.price
    }, or ${recieveUSDC} USDC (${USDC} + ${floorRecieve}) if ETH price will be above ${
      order.price
    }. Funds will be returned to your wallet automatically before ${expirationDate} 9:00 UTC.`;
  }
  return message;
};

module.exports = { sendMail, parseTransactionDetails, getSubject, getText };
