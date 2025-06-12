async function handler({ text }) {
  const CHUNK_SIZE = 1024;
  const VOICE_ID = "Xb7hH8MSUJpSbSDYk0k2";
  const tts_url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;

  const headers = {
    Accept: "application/json",
    "xi-api-key": process.env.ELEVENLABS_API_KEY,
    "Content-Type": "application/json",
  };

  const data = {
    text: text,
    model_id: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.0,
      use_speaker_boost: true,
    },
  };

  try {
    const response = await fetch(tts_url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");

    return {
      audioContent: base64Audio,
      contentType: "audio/mpeg",
    };
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}
export async function POST(request) {
  return handler(await request.json());
}