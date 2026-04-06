const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Bingo Validator API' });
});

// Endpoint principal - analiza imagen
app.post('/analizar', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key no configurada en el servidor' });
  }

  const { imagen, tipo } = req.body;
  if (!imagen) {
    return res.status(400).json({ error: 'No se recibió imagen' });
  }

  const prompt = `Eres un experto validador de tiquetes BINGO raspa y gana de SuperGIROS Colombia.

ESTRUCTURA DEL TIQUETE:
- ZONA CANTADOS (lado izquierdo): grilla de 6 columnas x 4 filas = 24 números (del 01 al 75)
- TABLA 1 (cuadrícula azul, derecha arriba): 5 columnas x 5 filas = 25 números
- TABLA 2 (cuadrícula amarilla/dorada, derecha abajo): 5 columnas x 5 filas = 25 números
- BONO: sección pequeña con valor en pesos

Lee TODOS los números con máxima precisión. Los números van de 01 a 75.

Responde ÚNICAMENTE con este JSON válido (sin texto extra, sin backticks, sin markdown):
{
  "cantados": [lista de 24 números enteros de la zona raspada],
  "tabla1": [[f1c1,f1c2,f1c3,f1c4,f1c5],[f2c1,f2c2,f2c3,f2c4,f2c5],[f3c1,f3c2,f3c3,f3c4,f3c5],[f4c1,f4c2,f4c3,f4c4,f4c5],[f5c1,f5c2,f5c3,f5c4,f5c5]],
  "tabla2": [[f1c1,f1c2,f1c3,f1c4,f1c5],[f2c1,f2c2,f2c3,f2c4,f2c5],[f3c1,f3c2,f3c3,f3c4,f3c5],[f4c1,f4c2,f4c3,f4c4,f4c5],[f5c1,f5c2,f5c3,f5c4,f5c5]],
  "bono": "descripción del bono",
  "calidad": "buena|regular|mala"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: tipo || 'image/jpeg', data: imagen } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || `Error ${response.status}` });
    }

    const data = await response.json();
    const raw = data.content.map(c => c.text || '').join('').trim();
    const clean = raw.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(clean);
      res.json({ ok: true, data: parsed });
    } catch (e) {
      res.status(422).json({ error: 'No se pudo leer la imagen. Usa una foto más clara.' });
    }

  } catch (err) {
    res.status(500).json({ error: 'Error de conexión: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor bingo corriendo en puerto ${PORT}`);
});
