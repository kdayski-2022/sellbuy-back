const db = require('../database');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError, getDaysDifference } = require('../lib/lib');

const getWeekIndex = (currentDate) => {
  startDate = new Date(currentDate.getFullYear(), 0, 1);
  var days = Math.floor((currentDate - startDate) / (24 * 60 * 60 * 1000));

  var weekNumber = Math.ceil(days / 7);
  return weekNumber;
};
const longestSeq = (arr) => {
  var len = 0,
    longestLen = -1,
    prev = null;
  for (var i = 0; i < arr.length; ++i) {
    if (prev == null || arr[i] - 1 === prev) ++len;
    else {
      if (len > longestLen) longestLen = len;
      len = 1;
    }
  }
  return longestLen > len ? longestLen : len;
};

const isValidAirdrop = async (airdrop, airdrop_participants) => {
  try {
    if (!airdrop) {
      throw new Error('Airdrop not found');
    }
    if (airdrop.participant_limit <= airdrop_participants.length) {
      throw new Error('Airdrop has reached the limit of participants');
    }
  } catch (e) {
    throw new Error(e.message);
  }
};

const areDealsMade = async (address) => {
  const user_orders = await db.models.Order.findAll({
    where: {
      from: address.toLowerCase(),
    },
    order: [['id', 'ASC']],
  });

  let lastOrder = null;
  Date.prototype.addDays = function (days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
  };
  let weekTimeline = [];
  for (const order of user_orders) {
    const orderDays = getDaysDifference(
      new Date(order.createdAt),
      new Date(order.execute_date)
    );
    lastOrder = order;
    let orderDate = new Date(order.createdAt);
    weekTimeline.push(getWeekIndex(orderDate));
    weekTimeline.push(getWeekIndex(orderDate.addDays(orderDays)));
  }

  return longestSeq([...new Set(weekTimeline)]) >= 3;
};

const updateAirdropParticipant = async (data, where) => {
  await db.models.AirdropParticipant.update({ ...data }, { where });
  const airdrop_participant = await db.models.AirdropParticipant.findOne({
    where,
  });
  return airdrop_participant;
};

const createAirdropParticipant = async (data) => {
  await db.models.AirdropParticipant.create({
    ...data,
  });

  const airdrop_participant = await db.models.AirdropParticipant.findOne({
    where: {
      ...data,
    },
  });
  return airdrop_participant;
};

const getAirdropParticipants = async (where) => {
  const airdrop_participants = await db.models.AirdropParticipant.findAll({
    where,
    order: [['id', 'ASC']],
  });
  return airdrop_participants;
};

const getAirdropParticipant = async (where) => {
  const airdrop_participant = await db.models.AirdropParticipant.findOne({
    where,
  });
  return airdrop_participant;
};

const getAirdrop = async (where) => {
  const airdrop = await db.models.Airdrop.findOne({
    where,
  });
  return airdrop;
};

const getOrders = async (where) => {
  where = where ? where : {};
  const orders = await db.models.Order.findAll({
    attributes: ['from'],
    where,
    order: [['id', 'ASC']],
    group: ['from', 'id'],
  });
  const uniqueOrders = orders.filter(
    (order, index, self) =>
      index === self.findIndex((o) => o.from === order.from)
  );
  const ordersWithIds = uniqueOrders.map((order, index) => ({
    id: index + 1,
    ...order,
  }));
  return ordersWithIds;
};

const getSerialNumber = async (address) => {
  const orders = await getOrders();
  const addresses = orders.map((order) => order.from);
  const serial_number = addresses.findIndex((addr) => addr === address) + 1;
  if (!serial_number) return addresses.length + 1;
  return serial_number;
};

class AirdropController {
  async getAirdrop(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getAirdrop',
      status: 'in progress',
      sessionInfo,
      req,
    });
    try {
      const airdrop = await getAirdrop({ active: true });

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data: { airdrop },
        sessionInfo,
      });
    } catch (e) {
      console.log(e);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        data: null,
        error: e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }

  async getAirdropParticipant(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getAirdrop',
      status: 'in progress',
      sessionInfo,
      req,
    });
    let { address } = req.params;
    address = address.toLowerCase();
    const { airdrop_id } = req.query;
    try {
      let airdrop_participant = await getAirdropParticipant({
        airdrop_id,
        address,
      });

      const deal_made = await areDealsMade(address);
      const serial_number = await getSerialNumber(address);
      airdrop_participant = await updateAirdropParticipant(
        { deal_made, serial_number },
        { airdrop_id, address }
      );

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data: { airdrop_participant },
        sessionInfo,
      });
    } catch (e) {
      console.log(e);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        data: null,
        error: e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }

  async addParticipantToAirdrop(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'addParticipantToAirdrop',
      status: 'in progress',
      sessionInfo,
      req,
    });
    let { address } = req.params;
    address = address.toLowerCase();
    const { airdrop_id } = req.body;
    try {
      const airdrop_participants = await getAirdropParticipants({
        airdrop_id,
        deal_made: true,
        link_shared: true,
      });
      const airdrop = await getAirdrop({ id: airdrop_id, active: true });
      let airdrop_participant = await getAirdropParticipant({
        airdrop_id,
        address,
      });

      await isValidAirdrop(airdrop, airdrop_participants);
      const deal_made = await areDealsMade(address);
      const serial_number = await getSerialNumber(address);

      if (!airdrop_participant) {
        airdrop_participant = await createAirdropParticipant({
          airdrop_id,
          address,
          deal_made,
          serial_number,
        });
      } else {
        airdrop_participant = await updateAirdropParticipant(
          { serial_number, deal_made },
          { airdrop_id, address }
        );
      }

      updateLog(logId, { status: 'success' });
      res.json({ success: true, sessionInfo, data: { airdrop_participant } });
    } catch (e) {
      const error =
        e && e.message ? e.message : e?.response?.data?.error?.message;
      console.log(error);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        error,
        sessionInfo,
      });
    }
  }
  async updateAirdropParticipant(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'updateAirdropParticipant',
      status: 'in progress',
      sessionInfo,
      req,
    });
    let { address } = req.params;
    address = address.toLowerCase();
    let { airdrop_id, link_shared, deal_made, share_link } = req.body;
    try {
      if (share_link) {
        link_shared = true;
      }
      const airdrop_participant = await updateAirdropParticipant(
        { link_shared, deal_made, share_link },
        { airdrop_id, address }
      );

      updateLog(logId, { status: 'success' });
      res.json({ success: true, sessionInfo, data: { airdrop_participant } });
    } catch (e) {
      const error =
        e && e.message ? e.message : e?.response?.data?.error?.message;
      console.log(error);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        error,
        sessionInfo,
      });
    }
  }
}

module.exports = new AirdropController();
