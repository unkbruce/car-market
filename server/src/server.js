import app from './app.js';
import { connectDB } from './config/db.js';
import { createServer } from 'http';
import setupSocket from './socket.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();

    const server = createServer(app);
    setupSocket(server);

    server.listen(PORT, () => {
      console.log(`Car Market API server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB Atlas. Server was not started.');
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
