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