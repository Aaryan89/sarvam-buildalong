import { NextRequest, NextResponse } from "next/server";
import { SarvamAIClient } from "sarvamai";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "SARVAM_API_KEY is not configured in the environment." },
        { status: 500 }
      );
    }

    const { text, language_code } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text string is required for TTS synthesis." },
        { status: 400 }
      );
    }

    const client = new SarvamAIClient({
      apiSubscriptionKey: apiKey,
    });

    // bulbul:v3 supports max 2500 characters. Safely trim to first 1800 chars if draft is long
    const cleanText = text.trim().slice(0, 1800);

    const ttsResponse = await client.textToSpeech.convert({
      text: cleanText,
      language_code: (language_code || "hi-IN") as any,
      model: "bulbul:v3",
    });

    const audioBase64 = ttsResponse?.audios?.[0] || null;

    if (!audioBase64) {
      return NextResponse.json(
        { error: "No audio generated from Sarvam TTS service." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      audio_base64: audioBase64,
      characters_synthesized: cleanText.length,
    });
  } catch (error: any) {
    console.error("TTS API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to synthesize speech via Sarvam AI." },
      { status: 500 }
    );
  }
}
