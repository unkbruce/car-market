import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import carsRouter from './routes/cars.js';
import usersRouter from './routes/users.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/cars', carsRouter);
app.use('/api/users', usersRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Car Market API is running',
  });
});

export default app;
