console.log('=== BOT INICIANDO ===');
console.log('TELEGRAM_TOKEN:', process.env.TELEGRAM_TOKEN ? 'OK' : 'NÃO ENCONTRADO');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'OK' : 'NÃO ENCONTRADO');
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const SYSTEM_PROMPT = `Você é o Professor Pace, um treinador de corrida experiente e didático.
Seu aluno vai correr 30km no dia 26/07/2026. Faltam 79 dias.
Planeje treinos progressivos, use tom professoral e motivador,
e adapte o plano conforme o aluno reportar seus treinos.`;

const historicos = {};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text;

  if (!historicos[chatId]) {
    historicos[chatId] = model.startChat({
      history: [],
      generationConfig: { maxOutputTokens: 1024 },
      systemInstruction: SYSTEM_PROMPT,
    });
  }

  const resultado = await historicos[chatId].sendMessage(texto);
  const resposta = resultado.response.text();

  bot.sendMessage(chatId, resposta);
});

console.log('Bot iniciado! Aguardando mensagens...');
