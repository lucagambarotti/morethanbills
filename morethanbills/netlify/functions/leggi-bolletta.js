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

  const { fileData, mediaType } = body;
  if (!fileData || !mediaType) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Mancano fileData o mediaType' }) };
  }

  const prompt = `Analizza questa bolletta elettrica italiana e estrai SOLO questi dati.
Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo aggiuntivo, senza markdown, senza backtick.

Campi da estrarre:
- f1: consumo in fascia F1 (kWh, numero intero)
- f2: consumo in fascia F2 (kWh, numero intero)
- f3: consumo in fascia F3 (kWh, numero intero)
- kw: potenza contrattuale (es. 3 o 4.5, numero decimale)
- mese: periodo di fatturazione nel formato "Mese AAAA" (es. "Marzo 2026")
- profilo: "residente" se DOMESTICO RESIDENTE, "nonResidente" se DOMESTICO NON RESIDENTE o D3
- tipo: "variabile" se l'offerta è a prezzo variabile/PUN, "fissa" se a prezzo fisso

Se un dato non è leggibile metti null.

Esempio di risposta corretta:
{"f1":57,"f2":50,"f3":82,"kw":3,"mese":"Marzo 2026","profilo":"nonResidente","tipo":"variabile"}`;

  let contentBlock;
  if (mediaType === 'application/pdf') {
    contentBlock = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: fileData }
    };
  } else {
    contentBlock = {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: fileData }
    };
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
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [contentBlock, { type: 'text', text: prompt }]
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    let parsed;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      return { statusCode: 200, body: JSON.stringify({ error: 'Non riesco a leggere la bolletta. Prova con una foto più nitida o un PDF migliore.', raw: text }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, dati: parsed })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: err.message }) };
  }
};
