import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system/legacy';

const API_KEY = "AIzaSyAynHm3gyP7RZlBeSKXYP0k7_t7wq6GQZI";
const genAI = new GoogleGenerativeAI(API_KEY);

let chatSession: any = null;

export const initChat = () => {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    // YENİ MİMARİ: AI'ı JSON dönmesi için kesin bir dille eğitiyoruz
    systemInstruction: `Sen profesyonel bir motosiklet tamircisisin. Kullanıcının gönderdiği fotoğraf(lar), motor sesi veya mesajları inceleyip arızaları teşhis et. Çözümleri kısa, teknik ve anlaşılır bir dille açıkla. 
    
    ÇOK ÖNEMLİ: Yanıtını SADECE AŞAĞIDAKİ JSON FORMATINDA ver. Düz metin kullanma.
    {
      "risk_seviyesi": "Düşük" | "Orta" | "Yüksek" | "Kritik",
      "risk_yuzdesi": 0-100 arası bir sayı,
      "cevap": "Ustanın arızayı ve çözümü açıkladığı teknik metin."
    }`
  });
  
  chatSession = model.startChat({ history: [] });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const sendChatMessage = async (text: string, imageUris: string[] = [], audioUri: string | null = null) => {
  if (!chatSession) initChat(); 

  try {
    const parts: any[] = [];

    if (imageUris && imageUris.length > 0) {
      for (const uri of imageUris) {
        const base64Image = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        parts.push({ inlineData: { data: base64Image, mimeType: "image/jpeg" } });
      }
    }

    if (audioUri) {
      const base64Audio = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
      parts.push({ inlineData: { data: base64Audio, mimeType: "audio/m4a" } });
    }

    if (text.trim() !== "") {
      parts.push({ text: text });
    } else {
      parts.push({ text: "Lütfen gönderdiğim bu verileri incele ve arızayı teşhis et." });
    }

    const maxRetries = 3; 
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await chatSession.sendMessage(parts);
        let rawText = result.response.text();
        
        // YENİ: Gelen JSON verisinin başındaki/sonundaki gereksiz markdown işaretlerini temizle
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        return rawText;

      } catch (err: any) {
        if (err.message && err.message.includes('503') && i < maxRetries - 1) {
          await delay(2000); 
          continue; 
        }
        throw err;
      }
    }
  } catch (error) {
    console.error("AI Sohbet Hatası:", error);
    return JSON.stringify({
      risk_seviyesi: "Orta",
      risk_yuzdesi: 50,
      cevap: "Ustanın atölyesi şu an çok yoğun. Lütfen daha sonra tekrar yazın."
    });
  }
};

export const resetChat = () => {
  chatSession = null;
};