const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

const { formatDate, formatTime, getTimeLeft } = require('./dates');
const { writeLog, updateLog } = require('./logger');
const { parseError, smartRound } = require('./lib');
const { BLOCK_EXPLORERS } = require('../config/network');

dotenv.config();

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_AUTH_USER = process.env.EMAIL_AUTH_USER;
const EMAIL_AUTH_PASS = process.env.EMAIL_AUTH_PASS;

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
  const timeToSettlement = getTimeLeft(
    order.settlement_date,
    order.execute_date
  );
  order = { ...order, timeToSettlement };
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
    return `
    <tr>
    <td
      style="
        color: #827A95;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        vertical-align: bottom;
        padding-bottom: 10px;
        border-bottom: 1px solid #827a95;
      "
    >
      ${rows.earn.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 24px;
        font-style: normal;
        font-weight: 500;
        line-height: 110%; /* 44px */
        letter-spacing: 0.4px;
        padding-bottom: 10px;
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
        color: #827A95;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        vertical-align: bottom;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.apr.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 24px;
        font-style: normal;
        font-weight: 500;
        line-height: 110%;
        letter-spacing: 0.4px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.status.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.deal_date.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.asset.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.start_index_price.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.deposit_tx.label}
    </td>
    <td
      style="
        text-align: end;
        color: #FC087C;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
      <a
        href="${rows.deposit_tx.value}"
        style="
          text-decoration: none;
          color: #FC087C;
          font-size: 16px;
          font-style: normal;
          font-weight: 400;
          line-height: 140%;
          letter-spacing: 0.34px;
        "
        target="_blank"
        >Open
        <img
        src="https://media.discordapp.net/attachments/758266712251826246/1169891203924377600/Group_76.png?ex=65570d16&is=65449816&hm=a50c2e2f7c2d03fe0c2e5bb00f6fdf5cacaae2e38649469c9568d09f07dc8aef&="
        alt="arrow"
      />
      </a>
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.deposit_wallet.label}
    </td>
    <td
      style="
        text-align: end;
        color: #FC087C;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
      <a
        href="${rows.deposit_wallet.value}"
        style="
          text-decoration: none;
          color: #FC087C;
          font-size: 16px;
          font-style: normal;
          font-weight: 400;
          line-height: 140%;
          letter-spacing: 0.34px;
        "
        target="_blank"
        >Open
        <img
                  src="https://media.discordapp.net/attachments/758266712251826246/1169891203924377600/Group_76.png?ex=65570d16&is=65449816&hm=a50c2e2f7c2d03fe0c2e5bb00f6fdf5cacaae2e38649469c9568d09f07dc8aef&="
                  alt="arrow"
                />
      </a>
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.settlement_date.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.time_to_settlement.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="3"
    >
      <span>${rows.contract_details.label}</span> <br />
      <span
        style="
          text-align: end;
          color: #1C102F;
          font-size: 16px;
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
    `;
  }
  if (type === 'expiration') {
    return `
    <tr>
    <td
      style="
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        vertical-align: bottom;
        padding-bottom: 10px;
        border-bottom: 1px solid #827a95;
      "
    >
      ${rows.earn.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 24px;
        font-style: normal;
        font-weight: 500;
        line-height: 110%; /* 44px */
        letter-spacing: 0.4px;
        padding-bottom: 10px;
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
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        vertical-align: bottom;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.apr.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 24px;
        font-style: normal;
        font-weight: 500;
        line-height: 110%;
        letter-spacing: 0.4px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.status.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.payout_tx.label}
    </td>
    <td
      style="
        text-align: end;
        color: #FC087C;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
      <a
        href="${rows.payout_tx.value}"
        style="
          text-decoration: none;
          color: #FC087C;
          font-size: 16px;
          font-style: normal;
          font-weight: 400;
          line-height: 140%;
          letter-spacing: 0.34px;
        "
        target="_blank"
        >Open
        <img
                  src="https://media.discordapp.net/attachments/758266712251826246/1169891203924377600/Group_76.png?ex=65570d16&is=65449816&hm=a50c2e2f7c2d03fe0c2e5bb00f6fdf5cacaae2e38649469c9568d09f07dc8aef&="
                  alt="arrow"
                />
      </a>
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.deal_date.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.asset.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.start_index_price.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.deposit_tx.label}
    </td>
    <td
      style="
        text-align: end;
        color: #FC087C;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
      <a
        href="${rows.deposit_tx.value}"
        style="
          text-decoration: none;
          color: #FC087C;
          font-size: 16px;
          font-style: normal;
          font-weight: 400;
          line-height: 140%;
          letter-spacing: 0.34px;
        "
        target="_blank"
        >Open
        <img
        src="https://media.discordapp.net/attachments/758266712251826246/1169891203924377600/Group_76.png?ex=65570d16&is=65449816&hm=a50c2e2f7c2d03fe0c2e5bb00f6fdf5cacaae2e38649469c9568d09f07dc8aef&="
        alt="arrow"
      />
      </a>
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.deposit_wallet.label}
    </td>
    <td
      style="
        text-align: end;
        color: #FC087C;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
      <a
        href="${rows.deposit_wallet.value}"
        style="
          text-decoration: none;
          color: #FC087C;
          font-size: 16px;
          font-style: normal;
          font-weight: 400;
          line-height: 140%;
          letter-spacing: 0.34px;
        "
        target="_blank"
        >Open
        <img
                  src="https://media.discordapp.net/attachments/758266712251826246/1169891203924377600/Group_76.png?ex=65570d16&is=65449816&hm=a50c2e2f7c2d03fe0c2e5bb00f6fdf5cacaae2e38649469c9568d09f07dc8aef&="
                  alt="arrow"
                />
      </a>
    </td>
  </tr>
  <tr>
    <td
      style="
        color: #827a95;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.settlement_date.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.time_to_settlement.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="3"
    >
      <span>${rows.contract_details.label}</span> <br />
      <span
        style="
          text-align: end;
          color: #1C102F;
          font-size: 16px;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.end_index_price.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.order_executed.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        padding: 10px 0;
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
        color: #1C102F;
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: 140%;
        letter-spacing: 0.34px;
        vertical-align: bottom;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
    >
    ${rows.total_earned.label}
    </td>
    <td
      style="
        text-align: end;
        color: #1C102F;
        font-size: 24px;
        font-style: normal;
        font-weight: 500;
        line-height: 110%;
        letter-spacing: 0.4px;
        padding: 10px 0;
        border-bottom: 1px solid #827a95;
      "
      colspan="2"
    >
    ${rows.total_earned.value}
    </td>
  </tr>
    `;
  }
};

const getDealFooter = (type) => {
  return `<tr>
    <td
      style="
        vertical-align: top;
        text-align: start;
        color: #827a95;
        font-size: 16px;
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
        vertical-align: top;
        text-align: left;
        color: #FC087C;
        font-size: 16px;
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
          color: #FC087C;
          font-size: 16px;
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
        vertical-align: top;
        text-align: end;
        color: #FC087C;
        font-size: 16px;
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
          color: #FC087C;
          font-size: 16px;
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
</div>
</div>`;
};

const getDealHeader = (type = 'initiation') => {
  return `
    <style scoped>
      @media only screen and (max-device-width: 576px) {
          div[class=wrapper] { 
              width: 335px !important;
              padding: 40px 20px !important;
          }
          table[class=table] { 
            max-width: 335px !important;
            table-layout: fixed !important;
            width: 100% !important;
        }
      }
    </style>
    <div style="background: #D9D0F1;">
    <div class="wrapper" style="
      padding: 60px;
      background: #D9D0F1;
      font-family: 'Poppins', Arial, sans-serif;
      width: 480px;
      margin: 0 auto;
    "> 
      <table class="table" style="border-collapse: collapse; margin: auto;">
        <tbody>
          <tr>
            <td
              colspan="3"
              style="
                font-size: 24px;
                font-style: normal;
                font-weight: 500;
                line-height: 140%;
                letter-spacing: 0.4px;
                color: #1C102F;
                padding-bottom: 60px;
              ">
              ${
                type === 'expiration'
                  ? 'Your Tymio transaction is settled, please find details below:'
                  : 'You have made Tymio transaction, please find details below:'
              }
            </td>
          </tr>
    `;
};

const getDealInitiationRows = (order) => {
  return {
    earn: {
      label: 'Earn',
      value: `$${order.recieve.toFixed(2)}`,
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
      value: `$${order.start_index_price.toFixed(0)}`,
    },
    deposit_tx: {
      label: 'Deposit tx',
      value: `${BLOCK_EXPLORERS[order.chain_id]}/tx/${
        order.user_payment_tx_hash
      }`,
    },
    deposit_wallet: {
      label: 'Deposit wallet',
      value: `${BLOCK_EXPLORERS[order.chain_id]}/address/${order.from}`,
    },
    settlement_date: {
      label: 'Settlement date',
      value: `${formatDate(order.execute_date, 'dot')}, ${formatTime(
        order.execute_date,
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
  };
};

const getDealExpirationRows = (order) => {
  return {
    earn: {
      label: 'Earned',
      value: `$${order.recieve.toFixed(2)}`,
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
      value: `${BLOCK_EXPLORERS[order.chain_id]}/tx/${order.payout_tx}`,
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
      value: `$${order.start_index_price.toFixed(0)}`,
    },
    deposit_tx: {
      label: 'Deposit tx',
      value: `${BLOCK_EXPLORERS[order.chain_id]}/tx/${
        order.user_payment_tx_hash
      }`,
    },
    deposit_wallet: {
      label: 'Deposit wallet',
      value: `${BLOCK_EXPLORERS[order.chain_id]}/address/${order.from}`,
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
      value: getTimeLeft(order.createdAt, order.settlement_date),
    },
    contract_details: {
      label: 'Contract details',
      value: order.contract_text,
    },
    end_index_price: {
      label: `${order.token_symbol} index price on settlement date`,
      value: `$${order.end_index_price.toFixed(0)}`,
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
