const db = require('../database');

const createMessage = async (opts) => {
  await db.models.Message.create(opts);
};

const getSessionByMessageId = async (message_id) => {
  const { sessionToken } = await db.models.Message.findOne({
    where: { message_id: String(message_id) },
  });
  return sessionToken;
};

module.exports = { createMessage, getSessionByMessageId };
