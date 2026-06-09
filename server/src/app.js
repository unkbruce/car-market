import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import agentRouter from './routes/agent.js';
import carsRouter from './routes/cars.js';
import chatsRouter from './routes/chats.js';
import usersRouter from './routes/users.js';
import { getCorsOptions } from './config/cors.js';
import { uploadsDir } from './middleware/upload.js';

dotenv.config();

const app = express();

app.use(cors(getCorsOptions()));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

app.use('/api/agent', agentRouter);
app.use('/api/cars', carsRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/users', usersRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Car Market API is running',
  });
});

export default app;
