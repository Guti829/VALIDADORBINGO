const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// CORS abierto para que cualquier celular pueda conectarse
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Bingo Validator - OpenAI GPT-4O',
    version: '3.0',
    estructura: '27 cantados + Tabla1 5x5 + Tabla2 5x5'
  });
});

app.post('/analizar', async (req, res) => {
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY no configurada en el servidor' });
  }

  const { imagen, tipo } = req.body;
  if (!imagen) {
    return res.status(400).json({ error: 'No se recibio imagen en el cuerpo de la solicitud' });
  }

  const prompt = `Eres un experto en tiquetes BINGO raspa y gana de SuperGIROS Colombia (Raspa & Listo).

ESTRUCTURA EXACTA DEL TIQUETE QUE DEBES LEER:

1. ZONA CANTADOS (rectangulo grande izquierdo, fondo celeste/azul claro):
   - Titulo: "NUMEROS CANTADOS"
   - FILA 1: exactamente 6 numeros
   - FILA 2: exactamente 7 numeros
   - FILA 3: exactamente 7 numeros
   - FILA 4: exactamente 7 numeros
   - TOTAL: 27 numeros (todos entre 01 y 75)
   - Cada celda tiene el numero arriba grande y texto en letra pequena abajo

2. TABLA 1 (cuadricula azul, derecha arriba, etiqueta "TABLA 1"):
   - 5 columnas con letras B-I-N-G-O
   - 5 filas de numeros
   - TOTAL: 25 numeros

3. TABLA 2 (cuadricula amarilla/dorada, derecha abajo, etiqueta "TABLA 2"):
   - 5 columnas con letras B-I-N-G-O
   - 5 filas de numeros
   - TOTAL: 25 numeros

4. BONO: pequena seccion raspada con valor en pesos

LEE CADA NUMERO CON MAXIMA PRECISION. Todos los numeros van del 01 al 75.

Responde UNICAMENTE con JSON valido, sin texto adicional, sin backticks, sin markdown:
{
  "cantados": {
    "fila1": [n1,n2,n3,n4,n5,n6],
    "fila2": [n1,n2,n3,n4,n5,n6,n7],
    "fila3": [n1,n2,n3,n4,n5,n6,n7],
    "fila4": [n1,n2,n3,n4,n5,n6,n7]
  },
  "tabla1": [
    [f1c1,f1c2,f1c3,f1c4,f1c5],
    [f2c1,f2c2,f2c3,f2c4,f2c5],
    [f3c1,f3c2,f3c3,f3c4,f3c5],
    [f4c1,f4c2,f4c3,f4c4,f4c5],
    [f5c1,f5c2,f5c3,f5c4,f5c5]
  ],
  "tabla2": [
    [f1c1,f1c2,f1c3,f1c4,f1c5],
    [f2c1,f2c2,f2c3,f2c4,f2c5],
    [f3c1,f3c2,f3c3,f3c4,f3c5],
    [f4c1,f4c2,f4c3,f4c4,f4c5],
    [f5c1,f5c2,f5c3,f5c4,f5c5]
  ],
  "bono": "texto del bono o $0 si no esta raspado",
  "calidad": "buena|regular|mala"
}`;

  try {
    const url = `https://api.openai.com/v1/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${tipo || 'image/jpeg'};base64,${imagen}`
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }],
        max_tokens: 1200,
        temperature: 0.05
      })
    });

    const result = await response.json();

    if (!response.ok) {
      const msg = result?.error?.message || `Error OpenAI: ${response.status}`;
      console.error('OpenAI error:', msg);
      return res.status(response.status).json({ error: msg });
    }

    const raw = result?.choices?.[0]?.message?.content || '';
    if (!raw) {
      return res.status(422).json({ error: 'OpenAI no devolvio contenido. Intenta con foto mas clara.' });
    }

    // Limpiar backticks y markdown
    const clean = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('JSON parse error. Raw response:', clean.substring(0, 400));
      return res.status(422).json({
        error: 'No se pudo interpretar la respuesta. La imagen puede no ser clara.',
        debug: clean.substring(0, 200)
      });
    }

    // Validar estructura
    if (!parsed.cantados || !parsed.tabla1 || !parsed.tabla2) {
      return res.status(422).json({ error: 'Estructura incompleta en la respuesta. Intenta con foto mas clara y bien iluminada.' });
    }

    // Normalizar cantados
    let cantadosFlat = [];
    if (Array.isArray(parsed.cantados)) {
      cantadosFlat = parsed.cantados.map(Number);
    } else if (typeof parsed.cantados === 'object') {
      const f1 = (parsed.cantados.fila1 || []).map(Number);
      const f2 = (parsed.cantados.fila2 || []).map(Number);
      const f3 = (parsed.cantados.fila3 || []).map(Number);
      const f4 = (parsed.cantados.fila4 || []).map(Number);
      cantadosFlat = [...f1, ...f2, ...f3, ...f4];
    }

    res.json({
      ok: true,
      data: {
        cantados: cantadosFlat,
        cantados_filas: {
          fila1: cantadosFlat.slice(0, 6),
          fila2: cantadosFlat.slice(6, 13),
          fila3: cantadosFlat.slice(13, 20),
          fila4: cantadosFlat.slice(20, 27)
        },
        tabla1: parsed.tabla1.map(r => r.map(Number)),
        tabla2: parsed.tabla2.map(r => r.map(Number)),
        bono: parsed.bono || '$0',
        calidad: parsed.calidad || 'buena'
      }
    });

  } catch (err

