import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import salesRoutes from './routes/sales';
import replicationRoutes from './routes/replication';
import adminRoutes from './routes/admin';
import stockRoutes from './routes/stock';
import reportsRoutes from './routes/reports';
import profitsRoutes from './routes/profits';

const app = express();
const PORT = process.env.PORT || 4000;

const ALLOWED_ORIGINS = [
  'https://pharmasalespwa.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const corsOptions: cors.CorsOptions = {
  origin: true, // Accept all origins — tighten after Vercel CORS is confirmed working
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));
// Explicitly handle preflight for all routes (Express 5 compatible — no bare '*')
app.options(/.*/, cors(corsOptions) as any);
app.use(helmet());
app.use(express.json());

// Base API Routes
app.use('/auth', authRoutes);
app.use('/sales', salesRoutes);
app.use('/replication', replicationRoutes);
app.use('/admin', adminRoutes);
app.use('/stock', stockRoutes);
app.use('/reports', reportsRoutes);
app.use('/profits', profitsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
