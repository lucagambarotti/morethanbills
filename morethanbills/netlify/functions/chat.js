// netlify/functions/chat.js
// Chatbot consulente bolletta — risponde a domande sulla bolletta simulata

const SYSTEM_PROMPT = `Sei un assistente esperto di bollette elettriche italiane, specializzato nell'offerta "Luce Amica" di NWG Energia.

Il tuo ruolo è spiegare in modo semplice e chiaro le voci della bolletta, aiutare l'utente a capire quanto paga e perché, e mostrare i vantaggi dell'offerta.

Contesto dell'offerta:
- Tariffa VARIABILE: prezzo = PUN mensile + spread fisso 0,034 €/kWh. Il PUN è il Prezzo Unico Nazionale del mercato elettrico, aggiornato ogni mese.
- Tariffa FISSA: prezzi fissi per 12 mesi (monorario 0,1991 €/kWh, F1 0,2112, F2 0,2013, F3 0,1936 €/kWh). Perdite di rete già incluse.
- Perdite di rete: 10% — l'energia persa nei cavi tra la centrale e casa tua. Le paghi tutti, con qualsiasi fornitore.
- ASOS: onere per finanziare le energie rinnovabili (definito da ARERA, uguale per tutti i fornitori).
- CCV (Corrispettivo Commercializzazione e Vendita): 11,61 €/mese — costo fisso del servizio di vendita.
- Accisa: imposta erariale 0,0227 €/kWh (con franchigia per residenti con ≤3kW).
- Canone RAI: 9 €/mese (gennaio-ottobre), incluso in bolletta solo per residenti.
- Bonus Nuovo Cliente: -10 €/mese per le prime 3 bollette.
- Bonus segnalazioni: 0,01 €/kWh sui consumi di ogni persona segnalata (media 2,50 €/mese per segnalato da 250 kWh/mese).

Rispondi sempre in italiano, in modo semplice e diretto. Usa esempi concreti con numeri quando possibile. Sii conciso ma esauriente. Non inventare informazioni che non conosci.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key non configurata' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Payload non valido' }) };
  }

  // messages: array di {role: 'user'|'assistant', content: string}
  // datiSimulatore: oggetto opzionale con i dati del simulatore per contestualizzare
  const { messages, datiSimulatore } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Messaggi non validi' }) };
  }

  // Aggiungi contesto simulatore al system prompt se disponibile
  let systemPrompt = SYSTEM_PROMPT;
  if (datiSimulatore) {
    systemPrompt += `\n\nDati della simulazione attuale dell'utente:
- Periodo: ${datiSimulatore.mese || 'N/D'}
- Profilo: ${datiSimulatore.profilo === 'residente' ? 'Domestico Residente' : 'Domestico Non Residente'}
- Tariffa: ${datiSimulatore.tariffa || 'N/D'}
- Potenza: ${datiSimulatore.kw || 'N/D'} kW
- Consumi: F1=${datiSimulatore.f1 || 0} kWh, F2=${datiSimulatore.f2 || 0} kWh, F3=${datiSimulatore.f3 || 0} kWh (tot. ${(datiSimulatore.f1||0)+(datiSimulatore.f2||0)+(datiSimulatore.f3||0)} kWh/mese)
- Totale bolletta stimato: ${datiSimulatore.totale || 'N/D'} €
- Dalla 4ª bolletta: ${datiSimulatore.quarta || 'N/D'} €
- PUN del mese: ${datiSimulatore.pun || 'N/D'} €/MWh`;
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.slice(-10) // ultimi 10 messaggi per non sforare il contesto
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Errore API Claude', detail: err }) };
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Non riesco a rispondere al momento.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, reply })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: err.message }) };
  }
};
