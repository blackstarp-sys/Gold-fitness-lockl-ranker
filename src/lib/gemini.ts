import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({});

export async function generatePostCaption(params: { topic: string, tone: string, language: string }) {
  try {
    const prompt = `
Write a highly engaging "What's New" or Promotional post for a Google Business Profile.
Topic: ${params.topic}
Tone: ${params.tone}
Language: ${params.language}

Guidelines:
- Keep it under 1500 characters (Google's limit), but ideally around 3-4 sentences.
- Include a clear Call to Action (e.g., "Visit us today!", "Book now!").
- Use engaging formatting but do NOT use Markdown asterisks (**).
- Include 2-3 relevant emojis.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || '';
  } catch (error: any) {
    console.error('[GEMINI LIB ERROR]', error);
    throw error;
  }
}

export async function generateReviewReply(review: { reviewerName: string, rating: number, comment: string, businessName: string, language: string }) {
  try {
    const prompt = `
You are an expert customer service manager for a local business named "${review.businessName}".
Write a polite, professional, and empathetic response to the following customer review.

Reviewer Name: ${review.reviewerName}
Star Rating: ${review.rating} out of 5
Customer Comment: "${review.comment || 'No written comment left by customer.'}"

Guidelines:
- If the rating is 4 or 5 stars: Express warm gratitude, mention you are thrilled they had a good experience, and invite them back.
- If the rating is 1, 2, or 3 stars: Apologize sincerely for their experience, be empathetic but professional, and offer a way to resolve the issue offline (e.g., "Please reach out to our team so we can make this right").
- Keep it concise (under 4 sentences).
- Do not use hashtags or emojis.
- MUST respond in this language: ${review.language}.
- Sign off naturally as "The ${review.businessName} Team".
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || '';
  } catch (error: any) {
    console.error('[GEMINI LIB ERROR]', error);
    throw error;
  }
}

export async function generatePostContent(topic: string, businessName: string) {
  try {
    const prompt = `You are a social media manager for ${businessName}.
Write a short, engaging Google Business Profile post about: ${topic}.
Keep it under 300 characters. Add 2 relevant emojis. Do not include hashtags.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || '';
  } catch (error: any) {
    console.error('[GEMINI LIB ERROR]', error);
    throw error;
  }
}
