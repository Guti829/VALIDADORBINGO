const express = require('express');
const cors = require('cors');

/**
 * CONFIGURACIÓN INICIAL
 * Asegúrate de tener la variable de entorno GEMINI_API_KEY configurada en Render.com
 */
const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Middlewares
app.use(cors());
// Aumentamos el límite para permitir imágenes de alta resolución
app.use(express.json({ limit: '20mb' }));

// Ruta de prueba (Health Check)
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Bingo Validator API',
    model: 'Gemini 1.5 Flash'
  });
});

/**
 * ENDPOINT PRINCIPAL: /analizar
 * Recibe una imagen en Base64 y devuelve los datos estructurados del Bingo.
 */
app.post('/analizar', async (req, res) => {
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'API key de Gemini no configurada en el servidor' });
  }

  const { imagen, tipo } = req.body;
  if (!imagen) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen para analizar' });
  }

  const prompt = `Eres un experto validador de tiquetes BINGO de SuperGIROS Colombia. 
Analiza la imagen y extrae la información con máxima precisión. 
Los números permitidos son del 01 al 75.

ESTRUCTURA:
- ZONA CANTADOS: 24 números extraídos de la zona raspada (izquierda).
- TABLA 1: Matriz 5x5 (azul).
- TABLA 2: Matriz 5x5 (amarilla).
- BONO: Valor o descripción de la sección de bono.

IMPORTANTE: Responde estrictamente con un objeto JSON. No incluyas explicaciones ni markdown.`;

  try {
    // Usamos Gemini 1.5 Flash para mejor gestión de cuotas y velocidad
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
          maxOutputTokens: 1000,
          response_mime_type: "application/json" // Obliga a la IA a responder solo JSON
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      // Manejo específico del error de cuota (Rate Limit)
      if (response.status === 429) {
        return res.status(429).json({ 
          error: 'Límite de peticiones excedido. Por favor, espera 60 segundos antes de intentar de nuevo.' 
        });
      }
      return res.status(response.status).json({ 
        error: result?.error?.message || 'Error en la comunicación con la IA.' 
      });
    }

    // Extraer el texto de la respuesta
    const rawContent = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return res.status(422).json({ error: 'La IA no pudo procesar la imagen. Intenta con una foto más clara.' });
    }

    try {
      const parsedData = JSON.parse(rawContent);
      // Retornamos el formato que espera tu Frontend
      res.json({ ok: true, data: parsedData });
    } catch (parseError) {
      console.error('Error parseando JSON de Gemini:', rawContent);
      res.status(422).json({ error: 'Error al estructurar los datos del bingo. Reintenta la captura.' });
    }

  } catch (err) {
    console.error('Error en el servidor:', err);
    res.status(500).json({ error: 'Error interno del servidor: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Bingo Valid corriendo en puerto ${PORT}`);
});

  } catch (err) {
    res.status(500).json({ error: 'Error de conexión: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor bingo (Gemini) corriendo en puerto ${PORT}`);
});
