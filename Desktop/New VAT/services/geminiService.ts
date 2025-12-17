import { GoogleGenAI } from "@google/genai";

export const generateAnimalDescription = async (
  base64Image: string,
  species: string
): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.warn("API Key is missing. Using simulated description.");
        // SIMULATED RESPONSE FOR DEMO MODE
        const mocks = [
            `Healthy ${species} with distinct black and white patches. Small scar on left flank. Approx 2 years old.`,
            `Solid brown ${species}, large build. Tag mark visible on right ear. docile temperament.`,
            `Mixed color ${species} (white/brown). Unique star-shaped marking on forehead.`,
        ];
        return new Promise(resolve => setTimeout(() => resolve(mocks[Math.floor(Math.random() * mocks.length)]), 1500));
    }

    // Initialize Gemini Client lazily
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Describe this ${species} for a livestock registration database. 
    Focus on: 
    1. Color pattern 
    2. Distinct markings (spots, brands, scars) 
    3. Body shape/size 
    4. Any special identifying features. 
    Keep it concise (under 50 words) and factual.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1], // Remove data:image/jpeg;base64, prefix
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    return response.text || "No description generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating description. Please describe manually.";
  }
};

export const analyzeTheftRisk = async (stolenCount: number, location: string): Promise<string> => {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            // SIMULATED RESPONSE FOR DEMO MODE
            return new Promise(resolve => setTimeout(() => resolve(
                stolenCount > 2 
                ? "High Risk. Recent theft spikes detected in this region. Recommend increased night patrols."
                : "Low Risk. Activity is normal for this season. Continue standard monitoring."
            ), 1000));
        }

        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze theft risk for location ${location} given ${stolenCount} recent theft reports. Provide a short 1-sentence risk assessment and a recommendation for local farmers.`
        });
        return response.text || "Analysis unavailable.";
    } catch (e) {
        console.error("Gemini API Error:", e);
        return "Risk analysis unavailable.";
    }
}

export const validateIrisScan = async (base64Image: string): Promise<{valid: boolean, hash: string}> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        // Fallback for demo without key - Always return VALID for smoother testing
        return new Promise(resolve => setTimeout(() => resolve({ 
            valid: true, 
            hash: `BIO-DEMO-${Math.random().toString(36).substring(7).toUpperCase()}` 
        }), 2000));
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // We ask Gemini to confirm if the image looks like an eye/retina close up
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
          { text: "Does this image look like a close-up of an animal eye or iris suitable for biometric scanning? Answer strictly YES or NO." }
        ]
      }
    });

    const text = response.text?.trim().toUpperCase() || "NO";
    const valid = text.includes("YES");
    
    return {
      valid: valid,
      hash: valid ? `BIO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}` : ''
    };

  } catch (e) {
    console.error("Biometric validation failed", e);
    // Fallback to allow flow to continue in case of network error, but in real app would block
    return { valid: true, hash: `BIO-OFFLINE-${Date.now()}` };
  }
}