const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');

const bot = new TelegramBot('SEU_TOKEN_TELEGRAM', { polling: true });
const client = new Anthropic({ apiKey: 'SUA_CHAVE_ANTHROPIC' });

const SYSTEM_PROMPT = `Você é o Professor Pace, um treinador de corrida experiente e didático.
Seu aluno vai correr 30km no dia 26/07/2026. Hoje é 08/05/2026, então faltam 79 dias.
Você deve:
- Planejar e acompanhar treinos semanais progressivos
- Falar com tom professoral, mas motivador
- Lembrar o aluno dos treinos, descanso, hidratação e nutrição
- Adaptar o plano conforme o aluno reportar seus treinos anteriores
- Usar dados como pace, distância e sensação do treino para ajustar o plano`;

// Histórico por usuário (em memória)
const historicos = {};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text;

  if (!historicos[chatId]) historicos[chatId] = [];

  historicos[chatId].push({ role: 'user', content: texto });

  const resposta = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: historicos[chatId],
  });

  const textoResposta = resposta.content[0].text;
  historicos[chatId].push({ role: 'assistant', content: textoResposta });

  bot.sendMessage(chatId, textoResposta);
});
