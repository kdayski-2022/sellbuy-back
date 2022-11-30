const db = require('../database');

const getChatBySessionToken = async (sessionToken) => {
  return await db.models.Chat.findOne({
    where: { sessionToken },
  });
};

const getChat = async (chat, opts) => {
  const { sessionToken } = opts;
  if (chat) {
    await updateChat(chat, opts);
  } else {
    await createChat(opts);
  }

  chat = await db.models.Chat.findOne({
    where: { sessionToken },
  });

  return chat;
};

const updateChat = async (chat, opts) => {
  const { message, unread, userAddress, sender, sessionToken } = opts;
  await db.models.Chat.update(
    {
      messages: JSON.stringify([
        ...JSON.parse(chat.messages),
        { message, sender, unread },
      ]),
      userAddress,
    },
    { where: { sessionToken } }
  );
};

const createChat = async (opts) => {
  const { message, unread, userAddress, sender, sessionToken } = opts;
  await db.models.Chat.create({
    sessionToken,
    userAddress,
    messages: JSON.stringify([{ message, unread, sender }]),
  });
};

const readChat = async (chat, opts) => {
  const { userAddress, sessionToken } = opts;

  if (chat && chat.messages) {
    await db.models.Chat.update(
      {
        messages: JSON.stringify(
          JSON.parse(chat.messages).map((message) => ({
            ...message,
            unread: false,
          }))
        ),
        userAddress,
      },
      { where: { sessionToken } }
    );
  }

  return await db.models.Chat.findOne({
    where: { sessionToken },
  });
};

module.exports = { getChat, getChatBySessionToken, readChat };
