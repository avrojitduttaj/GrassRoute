import { Router } from "express";

const router = Router();

router.post("/mission", async (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();

  console.log("ElevenLabs key loaded:", Boolean(apiKey));
  console.log(
    "ElevenLabs key format looks valid:",
    apiKey?.startsWith("sk_") ?? false,
  );

  if (!apiKey) {
    return res.status(500).json({
      error: "ElevenLabs API not configured",
    });
  }

  const text = req.body?.text;

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({
      error: "A non-empty text field is required",
    });
  }

  if (text.length > 3000) {
    return res.status(400).json({
      error: "Mission narration 3000 words/less",
    });
  }

  try {
    const response = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok) {
      const details = await response.text();
      console.error("ElevenLabs error:", response.status, details);

      return res.status(502).json({
        error: "ElevenLabs could not generate the audio.",
        upstreamStatus: response.status,
        details:
          response.status === 401 || response.status === 403
            ? "Check the API key and its Text to Speech permission."
            : "Check the ElevenLabs service response and account limits.",
      });
    }

    const audio = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audio.length);
    res.setHeader("Cache-Control", "no-store");

    return res.send(audio);
  } catch (error) {
    console.error("Voice generation error:", error);

    return res.status(502).json({
      error: "Voice generation failed. Please try again.",
    });
  }
});

export default router;
