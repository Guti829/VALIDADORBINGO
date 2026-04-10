const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Bingo Validator API', model: 'gemini-2.0-flash' });
});

app.post('/analizar', async (req, res) => {
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor' });
  }
  const { imagen, tipo } = req.body;
  if (!imagen) return res.status(400).json({ error: 'No se recibio imagen' });

  const prompt = `Eres un experto validador de tiquetes BINGO raspa y gana de SuperGIROS Colombia.

ESTRUCTURA DEL TIQUETE:
- ZONA CANTADOS (lado izquierdo): grilla de 6 columnas x 4 filas = 24 numeros (del 01 al 75)
- TABLA 1 (cuadricula azul, derecha arriba): 5 columnas x 5 filas = 25 numeros
- TABLA 2 (cuadricula amarilla/dorada, derecha abajo): 5 columnas x 5 filas = 25 numeros
- BONO: seccion pequeña con valor en pesos

Lee TODOS los numeros con maxima precision. Los numeros van de 1 a 75.

Responde UNICAMENTE con este JSON valido, sin texto extra, sin backticks, sin markdown:
{"cantados":[n1,n2,n3,n4,n5,n6,n7,n8,n9,n10,n11,n12,n13,n14,n15,n16,n17,n18,n19,n20,n21,n22,n23,n24],"tabla1":[[f1c1,f1c2,f1c3,f1c4,f1c5],[f2c1,f2c2,f2c3,f2c4,f2c5],[f3c1,f3c2,f3c3,f3c4,f3c5],[f4c1,f4c2,f4c3,f4c4,f4c5],[f5c1,f5c2,f5c3,f5c4,f5c5]],"tabla2":[[f1c1,f1c2,f1c3,f1c4,f1c5],[f2c1,f2c2,f2c3,f2c4,f2c5],[f3c1,f3c2,f3c3,f3c4,f3c5],[f4c1,f4c2,f4c3,f4c4,f4c5],[f5c1,f5c2,f5c3,f5c4,f5c5]],"bono":"texto del bono","calidad":"buena"}`;

  try {
    const url = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY};
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: tipo || 'image/jpeg', data: imagen } },
          { text: prompt }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
      })
    });

    const result = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: result?.error?.message || Error ${response.status} });
    }

    const raw = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/json/g, '').replace(//g, '').trim();

    try {
      const parsed = JSON.parse(clean);
      if (!parsed.cantados  !parsed.tabla1  !parsed.tabla2) {
        return res.status(422).json({ error: 'Imagen no clara. Intenta con mejor iluminacion.' });
      }
      res.json({ ok: true, data: parsed });
    } catch(e) {
      console.error('Parse error. Raw:', clean.substring(0, 300));
      res.status(422).json({ error: 'No se pudo leer la imagen. Usa foto mas clara y enfocada.' });
    }
  } catch(err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});

app.listen(PORT, () => console.log(Servidor Bingo corriendo en puerto ${PORT}));
