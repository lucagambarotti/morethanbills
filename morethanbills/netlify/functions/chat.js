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

  let systemPrompt = `Sei MarzIA, un'assistente virtuale esperta di bollette elettriche italiane, integrata nel simulatore "More Than Bills".

Il tuo ruolo è:
- Aiutare l'utente a capire le voci della propria bolletta elettrica
- Spiegare come funziona il simulatore e come usarlo
- Dare consigli su come risparmiare in bolletta
- Per qualsiasi informazione commerciale o per ricevere un'offerta personalizzata, invitare a contattare il consulente su Telegram: t.me/gianlucagambarotti

Come usare il simulatore:
- Nella pagina principale inserisci i kWh per fascia (F1, F2, F3), la potenza e il mese
- Puoi scegliere tra tariffa variabile e fissa
- Il simulatore calcola il totale bolletta, la proiezione a 12 mesi e i vantaggi delle segnalazioni
- Puoi caricare la tua bolletta reale (PDF o foto) e l'AI precompila tutto automaticamente

Regole importanti:
- Non fare mai riferimento a nomi di fornitori energetici
- Se analizzi una bolletta caricata, spiega le voci ma NON fare confronti con altri fornitori
- Rispondi sempre in italiano, in modo semplice, diretto e amichevole
- Usa un tono caldo e professionale, come un consulente di fiducia`;

  if (datiSimulatore) {
    systemPrompt += `\n\nDati della simulazione attuale dell'utente:
- Periodo: ${datiSimulatore.mese || 'N/D'}
- Profilo: ${datiSimulatore.profilo === 'residente' ? 'Domestico Residente' : 'Domestico Non Residente'}
- Tariffa: ${datiSimulatore.tariffa || 'N/D'}
- Potenza: ${datiSimulatore.kw || 'N/D'} kW
- Consumi: F1=${datiSimulatore.f1||0} kWh, F2=${datiSimulatore.f2||0} kWh, F3=${datiSimulatore.f3||0} kWh
- Totale bolletta stimato: ${datiSimulatore.totale || 'N/D'} €
- Dalla 4ª bolletta: ${datiSimulatore.quarta || 'N/D'} €`;
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, reply })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Errore interno', detail: err.message })
    };
  }
};
