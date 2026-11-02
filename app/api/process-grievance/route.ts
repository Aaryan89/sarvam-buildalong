import { NextRequest, NextResponse } from "next/server";
import { SarvamAIClient } from "sarvamai";

export const maxDuration = 60; // Allow sufficient time for the AI chain

interface StructuredGrievance {
  detected_issue_summary: string;
  cpgrams_department: string;
  severity: "Critical" | "High" | "Medium";
  severity_justification: string;
  cpgrams_grievance_draft: string;
  rti_application_draft: string;
  citizen_reassurance_native: string;
}

function cleanAndParseJSON(raw: string): StructuredGrievance {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(extracted);
    }
    throw new Error("Could not parse JSON from model response");
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "SARVAM_API_KEY is not configured in the environment." },
        { status: 500 }
      );
    }

    const client = new SarvamAIClient({
      apiSubscriptionKey: apiKey,
    });

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const textInput = (formData.get("text") as string) || "";
    const languageCode = (formData.get("language_code") as string) || "hi-IN";

    let transcript = textInput.trim();

    // STEP 1 — Speech-to-Text (saaras:v3)
    if (audioFile && audioFile.size > 0) {
      try {
        const sttResponse = await client.speechToText.transcribe({
          file: audioFile,
          model: "saaras:v3",
          language_code: languageCode as any,
        });

        if (sttResponse?.transcript) {
          transcript = sttResponse.transcript.trim();
        }
      } catch (sttError: any) {
        console.error("STT Error:", sttError);
        return NextResponse.json(
          {
            error: `Speech-to-text failed: ${
              sttError?.message || "Unknown error during audio transcription"
            }`,
          },
          { status: 500 }
        );
      }
    }

    if (!transcript) {
      return NextResponse.json(
        { error: "No complaint provided. Please speak or enter text." },
        { status: 400 }
      );
    }

    // STEP 2 — Grievance & RTI Structuring (sarvam-105b-conversations)
    const prompt = `You are an expert Indian Legal and Civic Governance Copilot specializing in CPGRAMS (Centralized Public Grievance Redress and Monitoring System) and the Right to Information (RTI) Act, 2005.

A citizen has submitted this public grievance in an Indic language or English:
"""
${transcript}
"""

Target User Indic Language Code: ${languageCode}

Generate a comprehensive, legally rigorous response. Return ONLY valid JSON with this exact schema:
{
  "detected_issue_summary": "Concise 1-sentence summary of the grievance",
  "cpgrams_department": "Accurate Central Ministry / State Department / Urban Local Body (ULB) tag (e.g., 'Ministry of Jal Shakti / Municipal Ward Water Works', 'Public Works Department (PWD)', 'Ministry of Consumer Affairs, Food & Public Distribution', 'Ministry of Road Transport and Highways')",
  "severity": "Critical" | "High" | "Medium",
  "severity_justification": "1-sentence justification highlighting citizen safety, constitutional rights, or public health impact",
  "cpgrams_grievance_draft": "Formal, high-impact English grievance formatted for direct copy-paste into the CPGRAMS portal. Include:
  - Subject Line
  - Grievance Category & Sub-category
  - Location / Ward / Landmark Placeholders
  - Chronological Fact Summary
  - Violation of Citizen Rights / Public Danger
  - Specific Relief Sought with clear time-bound expectations",
  "rti_application_draft": "Formal Right to Information (RTI) Application under Section 6(1) of the RTI Act, 2005 addressed to the Public Information Officer (PIO). Include:
  - Subject: Seeking Information under Section 6(1) of RTI Act 2005
  - 3-4 numbered, sharp, legally enforceable questions requesting:
    1. Certified copies of official complaint inspection logs & site visit reports.
    2. Name, designation, and official contact of the junior engineer/officer assigned to this resolution.
    3. Certified copies of the work order, budget sanctioned, and contractor agreement for maintenance in this area.
    4. Daily progress report and action taken register from the date of initial intimation.",
  "citizen_reassurance_native": "A warm, empathetic 2-sentence confirmation written entirely in the citizen's selected Indic language (${languageCode}). Sentence 1 must acknowledge their specific problem with empathy and state that the formal CPGRAMS grievance and RTI application have been prepared. Sentence 2 must clearly guide them to submit the grievance on the portal and file the RTI if no action is taken within 7 days."
}`;

    const chatResponse = await client.chat.completions({
      model: "sarvam-105b-conversations",
      messages: [
        {
          role: "system",
          content:
            "You are a specialized legal assistant for Indian governance, CPGRAMS, and RTI. Always output strictly valid JSON without any markdown formatting or commentary.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const rawContent = chatResponse.choices?.[0]?.message?.content || "";
    let structuredData: StructuredGrievance;

    try {
      structuredData = cleanAndParseJSON(rawContent);
    } catch (parseError) {
      console.error("JSON Parse Error on raw content:", rawContent);
      return NextResponse.json(
        {
          error: "Failed to parse structured legal draft from Sarvam AI.",
          raw: rawContent,
        },
        { status: 500 }
      );
    }

    // STEP 3 — Text-to-Speech (bulbul:v3)
    let audioBase64: string | null = null;
    if (structuredData.citizen_reassurance_native) {
      try {
        const ttsResponse = await client.textToSpeech.convert({
          text: structuredData.citizen_reassurance_native,
          language_code: languageCode as any,
          model: "bulbul:v3",
        });

        if (ttsResponse?.audios && ttsResponse.audios.length > 0) {
          audioBase64 = ttsResponse.audios[0];
        }
      } catch (ttsError) {
        console.warn("TTS generation warning (non-blocking):", ttsError);
      }
    }

    // STEP 4 — Return Unified JSON
    return NextResponse.json({
      transcript,
      structured_data: structuredData,
      audio_base64: audioBase64,
    });
  } catch (error: any) {
    console.error("Pipeline Error:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred in the grievance pipeline." },
      { status: 500 }
    );
  }
}
