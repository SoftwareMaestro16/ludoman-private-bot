const bot = require('../bot');
const { handleProfile, handleDisconnectWallet, handleWalletConnection, handlePrivateChat } = require('./walletHandlers');
const { getUserById, addUser } = require('../db');
const { generateMainKeyboard } = require('./keyboardUtils');

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Unknown';
  const username = msg.from.username || 'NoUsername';

  const user = getUserById(chatId);

  if (!user) {
    addUser(chatId, name, username);
  }

  const address = user?.address || null;

  const text = address
    ? '✅ Ваш кошелек уже подключен. Используйте кнопки ниже:'
    : '☀️ Добро пожаловать! Пожалуйста, выберите Кошелек для подключения:';

  const keyboard = generateMainKeyboard(address);

  bot.sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: keyboard },
  });
});

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const callbackData = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;

  if (callbackData === 'Profile') {
    await handleProfile(chatId, messageId);
  } else if (callbackData === 'DisconnectWallet') {
    await handleDisconnectWallet(chatId, messageId);
  } else if (callbackData === 'PrivateChat') {
    await handlePrivateChat(chatId, messageId, bot)
  } else if (callbackData === 'BackToMenu') {
    await bot.editMessageText(
      '✅ Ваш кошелек уже подключен. Используйте кнопки ниже:',
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Профиль 👤', callback_data: 'Profile' },
            ],
            [
              { text: 'Приватный Чат 🌟', callback_data: 'PrivateChat' },
            ]
          ],
        },
      }
    );
  } else if (['Tonkeeper', 'MyTonWallet', 'TonHub'].includes(callbackData)) {
    await handleWalletConnection(chatId, callbackData, messageId);
  }
});

bot.on('chat_join_request', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  console.log(`Received join request from user ${userId} in chat ${chatId}`);

  const user = getUserById(userId);

  if (!user) {
    console.log(`User ${userId} not found in the database.`);
    return;
  }

  const requiredBalance = 500000;
  if (user.balance >= requiredBalance) {
    try {
      await bot.approveChatJoinRequest(chatId, userId);
      console.log(`Approved join request for user ${userId}.`);

      const firstName = msg.from.first_name || 'Участник';
      await bot.sendMessage(
        chatId,
        `🎉 Добро пожаловать, <b>${firstName}</b>, в наш приватный чат! 🌟\n\n`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error(`Failed to approve join request for user ${userId}:`, error);
    }
  } else {
    try {
      await bot.declineChatJoinRequest(chatId, userId);
      console.log(`Declined join request for user ${userId} due to insufficient balance.`);
    } catch (error) {
      console.error(`Failed to decline join request for user ${userId}:`, error);
    }
  }
});