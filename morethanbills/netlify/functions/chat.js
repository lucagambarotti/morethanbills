export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const ANTHROPIC_KEY = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'API key non configurata' }), { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Payload non valido' }), { status: 400 });
  }

  const { messages, datiSimulatore } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'Messaggi non validi' }), { status: 400 });
  }

  let systemPrompt = `Sei MarzIA, un assistente esperto di bollette elettriche italiane. Il tuo ruolo è aiutare le persone a capire la propria bolletta e come risparmiare. Non fare riferimento a nomi di fornitori. Per informazioni commerciali o per passare all'offerta, invita l'utente a contattare il nostro consulente su Telegram: t.me/lucagambarotti. Quando analizzi una bolletta caricata, spiega le voci ma non fare confronti con altri fornitori. Rispondi sempre in italiano, in modo semplice e diretto.`;

  if (datiSimulatore) {
    systemPrompt += `\n\nDati simulazione utente: Periodo: ${datiSimulatore.mese || 'N/D'}, Profilo: ${datiSimulatore.profilo}, Tariffa: ${datiSimulatore.tariffa}, Potenza: ${datiSimulatore.kw} kW, Consumi: F1=${datiSimulatore.f1||0} F2=${datiSimulatore.f2||0} F3=${datiSimulatore.f3||0} kWh, Totale: ${datiSimulatore.totale} €`;
  }

  try {
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

    return new Response(JSON.stringify({ ok: true, reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Errore interno', detail: err.message }), { status: 500 });
  }
};

export const config = { path: '/.netlify/functions/chat' };
