"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Volume2,
  Copy,
  Check,
  Download,
  ExternalLink,
  FileText,
  ShieldAlert,
  Building2,
  Sparkles,
  UploadCloud,
  RotateCcw,
  Send,
  Scale,
  Languages,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface StructuredGrievance {
  detected_issue_summary: string;
  cpgrams_department: string;
  severity: "Critical" | "High" | "Medium";
  severity_justification: string;
  cpgrams_grievance_draft: string;
  rti_application_draft: string;
  citizen_reassurance_native: string;
}

interface ProcessResult {
  transcript: string;
  structured_data: StructuredGrievance;
  audio_base64: string | null;
}

const LANGUAGES = [
  { code: "hi-IN", label: "हिन्दी", name: "Hindi" },
  { code: "mr-IN", label: "मराठी", name: "Marathi" },
  { code: "ta-IN", label: "தமிழ்", name: "Tamil" },
  { code: "te-IN", label: "తెలుగు", name: "Telugu" },
  { code: "kn-IN", label: "ಕನ್ನಡ", name: "Kannada" },
  { code: "bn-IN", label: "বাংলা", name: "Bengali" },
];

const PRESETS = [
  {
    title: "Ward 14 Burst Pipeline",
    lang: "hi-IN",
    badge: "Hindi • Jal Shakti",
    text: "वार्ड 14, शांति नगर में मुख्य जलापूर्ति पाइपलाइन 3 दिनों से पूरी तरह टूट चुकी है। लाखों लीटर शुद्ध पेयजल सड़क पर बह रहा है, सड़क धंस रही है और घरों में सीवेज मिला गंदा पानी आ रहा है। स्थानीय जल बोर्ड को कई बार शिकायत की पर कोई सुनवाई नहीं हुई।",
  },
  {
    title: "Ration Grain Denial",
    lang: "mr-IN",
    badge: "Marathi • PDS",
    text: "आमच्या गावातील रास्त भाव धान्य दुकानदाराने (राशन दुकान क्रमांक 42) अंत्योदय व बीपीएल कार्डधारकांना चालू महिन्याचे गहू आणि तांदूळ देण्यास नकार दिला आहे. पावत्या न देता नागरिकांना धमकावले जात आहे आणि धान्य काळ्या बाजारात विकले जात असल्याचा संशय आहे.",
  },
  {
    title: "Highway Pothole Hazard",
    lang: "ta-IN",
    badge: "Tamil • NHAI / PWD",
    text: "செங்கல்பட்டு தேசிய நெடுஞ்சாலையில் (NH 45) பாலத்தின் அருகே சுமார் 3 அடி ஆழமுள்ள மிகப்பெரிய பள்ளம் உள்ளது. கடந்த ஒரு வாரத்தில் 4 இருசக்கர வாகன விபத்துகள் நடந்து பலர் படுகாயமடைந்துள்ளனர். PWD மற்றும் NHAI அதிகாரிகள் உடனடியாக அவசர சீரமைப்பு நடவடிக்கை எடுக்க வேண்டும்.",
  },
];

export default function AwazEShikayatPage() {
  const [selectedLang, setSelectedLang] = useState("hi-IN");
  const [textInput, setTextInput] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Processing State
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Output UI State
  const [activeTab, setActiveTab] = useState<"cpgrams" | "rti">("cpgrams");
  const [copiedCpgrams, setCopiedCpgrams] = useState(false);
  const [copiedRti, setCopiedRti] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle Voice Recording
  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const file = new File([audioBlob], `recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        setAudioFile(file);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setError(
        "Microphone access denied or not supported. You can type or use the instant 1-click sample presets below."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Process Pipeline
  const handleProcess = async (
    overrideText?: string,
    overrideLang?: string,
    overrideAudio?: File | null
  ) => {
    const textToUse = overrideText !== undefined ? overrideText : textInput;
    const langToUse = overrideLang || selectedLang;
    const audioToUse = overrideAudio !== undefined ? overrideAudio : audioFile;

    if (!textToUse.trim() && !audioToUse) {
      setError("Please record your voice, upload an audio file, or enter your complaint.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("language_code", langToUse);

    if (audioToUse) {
      formData.append("audio", audioToUse);
      setLoadingStep("1/3 Transcribing citizen voice via Sarvam Saaras v3...");
    } else {
      formData.append("text", textToUse);
      setLoadingStep("1/3 Processing citizen complaint transcript...");
    }

    try {
      // Small simulated step update for UX transparency
      setTimeout(() => {
        setLoadingStep("2/3 Drafting CPGRAMS & RTI Legal Sections via Sarvam-105b...");
      }, 1800);

      setTimeout(() => {
        setLoadingStep("3/3 Synthesizing native voice reassurance via Sarvam Bulbul v3...");
      }, 4200);

      const response = await fetch("/api/process-grievance", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process grievance");
      }

      setResult(data);

      // Auto play the returned Indic voice reassurance
      if (data.audio_base64) {
        setTimeout(() => {
          if (audioPlayerRef.current) {
            audioPlayerRef.current.play().catch(() => {
              // Browser autoplay policy might block silent initial play
            });
          }
        }, 300);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during grievance processing.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const loadPreset = (preset: (typeof PRESETS)[0]) => {
    setSelectedLang(preset.lang);
    setTextInput(preset.text);
    setAudioFile(null);
    handleProcess(preset.text, preset.lang, null);
  };

  const copyToClipboard = (text: string, type: "cpgrams" | "rti") => {
    navigator.clipboard.writeText(text);
    if (type === "cpgrams") {
      setCopiedCpgrams(true);
      setTimeout(() => setCopiedCpgrams(false), 2000);
    } else {
      setCopiedRti(true);
      setTimeout(() => setCopiedRti(false), 2000);
    }
  };

  const downloadText = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "bg-rose-100 text-rose-800 border-rose-300 ring-rose-500/20";
      case "high":
        return "bg-amber-100 text-amber-800 border-amber-300 ring-amber-500/20";
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-300 ring-emerald-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-200/50">
      {/* Top Civic Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-orange-500/20 ring-2 ring-orange-200">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  आवाज़-ए-शिकायत
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                  Awaz-e-Shikayat
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Indic Voice to CPGRAMS & RTI Legal Drafter • Powered by Sarvam AI
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Sarvam AI Online</span>
            </div>
            <a
              href="https://pgportal.gov.in/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs"
            >
              CPGRAMS Portal
              <ExternalLink className="h-3 w-3 ml-1 text-slate-400" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-orange-800 text-xs font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5 text-orange-600" />
            <span>Saaras v3 STT • Sarvam-105b LLM • Bulbul v3 TTS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            Speak Your Grievance in Any Indian Language.
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Get an instant, legally structured{" "}
            <strong className="text-slate-900 font-semibold">CPGRAMS Portal Complaint</strong> and an enforceable{" "}
            <strong className="text-slate-900 font-semibold">Section 6(1) RTI Application</strong> with voice reassurance.
          </p>
        </div>

        {/* 1-Click Demo Presets Bar */}
        <div className="mb-8 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                1-Click Live Demo Scenarios (Instant Evaluation)
              </span>
            </div>
            <span className="text-xs text-slate-500">Click any preset to execute the full 3-step pipeline</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => loadPreset(preset)}
                disabled={loading}
                className="group text-left p-3.5 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 bg-slate-50/50 transition-all shadow-2xs hover:shadow-sm"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-orange-700">
                    {preset.title}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                    {preset.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 italic">
                  &ldquo;{preset.text}&rdquo;
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid: Input & Output */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Voice & Text Input */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              {/* Language Selector Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <label className="flex items-center space-x-2 text-sm font-semibold text-slate-800">
                  <Languages className="h-4 w-4 text-orange-600" />
                  <span>Select Citizen Language</span>
                </label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label} ({l.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Voice Recorder Area */}
              <div className="mt-5 text-center p-6 rounded-2xl bg-gradient-to-b from-orange-50/50 to-slate-50 border border-dashed border-orange-200">
                <div className="relative inline-flex items-center justify-center">
                  {isRecording && (
                    <span className="absolute inline-flex h-24 w-24 rounded-full bg-rose-400 opacity-75 animate-ping"></span>
                  )}
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={loading}
                    className={`relative z-10 h-20 w-20 rounded-full flex flex-col items-center justify-center shadow-lg transition-all transform active:scale-95 ${
                      isRecording
                        ? "bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-200"
                        : "bg-gradient-to-tr from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white ring-4 ring-orange-100 shadow-orange-500/30"
                    }`}
                  >
                    {isRecording ? (
                      <Square className="h-7 w-7" />
                    ) : (
                      <Mic className="h-8 w-8" />
                    )}
                  </button>
                </div>

                <div className="mt-3">
                  {isRecording ? (
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-rose-600 flex items-center justify-center space-x-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                        <span>Recording Citizen Voice: {formatSeconds(recordingSeconds)}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Click square to stop and analyze with Saaras v3
                      </p>
                    </div>
                  ) : audioFile ? (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-emerald-700 flex items-center justify-center space-x-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Recorded Audio Ready ({audioFile.name})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAudioFile(null)}
                        className="text-[11px] text-slate-500 hover:text-rose-600 underline"
                      >
                        Discard Recording
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Click Microphone to Speak Your Complaint
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Speak naturally in your native language
                      </p>
                    </div>
                  )}
                </div>

                {/* File Upload Alternative */}
                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-center space-x-2 text-xs text-slate-600">
                  <label className="cursor-pointer inline-flex items-center space-x-1 text-orange-700 hover:text-orange-800 font-semibold">
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Upload Audio File (.wav, .mp3, .webm)</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setAudioFile(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Text Fallback Section */}
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Or Enter Complaint Text
                  </label>
                  {textInput && (
                    <button
                      type="button"
                      onClick={() => setTextInput("")}
                      className="text-[11px] text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="आप अपनी समस्या यहाँ लिख भी सकते हैं (जैसे सड़क, पानी, राशन, अस्पताल)..."
                  rows={4}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Submit Action Button */}
              <button
                type="button"
                onClick={() => handleProcess()}
                disabled={loading || isRecording || (!textInput.trim() && !audioFile)}
                className="mt-5 w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-orange-600 text-white font-semibold text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Executing Sarvam AI Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Generate CPGRAMS & RTI Legal Drafts</span>
                  </>
                )}
              </button>

              {/* Processing Progress Status */}
              {loading && (
                <div className="mt-4 p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 text-xs font-medium space-y-2 animate-pulse">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-700" />
                    <span>{loadingStep}</span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error:</span> {error}
                  </div>
                </div>
              )}
            </div>

            {/* Indian Civic Law Info Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-600 space-y-2">
              <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                <Scale className="h-4 w-4 text-indigo-600" />
                <span>Statutory Governance Standards</span>
              </div>
              <p>
                <strong>CPGRAMS:</strong> Governed by the Department of Administrative Reforms & Public Grievances (DARPG). Mandates time-bound resolution (typically 30 days).
              </p>
              <p>
                <strong>RTI Act 2005 (Section 6(1)):</strong> Provides citizens the legal right to inspect records and demand certified copies from Public Information Officers (PIOs).
              </p>
            </div>
          </div>

          {/* Right Column: Output Workspace */}
          <div className="lg:col-span-7 space-y-6">
            {!result ? (
              <div className="h-full min-h-[460px] flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200 text-center">
                <div className="h-16 w-16 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 mb-4">
                  <FileText className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Legal Drafting Workspace
                </h3>
                <p className="mt-1.5 text-xs text-slate-500 max-w-md">
                  Record your voice or click one of the 1-click sample presets above to generate a submission-ready CPGRAMS draft, Section 6(1) RTI application, and native Indic voice reassurance.
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-fadeIn">
                {/* 1. Citizen Voice Feedback & Reassurance Banner */}
                <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-indigo-700 text-white rounded-2xl p-5 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Volume2 className="h-5 w-5 text-amber-200" />
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-100">
                        Citizen Native Voice Confirmation (Sarvam Bulbul v3)
                      </span>
                    </div>
                    {result.audio_base64 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">
                        Audio Synced
                      </span>
                    )}
                  </div>

                  <p className="text-sm sm:text-base font-medium leading-relaxed mb-3">
                    &ldquo;{result.structured_data.citizen_reassurance_native}&rdquo;
                  </p>

                  {result.audio_base64 && (
                    <div className="mt-2 bg-black/20 backdrop-blur-xs rounded-xl p-2.5 flex items-center space-x-3">
                      <audio
                        ref={audioPlayerRef}
                        controls
                        src={`data:audio/wav;base64,${result.audio_base64}`}
                        className="w-full h-8"
                      />
                    </div>
                  )}

                  {/* Original Transcript Accordion */}
                  <div className="mt-3 pt-3 border-t border-white/20 text-xs text-amber-50">
                    <span className="font-semibold text-white">Recognized Complaint:</span>{" "}
                    <span className="italic">{result.transcript}</span>
                  </div>
                </div>

                {/* 2. Department & Severity Badges Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Target Jurisdiction / Department
                    </div>
                    <div className="flex items-center space-x-2 text-sm font-bold text-slate-900">
                      <Building2 className="h-4 w-4 text-orange-600" />
                      <span>{result.structured_data.cpgrams_department}</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-right">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Urgency Classification
                    </div>
                    <div className="flex items-center justify-end space-x-2">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full border ring-2 ${getSeverityBadgeClass(
                          result.structured_data.severity
                        )}`}
                      >
                        {result.structured_data.severity} Urgency
                      </span>
                    </div>
                  </div>

                  <div className="w-full pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-start space-x-2">
                    <ShieldAlert className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-800">Issue Summary:</strong>{" "}
                      {result.structured_data.detected_issue_summary} (
                      {result.structured_data.severity_justification})
                    </span>
                  </div>
                </div>

                {/* 3. Side-by-Side / Tabbed Legal Drafts */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Tabs Header */}
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 pt-2">
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("cpgrams")}
                        className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-t-2 ${
                          activeTab === "cpgrams"
                            ? "bg-white text-orange-600 border-orange-500 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900 border-transparent"
                        }`}
                      >
                        1. CPGRAMS Formal Grievance
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("rti")}
                        className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-t-2 ${
                          activeTab === "rti"
                            ? "bg-white text-indigo-600 border-indigo-500 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900 border-transparent"
                        }`}
                      >
                        2. Legal RTI Application (Sec 6(1))
                      </button>
                    </div>

                    <div className="flex items-center space-x-2 pb-2">
                      {activeTab === "cpgrams" ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                result.structured_data.cpgrams_grievance_draft,
                                "cpgrams"
                              )
                            }
                            className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
                          >
                            {copiedCpgrams ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-slate-500" />
                            )}
                            <span>{copiedCpgrams ? "Copied!" : "Copy"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadText(
                                "CPGRAMS_Formal_Grievance_Draft.txt",
                                result.structured_data.cpgrams_grievance_draft
                              )
                            }
                            className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
                          >
                            <Download className="h-3.5 w-3.5 text-slate-500" />
                            <span>Download</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                result.structured_data.rti_application_draft,
                                "rti"
                              )
                            }
                            className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
                          >
                            {copiedRti ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-slate-500" />
                            )}
                            <span>{copiedRti ? "Copied!" : "Copy"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadText(
                                "RTI_Section_6_1_Application.txt",
                                result.structured_data.rti_application_draft
                              )
                            }
                            className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
                          >
                            <Download className="h-3.5 w-3.5 text-slate-500" />
                            <span>Download</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tab Body */}
                  <div className="p-6">
                    {activeTab === "cpgrams" ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            Portal-Ready Submission Format • Standard DARPG Guidelines
                          </span>
                          <a
                            href="https://pgportal.gov.in/Registration"
                            target="_blank"
                            rel="noreferrer"
                            className="text-orange-600 font-bold hover:underline inline-flex items-center"
                          >
                            Open pgportal.gov.in
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </div>
                        <pre className="font-mono text-xs sm:text-sm bg-slate-900 text-slate-100 p-5 rounded-xl whitespace-pre-wrap leading-relaxed overflow-x-auto shadow-inner selection:bg-orange-500">
                          {result.structured_data.cpgrams_grievance_draft}
                        </pre>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            Legally Enforceable under Section 6(1) of the RTI Act, 2005
                          </span>
                          <a
                            href="https://rtionline.gov.in/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 font-bold hover:underline inline-flex items-center"
                          >
                            Open rtionline.gov.in
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </div>
                        <pre className="font-mono text-xs sm:text-sm bg-slate-900 text-slate-100 p-5 rounded-xl whitespace-pre-wrap leading-relaxed overflow-x-auto shadow-inner selection:bg-indigo-500">
                          {result.structured_data.rti_application_draft}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-700">
            Awaz-e-Shikayat • Built for Sarvam AI Hackathon
          </p>
          <p>
            Zero-friction citizen empowerment bridging vernacular voices to Indian Administrative Justice.
          </p>
        </div>
      </footer>
    </div>
  );
}
