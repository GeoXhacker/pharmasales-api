import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import salesRoutes from './routes/sales';
import replicationRoutes from './routes/replication';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(helmet());
app.use(express.json());

// Base API Routes
app.use('/auth', authRoutes);
app.use('/sales', salesRoutes);
app.use('/replication', replicationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
