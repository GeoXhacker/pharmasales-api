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

app.use(cors());
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
