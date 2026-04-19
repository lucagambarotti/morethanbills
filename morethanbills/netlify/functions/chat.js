exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key non configurata' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Payload non valido' }) }; }

  const { messages, datiSimulatore } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Messaggi non validi' }) };
  }

  let systemPrompt = `Sei MarzIA, un assistente esperto di bollette elettriche italiane. Aiuti le persone a capire la propria bolletta e come risparmiare. Non fare mai riferimento a nomi di fornitori energetici. Per informazioni commerciali invita a contattare il nostro consulente su Telegram: t.me/lucagambarotti. Se analizzi una bolletta spiega le voci ma non fare confronti con altri fornitori. Rispondi in italiano, in modo semplice e diretto.`;

  if (datiSimulatore) {
    systemPrompt += `\n\nDati simulazione: Periodo: ${datiSimulatore.mese||'N/D'}, Profilo: ${datiSimulatore.profilo}, Tariffa: ${datiSimulatore.tariffa}, Potenza: ${datiSimulatore.kw} kW, F1=${datiSimulatore.f1||0} F2=${datiSimulatore.f2||0} F3=${datiSimulatore.f3||0} kWh, Totale: ${datiSimulatore.totale} €`;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.slice(-10)
    })
  });

  const data = await response.json();
  const reply = data.content?.[0]?.text || 'Non riesco a rispondere al momento.';

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, reply })
  };
};
