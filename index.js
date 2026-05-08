console.log('=== BOT INICIANDO ===');
console.log('TELEGRAM_TOKEN:', process.env.TELEGRAM_TOKEN ? 'OK' : 'NÃO ENCONTRADO');
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'OK' : 'NÃO ENCONTRADO');

const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');

const SYSTEM_PROMPT = `Você é o Professor Pace, um treinador de corrida experiente e didático.
Seu aluno vai correr 30km no dia 26/07/2026. Faltam 79 dias.
Planeje treinos progressivos, use tom professoral e motivador,
e adapte o plano conforme o aluno reportar seus treinos.`;

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const historicos = {};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text;

  if (!historicos[chatId]) {
    historicos[chatId] = [];
  }

  historicos[chatId].push({ role: 'user', content: texto });

  try {
    const resultado = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...historicos[chatId],
      ],
      max_tokens: 1024,
    });

    const resposta = resultado.choices[0].message.content;
    historicos[chatId].push({ role: 'assistant', content: resposta });
    bot.sendMessage(chatId, resposta);
  } catch (err) {
    console.error('Erro ao chamar Groq:', err.message);
    bot.sendMessage(chatId, 'Ocorreu um erro, tente novamente.');
  }
});

console.log('Bot iniciado! Aguardando mensagens...');
