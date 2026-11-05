import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, config } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    console.log('Generating image with prompt:', prompt);

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      config: {
        responseModalities: ['IMAGE', 'TEXT']
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt }
          ]
        }
      ]
    });

    console.log('Image generated successfully via GoogleGenAI SDK (Flash Image)');

    let extractedBase64 = null;
    
    // Search the response tree for inlineData
    if (response.candidates && response.candidates.length > 0) {
      for (const candidate of response.candidates) {
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
              extractedBase64 = part.inlineData.data;
              break;
            }
          }
        }
        if (extractedBase64) break;
      }
    }

    if (extractedBase64) {
      res.json({
        generatedImages: [
          { image: extractedBase64 }
        ]
      });
    } else {
      throw new Error("No image data found in the response from Gemini Flash");
    }

  } catch (error) {
    console.error('Proxy error:', error);
    // Send detailed error properties back
    res.status(error.status || 500).json({ 
      error: error.message,
      details: error.statusText || 'Internal Server Error' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running on http://localhost:${PORT}`);
  console.log(`✅ Ready to handle image generation requests`);
});
