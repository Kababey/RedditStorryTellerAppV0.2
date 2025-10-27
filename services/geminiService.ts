import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AUDIO_SAMPLE_RATE, MODELS, VOICES } from '../constants';
import { NarratorGender } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function determineNarratorGender(storyText: string): Promise<NarratorGender> {
  try {
    const prompt = `Analyze the following story text and determine the most likely gender of the narrator (the person telling the story). Respond with ONLY a JSON object with a single key "gender" and a value of "male", "female", or "indeterminate". Story: "${storyText.substring(0, 1000)}"`;

    const response = await ai.models.generateContent({
      model: MODELS.text,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                gender: {
                    type: Type.STRING,
                    description: 'The determined gender of the narrator: "male", "female", or "indeterminate".'
                }
            }
        }
      }
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    const gender = result.gender.toLowerCase();
    
    if (gender === 'male' || gender === 'female' || gender === 'indeterminate') {
      return gender;
    }
    return 'indeterminate';
  } catch (error) {
    console.error("Error determining narrator gender:", error);
    return 'indeterminate';
  }
}

/**
 * Splits text into manageable chunks for the TTS API by character length, respecting word boundaries.
 * @param text The full text to chunk.
 * @param maxLength The maximum character length for each chunk. The Gemini API has a 5000 character limit.
 * @returns An array of text chunks.
 */
function chunkText(text: string, maxLength: number = 4800): string[] {
    const chunks: string[] = [];
    if (!text || text.length === 0) {
        return chunks;
    }
    if (text.length <= maxLength) {
        chunks.push(text);
        return chunks;
    }

    let remainingText = text;
    while (remainingText.length > 0) {
        if (remainingText.length <= maxLength) {
            chunks.push(remainingText);
            break;
        }

        let chunk = remainingText.substring(0, maxLength);
        let lastSpace = chunk.lastIndexOf(' ');

        // If we found a space and it's not at the very beginning, split there. Otherwise, hard split.
        const splitIndex = lastSpace > 0 ? lastSpace : maxLength;
        
        chunk = remainingText.substring(0, splitIndex);
        chunks.push(chunk);

        remainingText = remainingText.substring(splitIndex).trim();
    }

    return chunks;
}


export async function generateSpeech(
  text: string,
  gender: NarratorGender,
  voiceNameOverride?: string
): Promise<{ audioData: string | null; voiceName: string }> {
  if (!text || text.trim() === '') {
    return { audioData: '', voiceName: '' };
  }
  
  const voiceOptions = gender === 'male' ? VOICES.male : VOICES.female;
  const voiceName = voiceNameOverride || voiceOptions[Math.floor(Math.random() * voiceOptions.length)];

  const chunks = chunkText(text);
  if (chunks.length === 0) {
     return { audioData: '', voiceName };
  }

  try {
    const audioChunks: Uint8Array[] = [];

    // Process chunks sequentially to avoid rate limiting
    for (const chunk of chunks) {
      if (chunk.trim().length === 0) continue;

      const response = await ai.models.generateContent({
        model: MODELS.tts,
        contents: [{ parts: [{ text: chunk }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        audioChunks.push(decode(base64Audio));
      }
       // Small delay to prevent hitting API rate limits
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (audioChunks.length === 0) {
      throw new Error("No audio data was generated from any text chunk.");
    }

    // Concatenate raw PCM audio data
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return { audioData: encode(combined), voiceName };
  } catch (error) {
    console.error("Error generating speech:", error);
    return { audioData: null, voiceName };
  }
}


// --- Audio Encoding & Decoding ---

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = AUDIO_SAMPLE_RATE,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}