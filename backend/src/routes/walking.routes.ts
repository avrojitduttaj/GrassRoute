import { Router } from 'express';
import { z } from 'zod';
import { getWalkingRoute } from '../services/maps/routing.service.js';

const router = Router();

const coordinatesSchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
});

const walkingRouteRequestSchema = z.object({
  start: coordinatesSchema,
  destination: coordinatesSchema,
});

router.post('/route', async (req, res) => {
  const parsed = walkingRouteRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid walking-route request',
      details: parsed.error.flatten(),
    });
  }

  const { start, destination } = parsed.data;
  const samePoint =
    start.latitude === destination.latitude &&
    start.longitude === destination.longitude;

  if (samePoint) {
    return res.status(400).json({
      error: 'Choose a destination different from your starting point.',
    });
  }

  try {
    const route = await getWalkingRoute(start, destination);
    return res.json({
      start,
      destination,
      roundTrip: true,
      ...route,
      note: 'Walking distance and time are estimates. Check access and surroundings; mapped data does not guarantee a place is public, open, or safe.',
    });
  } catch (error) {
    console.error('Walking route calculation failed:', error);
    return res.status(502).json({
      error: 'Could not calculate a pedestrian route.',
      details: error instanceof Error ? error.message : 'The routing service failed.',
    });
  }
});

export default router;
