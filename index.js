console.log('=== BOT INICIANDO ===');
console.log('TELEGRAM_TOKEN:', process.env.TELEGRAM_TOKEN ? 'OK' : 'NÃO ENCONTRADO');
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'OK' : 'NÃO ENCONTRADO');

const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODELO = 'llama-3.3-70b-versatile';
const MAX_HISTORICO = 6;
const MAX_TOKENS = 1024;
const DADOS_PATH = path.join(__dirname, 'treinos.json');

// ─────────────────────────────────────────
// PERSISTÊNCIA DE TREINOS
// ─────────────────────────────────────────

function carregarDados() {
  if (!fs.existsSync(DADOS_PATH)) {
    fs.writeFileSync(DADOS_PATH, JSON.stringify({ treinos: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DADOS_PATH, 'utf8'));
}

function salvarDados(dados) {
  fs.writeFileSync(DADOS_PATH, JSON.stringify(dados, null, 2));
}

function registrarTreino(treino) {
  const dados = carregarDados();
  dados.treinos.push({
    ...treino,
    registradoEm: new Date().toISOString(),
  });
  salvarDados(dados);
}

// ─────────────────────────────────────────
// CÁLCULOS DE DESEMPENHO
// ─────────────────────────────────────────

// Converte "6:30" (mm:ss) para segundos
function paceParaSegundos(pace) {
  if (!pace || typeof pace !== 'string') return null;
  const match = pace.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

// Converte segundos de volta para "mm:ss"
function segundosParaPace(segundos) {
  if (!segundos) return '—';
  const min = Math.floor(segundos / 60);
  const seg = Math.round(segundos % 60).toString().padStart(2, '0');
  return `${min}:${seg}`;
}

function calcularEstatisticas() {
  const dados = carregarDados();
  const treinos = dados.treinos;

  if (treinos.length === 0) return null;

  const totalTreinos = treinos.length;
  const totalKm = treinos.reduce((acc, t) => acc + (t.distancia || 0), 0);

  const comPace = treinos.filter(t => t.pace && paceParaSegundos(t.pace));
  const mediaPaceSegundos = comPace.length > 0
    ? comPace.reduce((acc, t) => acc + paceParaSegundos(t.pace), 0) / comPace.length
    : null;

  // Agrupamento por semana
  const porSemana = {};
  treinos.forEach(t => {
    const semana = t.semana || 'sem_semana';
    if (!porSemana[semana]) porSemana[semana] = { km: 0, paces: [], treinos: 0 };
    porSemana[semana].km += t.distancia || 0;
    porSemana[semana].treinos += 1;
    if (t.pace && paceParaSegundos(t.pace)) {
      porSemana[semana].paces.push(paceParaSegundos(t.pace));
    }
  });

  const evolucaoSemanal = Object.entries(porSemana).map(([semana, dados]) => ({
    semana,
    km: parseFloat(dados.km.toFixed(1)),
    treinos: dados.treinos,
    mediaPace: dados.paces.length > 0
      ? segundosParaPace(dados.paces.reduce((a, b) => a + b, 0) / dados.paces.length)
      : '—',
  }));

  return {
    totalTreinos,
    totalKm: parseFloat(totalKm.toFixed(1)),
    mediaPace: segundosParaPace(mediaPaceSegundos),
    evolucaoSemanal,
    ultimoTreino: treinos[treinos.length - 1],
  };
}

function formatarRelatorio() {
  const stats = calcularEstatisticas();
  if (!stats) return '📭 Nenhum treino registrado ainda.';

  let texto = `📊 <b>Seu Desempenho Geral</b>\n\n`;
  texto += `🏃 Treinos registrados: <b>${stats.totalTreinos}</b>\n`;
  texto += `📏 Total de km: <b>${stats.totalKm} km</b>\n`;
  texto += `⏱️ Pace médio geral: <b>${stats.mediaPace}/km</b>\n\n`;
  texto += `📅 <b>Evolução por Semana:</b>\n`;

  stats.evolucaoSemanal.forEach(s => {
    texto += `\n• Semana ${s.semana}: ${s.km} km em ${s.treinos} treino(s) — pace médio ${s.mediaPace}/km`;
  });

  if (stats.ultimoTreino) {
    texto += `\n\n🕐 <b>Último treino:</b> ${stats.ultimoTreino.descricao || '—'} (${stats.ultimoTreino.distancia || '?'} km a ${stats.ultimoTreino.pace || '?'}/km)`;
  }

  return texto;
}

// ─────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────

const SYSTEM_PROMPT_BASE = `Você é o Professor Pace, um treinador de corrida experiente, didático e exigente.

Seu aluno tem o seguinte perfil:
- Histórico de meias maratonas
- Base muscular forte
- 100 kg / estrutura atlética
- Corre 4x por semana
- Faz musculação diária
- Meta: correr 30km no dia 26/07/2026 e 10km sub 55 minutos

Hoje é 08/05/2026. Estamos na SEMANA 2 do plano de 13 semanas.

# ORGANIZAÇÃO SEMANAL FIXA
- Segunda: Velocidade / tiros
- Terça: Cardio leve (40 min caminhada inclinada) + musculação pesada de perna
- Quarta: Ritmo / pace
- Quinta: Rodagem leve
- Sexta: Cardio moderado (30 min escada ou esteira forte) + musculação pesada de perna
- Sábado ou Domingo: Longão
- Musculação leve de perna nas segundas (dia de tiro)
- Sem destruir perna antes do longão

# REFERÊNCIA DE PACES
- Leve / Recuperação: 6:50 a 7:20/km
- Moderado / Ritmo: 6:00 a 6:20/km
- Forte: 5:25 a 5:50/km
- Tiros Curtos: 4:55 a 5:20/km
- Longão: 6:45 a 7:15/km
- Meta 10km Sub 1h: 5:59/km

# PLANO COMPLETO – 13 SEMANAS

SEMANA 1 (27/04 a 03/05) - CONCLUÍDA
- Segunda: 6x400m forte (5:20–5:35) + aquecimento 1,5km + soltura 1km
- Quarta: 6km progressivo (2km leve + 3km a 6:10 + 1km forte)
- Quinta: 5km leve (6:50–7:10)
- Longo: 12km (8km leve + 4km firmes a 6:20)

SEMANA 2 (04/05 a 10/05) - ATUAL
- Segunda: 5x600m forte (5:25–5:40) + aquecimento 2km + soltura 1km
- Quarta: 7km contínuos a 6:05–6:15
- Quinta: 5km leve + 5 tiros de 100m
- Longo: 14km leve (6:55–7:10)

SEMANA 3
- Segunda: 8x400m forte (5:20–5:35)
- Quarta: 8km progressivo (3km leve + 3km ritmo + 2km forte a 5:55)
- Quinta: 6km leve
- Longo: 16km leve constante

SEMANA 4 (RECUPERAÇÃO)
- Segunda: 5x400m moderado (5:40–5:55)
- Quarta: 6km leve
- Quinta: 5km leve
- Longo: 12km regenerativo (7:05)

SEMANA 5
- Segunda: 5x800m forte (5:30–5:45)
- Quarta: 8km ritmo a 6:00–6:10
- Quinta: 6km leve
- Longo: 18km (14km leve + 4km final a 6:20)

SEMANA 6
- Segunda: 10x300m tiro (4:55–5:15)
- Quarta: 10km progressivo (4km leve + 4km ritmo + 2km forte a 5:50)
- Quinta: 6km leve
- Longo: 20km (15km leve + 5km final a 6:15)

SEMANA 7
- Segunda: 6x1km forte (5:35–5:45)
- Quarta: 8km ritmo contínuo a 6:00
- Quinta: 5km leve
- Longo: 22km leve e constante (6:55–7:10)

SEMANA 8 (DESCARGA)
- Segunda: 4x800m moderado (5:45–6:00)
- Quarta: 6km leve
- Quinta: 5km leve
- Longo: 16km leve (7:05)

SEMANA 9
- Segunda: 8x500m forte (5:20–5:35)
- Quarta: TESTE 10km (km 1–3 a 6:05 / km 4–8 a 5:55 / km 9–10 tudo que tiver)
- Quinta: 6km leve
- Longo: 24km controlado (7:00)

SEMANA 10
- Segunda: 5x1km forte (5:30–5:40)
- Quarta: 10km ritmo a 5:58–6:05
- Quinta: 6km leve
- Longo: 26km leve (7:00)

SEMANA 11 (PICO)
- Segunda: 6x600m forte (5:25–5:40)
- Quarta: 8km leve
- Quinta: 5km leve
- Longo: 28km (20km leve + 8km final no mental forte a 6:25)

SEMANA 12 (REDUÇÃO)
- Segunda: 5x400m forte controlado (5:20–5:35)
- Quarta: 6km leve
- Quinta: 4km leve
- Longo: 18km confortável (7:00)

SEMANA 13 (PROVA)
- Segunda: 5km leve (7:00)
- Quarta: 4km leve + 3 tiros de 100m
- Quinta: descanso total
- Sexta: mobilidade + caminhada
- Sábado: 2km trotinho leve
- Domingo 26/07: 30KM
  Estratégia: km 1–10 a 6:55 / km 11–20 a 6:40 / km 21–30 a 6:20–6:35

# REGISTRO DE TREINOS
Quando o aluno reportar um treino, você DEVE extrair os dados e responder no seguinte formato especial
ANTES do seu feedback normal, numa linha separada:

TREINO_JSON:{"semana":2,"distancia":7.0,"pace":"6:10","descricao":"7km ritmo","sensacao":"boa"}

Extraia do relato do aluno: semana atual, distância em km, pace médio no formato mm:ss, descrição curta e sensação (boa/cansado/ótima/ruim).
Se algum dado não for mencionado, omita o campo ou use null.
Coloque o TREINO_JSON sempre na primeira linha da resposta, antes de qualquer texto.

# COMO RESPONDER
- Use tom professoral, exigente mas motivador
- Use emojis relevantes
- Formate usando HTML: <b>negrito</b> e <i>itálico</i>
- NÃO use Markdown com asteriscos (*texto*) ou underlines (_texto_)
- Acompanhe os treinos reportados pelo aluno e ajuste os feedbacks
- Quando o aluno reportar um treino, analise o pace, distância e sensação
- Lembre sempre qual é o treino do dia ou da semana atual
- Celebre conquistas e corrija erros com firmeza
- Seja objetivo para não ultrapassar o limite de tokens`;

// ─────────────────────────────────────────
// HISTÓRICO EM MEMÓRIA
// ─────────────────────────────────────────

const historicos = {};

function truncarHistorico(historico) {
  if (historico.length <= MAX_HISTORICO) return historico;
  return historico.slice(historico.length - MAX_HISTORICO);
}

// ─────────────────────────────────────────
// ENVIO DE MENSAGEM
// ─────────────────────────────────────────

async function enviarMensagemLonga(chatId, texto) {
  const LIMITE = 4000;
  const partes = [];
  let t = texto;
  while (t.length > 0) {
    partes.push(t.substring(0, LIMITE));
    t = t.substring(LIMITE);
  }
  for (const parte of partes) {
    try {
      await bot.sendMessage(chatId, parte, { parse_mode: 'HTML' });
    } catch (err) {
      console.warn('Falha ao enviar com HTML, enviando sem formatação:', err.message);
      await bot.sendMessage(chatId, parte);
    }
  }
}

// ─────────────────────────────────────────
// HANDLER DE MENSAGENS
// ─────────────────────────────────────────

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text;

  if (!texto) {
    bot.sendMessage(chatId, 'Por favor, envie apenas mensagens de texto. 🏃‍♂️');
    return;
  }

  // Comando: ver relatório de desempenho
  if (texto === '/desempenho' || texto === '/stats') {
    await enviarMensagemLonga(chatId, formatarRelatorio());
    return;
  }

  // Comando: ver todos os treinos registrados
  if (texto === '/treinos') {
    const dados = carregarDados();
    if (dados.treinos.length === 0) {
      bot.sendMessage(chatId, '📭 Nenhum treino registrado ainda.');
      return;
    }
    let lista = '📋 <b>Treinos Registrados:</b>\n\n';
    dados.treinos.forEach((t, i) => {
      const data = new Date(t.registradoEm).toLocaleDateString('pt-BR');
      lista += `${i + 1}. [${data}] Sem. ${t.semana || '?'} — ${t.distancia || '?'}km a ${t.pace || '?'}/km — ${t.descricao || ''} (${t.sensacao || '?'})\n`;
    });
    await enviarMensagemLonga(chatId, lista);
    return;
  }

  if (!historicos[chatId]) {
    historicos[chatId] = [];
  }

  historicos[chatId].push({ role: 'user', content: texto });

  try {
    const historicoTruncado = truncarHistorico(historicos[chatId]);

    const resultado = await groq.chat.completions.create({
      model: MODELO,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_BASE },
        ...historicoTruncado,
      ],
      max_tokens: MAX_TOKENS,
    });

    let resposta = resultado.choices[0].message.content;

    // Detecta e extrai TREINO_JSON da resposta
    const linhas = resposta.split('\n');
    const linhaJson = linhas.find(l => l.trim().startsWith('TREINO_JSON:'));

    if (linhaJson) {
      try {
        const jsonStr = linhaJson.replace('TREINO_JSON:', '').trim();
        const treino = JSON.parse(jsonStr);
        registrarTreino(treino);
        console.log('Treino registrado:', treino);
      } catch (e) {
        console.warn('Falha ao parsear TREINO_JSON:', e.message);
      }
      // Remove a linha do JSON da resposta antes de enviar ao usuário
      resposta = linhas.filter(l => !l.trim().startsWith('TREINO_JSON:')).join('\n').trim();
    }

    historicos[chatId].push({ role: 'assistant', content: resposta });
    await enviarMensagemLonga(chatId, resposta);

  } catch (err) {
    console.error('Erro ao chamar Groq:', err.message);

    if (err.status === 429 || err.status === 413) {
      historicos[chatId] = [];
      bot.sendMessage(
        chatId,
        '⚠️ Limite temporário atingido, precisei reiniciar o histórico. Pode repetir sua última mensagem?'
      );
    } else {
      bot.sendMessage(chatId, 'Ocorreu um erro, tente novamente.');
    }
  }
});

console.log('Bot iniciado! Aguardando mensagens...');
console.log('Comandos disponíveis: /desempenho, /stats, /treinos');
