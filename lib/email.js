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
    req: { body: { to, subject }, headers: {}, socket: {} },
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
      to,
      subject,
      text,
      html,
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
    const body = getDealBody(rows, 'expiration');
    const footer = getDealFooter('expiration');
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
    const body = getDealBody(rows, 'initiation');
    const footer = getDealFooter('initiation');
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

const getDealBody = (rows, type) => {
  if (type === 'initiation') {
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
  }
  if (type === 'expiration') {
    return `
    <tr>
    <td
      style="
        color: #c9e68c;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        vertical-align: bottom;
        padding-bottom: 15px;
        border-bottom: 1px solid #827a95;
      "
    >
      ${rows.earn.label}
    </td>
    <td
      style="
        text-align: end;
        color: #c9e68c;
        font-size: 40px;
        font-style: normal;
        font-weight: 500;
        line-height: 110%; /* 44px */
        letter-spacing: 0.4px;
        padding-bottom: 15px;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.earn.value}
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #c9e68c;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        vertical-align: bottom;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.apr.label}
    </td>
    <td
      style="
        text-align: end;
        color: #c9e68c;
        font-size: 40px;
        font-style: normal;
        font-weight: 500;
        line-height: 110%;
        letter-spacing: 0.4px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.apr.value}
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.status.label}
    </td>
    <td
      style="
        text-align: end;
        color: #e6e2ee;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.status.value}
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.payout_tx.label}
    </td>
    <td
      style="
        text-align: end;
        color: #a180ff;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
      <a
        href="${rows.payout_tx.value}"
        style="
          text-decoration: none;
          color: #a180ff;
          font-size: 17px;
          font-style: normal;
          font-weight: 400;
          line-height: 140%;
          letter-spacing: 0.34px;
        "
        target="_blank"
        >Open
        <img
                  src="https://cdn.discordapp.com/attachments/758266712251826246/1167090139621756978/arrow_link.png?ex=654cdc64&is=653a6764&hm=22f9ce84fead87fdd06b46987688d2ff068a93d46e13cfbe6ca2e43a58147c39&"
                  alt="arrow"
                />
      </a>
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.deal_date.label}
    </td>
    <td
      style="
        text-align: end;
        color: #e6e2ee;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.deal_date.value}
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.asset.label}
    </td>
    <td
      style="
        text-align: end;
        color: #e6e2ee;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.asset.value}
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.start_index_price.label}
    </td>
    <td
      style="
        text-align: end;
        color: #e6e2ee;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.start_index_price.value}
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.deposit_tx.label}
    </td>
    <td
      style="
        text-align: end;
        color: #a180ff;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
      <a
        href="${rows.deposit_tx.value}"
        style="
          text-decoration: none;
          color: #a180ff;
          font-size: 17px;
          font-style: normal;
          font-weight: 400;
          line-height: 140%;
          letter-spacing: 0.34px;
        "
        target="_blank"
        >Open
        <img
        src="https://cdn.discordapp.com/attachments/758266712251826246/1167090139621756978/arrow_link.png?ex=654cdc64&is=653a6764&hm=22f9ce84fead87fdd06b46987688d2ff068a93d46e13cfbe6ca2e43a58147c39&"
        alt="arrow"
      />
      </a>
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.deposit_wallet.label}
    </td>
    <td
      style="
        text-align: end;
        color: #a180ff;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
      <a
        href="${rows.deposit_wallet.value}"
        style="
          text-decoration: none;
          color: #a180ff;
          font-size: 17px;
          font-style: normal;
          font-weight: 400;
          line-height: 140%;
          letter-spacing: 0.34px;
        "
        target="_blank"
        >Open
        <img
                  src="https://cdn.discordapp.com/attachments/758266712251826246/1167090139621756978/arrow_link.png?ex=654cdc64&is=653a6764&hm=22f9ce84fead87fdd06b46987688d2ff068a93d46e13cfbe6ca2e43a58147c39&"
                  alt="arrow"
                />
      </a>
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.settlement_date.label}
    </td>
    <td
      style="
        text-align: end;
        color: #e6e2ee;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.settlement_date.value}
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.time_to_settlement.label}
    </td>
    <td
      style="
        text-align: end;
        color: #e6e2ee;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.time_to_settlement.value}
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="3"
    >
      <span>${rows.contract_details.label}</span> <br />
      <span
        style="
          text-align: end;
          color: #e6e2ee;
          font-size: 17px;
          font-style: normal;
          font-weight: 400;
          line-height: 140%;
          letter-spacing: 0.34px;
        "
        colspan="2"
      >
      ${rows.contract_details.value}
      </span>
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.end_index_price.label}
    </td>
    <td
      style="
        text-align: end;
        color: #e6e2ee;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.end_index_price.value}
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.order_executed.label}
    </td>
    <td
      style="
        text-align: end;
        color: #e6e2ee;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.order_executed.value}
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #c9e68c;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        vertical-align: bottom;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.total_earned.label}
    </td>
    <td
      style="
        text-align: end;
        color: #c9e68c;
        font-size: 40px;
        font-style: normal;
        font-weight: 500;
        line-height: 110%;
        letter-spacing: 0.4px;
        padding: 15px 0 15px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.total_earned.value}
    </td>
  </tr>
    `;
  }
};

const getDealFooter = (type) => {
  if (type === 'initiation') {
    return '<tr><td style="padding: 13px 0 13px 0;"><span style="padding-bottom: 13px; font-weight: bold; font-size: 18px;">Contact support:</span><br/><span style="font-size: 12px; padding-bottom: 13px"><a style="color: #1a0c2b;" href="mailto:info@tymio.com">mailto:info@tymio.com</a></span><br/><span style="font-size: 12px"><a style="color: #1a0c2b;" href="https://tymio.com">https://tymio.com ©</a></span></td></tr></tr></tbody></table></div>';
  }
  if (type === 'expiration') {
    return `<tr>
    <td
      style="
        width: 33.33%;
        text-align: start;
        color: #827a95;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding-top: 60px;
      "
    >
      Contact support
    </td>
    <td
      style="
        width: 33.33%;
        text-align: center;
        color: #a180ff;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding-top: 60px;
      "
    >
      <a
        style="
          text-decoration: none;
          color: #a180ff;
          font-size: 17px;
          font-style: normal;
          font-weight: 400;
          line-height: 140%;
          letter-spacing: 0.34px;
          padding-top: 60px;
        "
        href="mailto:info@Tymio.com"
        target="_blank"
        >info@Tymio.com</a
      >
    </td>
    <td
      style="
        width: 33.33%;
        text-align: end;
        color: #a180ff;
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding-top: 60px;
      "
    >
      <a
        style="
          text-decoration: none;
          color: #a180ff;
          font-size: 17px;
          font-style: normal;
          font-weight: 400;
          line-height: 140%;
          letter-spacing: 0.34px;
          padding-top: 60px;
        "
        target="_blank"
        href="https://tymio.com/"
        >Tymio.com</a
      >
    </td>
  </tr>
</tbody>
</table>
</div>`;
  }
};

const getDealHeader = (type) => {
  if (type === 'initiation') {
    return `<table width="520px" border="0" cellspacing="0" cellpadding="0" align="center" style="font-family: 'Poppins', Arial, sans-serif; color: #1a0c2b; word-wrap: break-word;"><tr><td><img src="https://cdn.discordapp.com/attachments/758266712251826246/1100735712665538641/Logo_1.png" alt="logoTymio" style="height: 16px; width: 59px;" />`;
  }
  if (type === 'expiration') {
    return `
  <div style="
    padding: 60px;
    background: #2b1c4d;
    font-family: 'Poppins', Arial, sans-serif;
  "> 
    <table style="border-collapse: collapse; width: 480px; margin: auto;">
      <tbody>
        <tr>
          <td
            colspan="3"
            style="
              font-size: 40px;
              font-style: normal;
              font-weight: 500;
              line-height: 110%;
              letter-spacing: 0.4px;
              color: #e6e2ee;
              padding-bottom: 60px;
            ">
            Your Tymio transaction is settled, please find details below:
          </td>
        </tr>
    `;
  }
};

const getDealInitiationRows = (order) => {
  return [
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
  return {
    earn: {
      label: 'Earn',
      value: `${order.recieve.toFixed(2)}$`,
    },
    apr: {
      label: 'APR',
      value: `${order.apr}%`,
    },
    status: {
      label: 'Status',
      value: `${
        order.status === 'created' || order.status === 'pending_approve'
          ? 'Active'
          : 'Paid'
      }`,
    },
    payout_tx: {
      label: 'Payout tx',
      value: `${BLOCK_EXPLORER}/tx/${order.payout_tx}`,
    },
    deal_date: {
      label: 'Deal date',
      value: `${formatDate(order.createdAt, 'dot')}, ${formatTime(
        order.createdAt,
        'utc'
      )} UTC`,
    },
    asset: {
      label: 'Asset',
      value:
        order.direction === 'sell'
          ? `${order.amount} ${order.token_symbol}`
          : `${order.amount * order.price} USDC`,
    },
    start_index_price: {
      label: `${order.token_symbol} index price on deal date`,
      value: `${order.start_index_price.toFixed(0)}`,
    },
    deposit_tx: {
      label: 'Deposit tx',
      value: `${BLOCK_EXPLORER}/tx/${order.user_payment_tx_hash}`,
    },
    deposit_wallet: {
      label: 'Deposit wallet',
      value: `${BLOCK_EXPLORER}/address/${order.from}`,
    },
    settlement_date: {
      label: 'Settlement date',
      value: `${formatDate(order.settlement_date, 'dot')}, ${formatTime(
        order.settlement_date,
        'utc'
      )} UTC`,
    },
    time_to_settlement: {
      label: 'Time to settlement',
      value: getTimeLeft(order.createdAt, order.execute_date),
    },
    contract_details: {
      label: 'Contract details',
      value: order.contract_text,
    },
    end_index_price: {
      label: `${order.token_symbol} index price on settlement date`,
      value: `${order.end_index_price.toFixed(0)}`,
    },
    order_executed: {
      label: 'Order executed',
      value: order.order_executed ? 'Yes' : 'No',
    },
    total_earned: {
      label: `Total earned with Tymio in ${order.total.orders} orders`,
      value: `$${order.total.earned.toFixed(2)}`,
    },
  };
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
