const db = require('./database');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
  },
  enabledTransports: ['ws', 'wss'],
});

const { getChat, getChatBySessionToken, readChat } = require('./lib/chat');

const SOCKET_PORT = process.env.SOCKET_PORT;
const NEW_CHAT_MESSAGE_EVENT = 'newChatMessage';
const OPEN_CHAT = 'openChat';
const ERROR = 'error';

function Socket() {
  io.on('connection', async (socket) => {
    const { sessionToken } = socket.handshake.query;
    socket.join(sessionToken);
    let chat = await db.models.Chat.findOne({
      where: { sessionToken },
    });

    io.in(sessionToken).emit('init', chat ? JSON.parse(chat.messages) : []);

    socket.on(NEW_CHAT_MESSAGE_EVENT, async (data) => {
      let chat_access = true;
      const { sender, message, unread } = data;
      const { userAddress } = await db.models.UserSession.findOne({
        where: { sessionToken },
      });
      const opts = { sender, unread, message, userAddress, sessionToken };
      if (userAddress) {
        const user = await db.models.User.findOne({
          where: { address: userAddress },
        });
        if (user) chat_access = user.chat_access;
      }

      if (chat_access) {
        await telegram.sendToSupport({
          userAddress,
          message,
          sessionToken,
        });
        chat = await getChatBySessionToken(sessionToken);
        chat = await getChat(chat, opts);

        io.in(sessionToken).emit(
          NEW_CHAT_MESSAGE_EVENT,
          JSON.parse(chat.messages)
        );
      } else {
        io.in(sessionToken).emit(ERROR, 'You are banned');
      }
    });

    socket.on(OPEN_CHAT, async () => {
      const userSession = await db.models.UserSession.findOne({
        where: { sessionToken },
      });
      if (userSession) {
        const { userAddress } = userSession;
        const opts = { userAddress, sessionToken };

        chat = await getChatBySessionToken(sessionToken);
        chat = await readChat(chat, opts);
      }
      io.in(sessionToken).emit(
        OPEN_CHAT,
        chat ? JSON.parse(chat.messages) : []
      );
    });

    socket.on('disconnect', () => {
      socket.leave(sessionToken);
    });
  });
  server.listen(SOCKET_PORT, () => {
    console.log(`Listen socket port ${SOCKET_PORT}`);
  });
}

module.exports = { Socket, io };
