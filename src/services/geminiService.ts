/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }

  async generatePixelArt(prompt: string, angle: string = "front", pose: string = "idle", resolution: number = 256, frameCount: number = 1) {
    try {
      const enhancedPrompt = frameCount > 1 
        ? `A pixel art animation sprite sheet of ${prompt}. 
           Content: ${frameCount} sequential animation frames for a ${pose} animation.
           View: ${angle} view.
           Style: ${resolution}x${resolution} pixel art sprites, high detail, clean lines, limited color palette, 
           arranged in a horizontal row on a solid white background, game asset style, high contrast.`
        : `Pixel art of ${prompt}. 
           View: ${angle} view. 
           Pose: ${pose}.
           Style: ${resolution}x${resolution} pixel art sprite, high detail, clean lines, limited color palette, flat shading, 
           centered on a solid white background, game asset style, high contrast.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: enhancedPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data returned from Gemini");
    } catch (error) {
      console.error("Error generating pixel art:", error);
      throw error;
    }
  }

  async generateTileset(prompt: string, isTileable: boolean = false) {
    try {
      const enhancedPrompt = isTileable
        ? `A seamless, tileable pixel art texture pattern of: ${prompt}. 
           The pattern must wrap perfectly on all sides (top to bottom, left to right).
           Style: 128x128 pixel art, high detail, top-down view, repeating patterns, clean edges, 
           no borders, game asset style.`
        : `A 4x4 tileset for a game map: ${prompt}. 
           Style: 128x128 pixel art tiles, high detail, top-down view, repeating patterns, clean edges, 
           solid white background separating tiles, retro game style.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: enhancedPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data returned from Gemini");
    } catch (error) {
      console.error("Error generating tileset:", error);
      throw error;
    }
  }

  async generateCharacterSheet(prompt: string) {
    try {
      const enhancedPrompt = `A pixel art character sheet for: ${prompt}. 
      Content: 4 different views (front, back, left side, right side) and 4 different poses (idle, walking, jumping, attacking).
      Layout: 4x4 grid of 128x128 pixel art sprites.
      Style: High detail, clean lines, limited color palette, flat shading, 
      centered on a solid white background, game asset style, high contrast.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: enhancedPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data returned from Gemini");
    } catch (error) {
      console.error("Error generating character sheet:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
