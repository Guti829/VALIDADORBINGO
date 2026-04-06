const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Bingo Validator API',
    model: 'Gemini 1.5 Flash'
  });
});

app.post('/analizar', async (req, res) => {
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'API key no configurada' });
  }

  const { imagen, tipo } = req.body;
  if (!imagen) {
    return res.status(400).json({ error: 'No se recibió imagen' });
  }

  const prompt = `Eres un experto validador de tiquetes BINGO de SuperGIROS Colombia. 
  Extrae: ZONA CANTADOS (24 números), TABLA 1 (5x5), TABLA 2 (5x5) y BONO.
  Responde estrictamente en JSON.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: tipo || 'image/jpeg', data: imagen } },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: "application/json"
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: result?.error?.message || 'Error API' });
    }

    const rawContent = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    try {
      const parsedData = JSON.parse(rawContent);
      res.json({ ok: true, data: parsedData });
    } catch (e) {
      res.status(422).json({ error: 'Error al procesar formato JSON' });
    }

  } catch (err) {
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
