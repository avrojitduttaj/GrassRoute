
import { Router } from "express";
import { z } from "zod";

const router = Router();

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

router.post("/preview", async (req, res) => {
  const parsed = missionRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid mission request",
      details: parsed.error.flatten(),
    });
  }

  try {
    const response = await fetch(
      "http://127.0.0.1:8000/missions/preview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(10000),
      }
    );

    const data: unknown = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "AI service rejected the mission request",
        details: data,
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("Mission AI service error:", error);

    return res.status(503).json({
      error: "Mission AI service is unavailable",
      message: "Check that the Python service is running on port 8000.",
    });
  }
});

export default router;

