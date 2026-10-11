import { Router } from "express";
import { z } from "zod";

const router = Router();

// Local development default; set AI_SERVICE_URL when FastAPI is hosted separately.
const AI_SERVICE_URL = (
  process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

// The Python service allows up to 90 seconds for Ollama; leave a small buffer.
const AI_TIMEOUT_MS = 95_000;

const missionRequestSchema = z.object({
  available_minutes: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
  ]),
  radius_meters: z.number().int().min(100).max(10000),
  nearby_places: z.array(z.string()).default([]),
});

const generatedMissionSchema = z.object({
  title: z.string().min(3).max(80),
  objective: z.string().min(10).max(300),
  instructions: z.array(z.string().min(1)).min(3).max(5),
});

async function generateWithOpenRouter(
  request: z.infer<typeof missionRequestSchema>,
) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemma-3-4b-it:free",
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are GrassRoute's outdoor mission designer. Return only valid JSON with title, objective, and 3 to 5 concise instructions. Design safe outdoor activities. Never assume a location is open, accessible, or safe. Include enough time to return.",
          },
          {
            role: "user",
            content: JSON.stringify({
              available_minutes: request.available_minutes,
              radius_meters: request.radius_meters,
              nearby_places: request.nearby_places.slice(0, 10),
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw new Error(`OpenRouter returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: { content?: string };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Gemma returned an empty response.");
  }

  let generated: unknown;

  try {
    generated = JSON.parse(content);
  } catch {
    throw new Error("Gemma returned invalid JSON.");
  }

  const result = generatedMissionSchema.safeParse(generated);

  if (!result.success) {
    throw new Error("Gemma returned an invalid mission format.");
  }

  return result.data;
}

function createFallbackMission(request: z.infer<typeof missionRequestSchema>) {
  const durationCopy: Record<number, { title: string; objective: string }> = {
    15: {
      title: "The 15-Minute Reset",
      objective:
        "Take a short, unhurried walk and notice details you usually miss.",
    },
    30: {
      title: "The Neighbourhood Explorer",
      objective:
        "Explore a familiar area from a new perspective at a comfortable pace.",
    },
    45: {
      title: "The Urban Nature Quest",
      objective:
        "Find a suitable public outdoor space and take a mindful pause.",
    },
    60: {
      title: "The One-Hour Adventure",
      objective:
        "Enjoy an unhurried exploration while staying aware of your surroundings.",
    },
  };

  const firstStep = request.nearby_places[0]
    ? `Consider ${request.nearby_places[0]} only if you confirm it is public and accessible.`
    : "Choose a public route that feels comfortable and appropriate.";

  return {
    ...durationCopy[request.available_minutes],
    available_minutes: request.available_minutes,
    radius_meters: request.radius_meters,
    instructions: [
      firstStep,
      "Walk at a comfortable pace and notice three details you normally overlook.",
      "Pause somewhere suitable and observe your surroundings for two minutes.",
      "Leave enough time to return safely before your mission duration expires.",
    ],
    phone_free: true,
    generation_mode: "fallback" as const,
    note: "The AI planner is unavailable, so this is a local mission template.",
  };
}

router.post("/preview", async (req, res) => {
  const parsed = missionRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid mission request",
      details: parsed.error.flatten(),
    });
  }

  if (process.env.OPENROUTER_API_KEY?.trim()) {
  try {
    const generated = await generateWithOpenRouter(parsed.data);

    return res.json({
      ...generated,
      available_minutes: parsed.data.available_minutes,
      radius_meters: parsed.data.radius_meters,
      phone_free: true,
      generation_mode: "openrouter-gemma",
    });
  } catch (error) {
    console.error(
      "OpenRouter mission generation failed:",
      error,
    );

    return res.json(createFallbackMission(parsed.data));
  }
}

  try {
    const response = await fetch(`${AI_SERVICE_URL}/missions/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`AI service returned HTTP ${response.status}`);
    }

    const data: unknown = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("Mission AI service error; using local fallback:", error);
    return res.json(createFallbackMission(parsed.data));
  }
});

export default router;