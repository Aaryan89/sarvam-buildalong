import { NextRequest, NextResponse } from "next/server";
import { SarvamAIClient } from "sarvamai";

export const maxDuration = 60; // Allow sufficient time for the AI chain

export interface CitizenPlaybook {
  statutory_sla_days: string;
  escalation_authority: string;
  required_attachments: string[];
  application_fee: string;
  submission_portal_url: string;
}

export interface StructuredGrievance {
  detected_issue_summary: string;
  cpgrams_department: string;
  severity: "Critical" | "High" | "Medium";
  severity_justification: string;
  cpgrams_grievance_draft: string;
  translated_grievance_native: string;
  rti_application_draft: string;
  translated_rti_native: string;
  citizen_reassurance_native: string;
  citizen_playbook: CitizenPlaybook;
}

export interface PipelineTelemetry {
  stt?: {
    model: string;
    latency_ms: number;
    language_code: string;
  };
  llm: {
    model: string;
    latency_ms: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  tts?: {
    model: string;
    latency_ms: number;
    audio_format: string;
  };
  total_latency_ms: number;
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
  const pipelineStart = performance.now();
  const telemetry: PipelineTelemetry = {
    llm: { model: "sarvam-105b-conversations", latency_ms: 0 },
    total_latency_ms: 0,
  };

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
    const evidenceFile = formData.get("evidence") as File | null;
    const evidenceNote = (formData.get("evidence_note") as string) || "";

    let transcript = textInput.trim();

    // Compile Evidence Context if attached
    let priorEvidenceContext = "";
    if (evidenceNote.trim()) {
      priorEvidenceContext += `Prior Complaint Reference / Diary Note: "${evidenceNote.trim()}"`;
    }
    if (evidenceFile && evidenceFile.size > 0) {
      const fileSizeKb = Math.round(evidenceFile.size / 1024);
      priorEvidenceContext += ` [Attached File Evidence: "${evidenceFile.name}" (${fileSizeKb} KB, Type: ${evidenceFile.type || "document/image"})]`;
    }

    // STEP 1 — Speech-to-Text (saaras:v3)
    if (audioFile && audioFile.size > 0) {
      const sttStart = performance.now();
      try {
        const sttResponse = await client.speechToText.transcribe({
          file: audioFile,
          model: "saaras:v3",
          language_code: languageCode as any,
        });

        const sttEnd = performance.now();
        telemetry.stt = {
          model: "saaras:v3",
          latency_ms: Math.round(sttEnd - sttStart),
          language_code: languageCode,
        };

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
        { error: "No complaint provided. Please speak, upload audio, or enter text." },
        { status: 400 }
      );
    }

    // STEP 2 — Grievance & RTI Structuring (sarvam-105b-conversations)
    const prompt = `You are an expert Indian Legal and Civic Governance Copilot specializing in CPGRAMS (Centralized Public Grievance Redress and Monitoring System) and the Right to Information (RTI) Act, 2005 Section 6(1).

A citizen has submitted this public grievance in an Indic language or English:
"""
${transcript}
"""

Target User Indic Language Code: ${languageCode}
${
  priorEvidenceContext
    ? `PRIOR COMPLAINT REFERENCE / EVIDENCE ATTACHED:
"""
${priorEvidenceContext}
"""
MANDATORY: Explicitly cite this prior reference/diary number in the CPGRAMS complaint and formulate specific RTI questions demanding certified inspection logs, officer diary notes, and reasons for inaction since that date.`
    : "No prior reference attached. Draft as a fresh high-priority intimation."
}

Generate a comprehensive, legally rigorous response. Return ONLY valid JSON matching this schema:
{
  "detected_issue_summary": "Concise 1-sentence summary of the grievance",
  "cpgrams_department": "Accurate Central Ministry / State Department / Urban Local Body tag (e.g., 'Ministry of Jal Shakti / Municipal Ward Water Works', 'Public Works Department (PWD)', 'Ministry of Consumer Affairs, Food & Public Distribution')",
  "severity": "Critical" | "High" | "Medium",
  "severity_justification": "1-sentence justification highlighting citizen safety, constitutional rights, or public health impact",
  "cpgrams_grievance_draft": "Formal, high-impact English grievance formatted for direct copy-paste into the CPGRAMS portal (pgportal.gov.in). Include Subject, Grievance Category, Location/Ward, Prior Complaint Reference (if provided), Chronology, Violation of Citizen Charter, and Time-bound Relief Sought.",
  "translated_grievance_native": "Complete, accurate translation of the above formal CPGRAMS grievance into the citizen's chosen Indic language (${languageCode}) so the citizen can independently read and verify every single legal clause in their mother tongue.",
  "rti_application_draft": "Formal Right to Information (RTI) Application under Section 6(1) of the RTI Act, 2005 addressed to the Public Information Officer (PIO). Include Subject: Seeking Information under Section 6(1) of RTI Act 2005, and 4 sharp, numbered questions asking for: (1) Certified copies of site inspection logs and file notings; (2) Name, designation, and official contact of responsible officer; (3) Sanctioned budget, contractor agreement, and completion timeline; (4) Daily progress report and action taken on previous complaints.",
  "translated_rti_native": "Complete, accurate translation of the above Section 6(1) RTI application into the citizen's chosen Indic language (${languageCode}).",
  "citizen_reassurance_native": "A warm, empathetic 2-sentence confirmation written entirely in ${languageCode}. Sentence 1 must acknowledge their specific problem with empathy and state that the formal CPGRAMS grievance and RTI application have been prepared. Sentence 2 must clearly guide them to submit the grievance on the portal and file the RTI if no action is taken within 7 days.",
  "citizen_playbook": {
    "statutory_sla_days": "e.g., 30 Days under RTI Act Sec 7(1) (48 Hours if Life & Liberty clause applies); 15-30 Days under DARPG CPGRAMS guidelines",
    "escalation_authority": "Exact official title of First Appellate Authority (FAA) or Nodal Grievance Redressal Officer if initial complaint is ignored",
    "required_attachments": [
      "Exact physical or digital evidence item 1 to attach (e.g., geotagged photo of defect with date)",
      "Exact item 2 (e.g., copy of prior complaint receipt or ration/Aadhaar card copy)",
      "Exact item 3 (e.g., consumer/meter ID or local ward resident representation letter)"
    ],
    "application_fee": "₹10 via Court Fee Stamp / IPO / Online Net Banking for RTI; ₹0 (Completely Free) for CPGRAMS portal",
    "submission_portal_url": "https://pgportal.gov.in"
  }
}`;

    const llmStart = performance.now();
    const chatResponse = await client.chat.completions({
      model: "sarvam-105b-conversations",
      messages: [
        {
          role: "system",
          content:
            "You are a specialized legal assistant for Indian governance, CPGRAMS, and RTI Act 2005. Always output strictly valid JSON without any markdown formatting or commentary.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    const llmEnd = performance.now();

    telemetry.llm = {
      model: "sarvam-105b-conversations",
      latency_ms: Math.round(llmEnd - llmStart),
      prompt_tokens: (chatResponse.usage as any)?.prompt_tokens,
      completion_tokens: (chatResponse.usage as any)?.completion_tokens,
      total_tokens: (chatResponse.usage as any)?.total_tokens,
    };

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

    // STEP 3 — Text-to-Speech (bulbul:v3) for Reassurance
    let audioBase64: string | null = null;
    if (structuredData.citizen_reassurance_native) {
      const ttsStart = performance.now();
      try {
        const ttsResponse = await client.textToSpeech.convert({
          text: structuredData.citizen_reassurance_native,
          language_code: languageCode as any,
          model: "bulbul:v3",
        });

        const ttsEnd = performance.now();
        telemetry.tts = {
          model: "bulbul:v3",
          latency_ms: Math.round(ttsEnd - ttsStart),
          audio_format: "audio/wav",
        };

        if (ttsResponse?.audios && ttsResponse.audios.length > 0) {
          audioBase64 = ttsResponse.audios[0];
        }
      } catch (ttsError) {
        console.warn("TTS generation warning (non-blocking):", ttsError);
      }
    }

    const pipelineEnd = performance.now();
    telemetry.total_latency_ms = Math.round(pipelineEnd - pipelineStart);

    // STEP 4 — Return Unified JSON with Telemetry
    return NextResponse.json({
      transcript,
      structured_data: structuredData,
      audio_base64: audioBase64,
      telemetry,
    });
  } catch (error: any) {
    console.error("Pipeline Error:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred in the grievance pipeline." },
      { status: 500 }
    );
  }
}
