const db = require('../database');

const createMessage = async (opts) => {
  await db.models.Message.create(opts);
};

const getSessionByMessageId = async (message_id) => {
  const data = await db.models.Message.findOne({
    where: { message_id: String(message_id) },
  });
  if (data) return data.sessionToken;
  else return data;
};

module.exports = { createMessage, getSessionByMessageId };
