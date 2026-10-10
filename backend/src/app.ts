
import express from 'express';
import cors from 'cors';
import mapsRouter from './routes/maps.routes.js';
import voiceRouter from './routes/voice.routes.js';
import missionsRouter from './routes/missions.routes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'grassroute-backend' });
});

app.use('/api/v1/maps', mapsRouter);
app.use('/api/v1/voice', voiceRouter);
app.use('/api/v1/missions', missionsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
