export type VoxConfig = {
  openaiApiKey: string;
  openaiRealtimeModel: string;
  openaiRealtimeVoice: string | null;
  openaiRealtimeUrl: string | null;
  openaiInputAudioType: "audio/pcmu";
  openaiOutputAudioType: "audio/pcmu";
  openaiTranscriptionModel: string | null;

  publicBaseUrl: URL | null;
  agentUrl: URL | null;
  agentCmd: string | null;
  logDir: string;
  initialGreeting: string | null;

  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
};

function env(name: string): string | null {
  const v = process.env[name];
  if (!v) return null;
  const s = v.trim();
  return s.length ? s : null;
}

function envUrl(name: string): URL | null {
  const v = env(name);
  if (!v) return null;
  return new URL(v);
}

export function loadConfig(): VoxConfig {
  const openaiApiKey = env("OPENAI_API_KEY");
  if (!openaiApiKey) throw new Error("Missing OPENAI_API_KEY");

  const openaiRealtimeModel = env("OPENAI_REALTIME_MODEL") ?? "gpt-realtime";
  const openaiRealtimeVoice = env("OPENAI_REALTIME_VOICE");
  // Optional ws(s):// endpoint override: realtime gateways, self-hosted
  // relays, or a local stand-in when exercising the bridge end-to-end.
  const openaiRealtimeUrl = envUrl("OPENAI_REALTIME_URL")?.toString() ?? null;

  const openaiInputAudioType = "audio/pcmu" as const;
  const openaiOutputAudioType = "audio/pcmu" as const;
  const openaiTranscriptionModel = env("OPENAI_TRANSCRIPTION_MODEL") ?? "gpt-4o-transcribe";

  const publicBaseUrl = envUrl("VOX_PUBLIC_BASE_URL");
  const agentUrl = envUrl("VOX_AGENT_URL");
  const agentCmd = env("VOX_AGENT_CMD");
  const logDir = env("VOX_LOG_DIR") ?? "./logs";
  const initialGreeting = env("VOX_INITIAL_GREETING");

  const twilioAccountSid = env("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = env("TWILIO_AUTH_TOKEN");

  if (agentUrl && agentCmd) {
    throw new Error("Set only one of VOX_AGENT_URL or VOX_AGENT_CMD");
  }

  return {
    openaiApiKey,
    openaiRealtimeModel,
    openaiRealtimeVoice,
    openaiRealtimeUrl,
    openaiInputAudioType,
    openaiOutputAudioType,
    openaiTranscriptionModel,
    publicBaseUrl,
    agentUrl,
    agentCmd,
    logDir,
    initialGreeting,
    twilioAccountSid,
    twilioAuthToken,
  };
}
