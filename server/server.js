require('dotenv').config();

const assertProductionSecrets = require('./config/assertProductionSecrets');
assertProductionSecrets();

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const buildCorsOptions = require('./config/corsOptions');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const testRoutes = require('./routes/test.routes');
const machineRoutes = require('./routes/machine.routes');
const blockProductRoutes = require('./routes/blockProduct.routes');
const workOrderRoutes = require('./routes/workOrder.routes');
const orderItemRoutes = require('./routes/orderItem.routes');
const dailyLogRoutes = require('./routes/dailyLog.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const paymentRoutes = require('./routes/payment.routes');
const reportRoutes = require('./routes/report.routes');

connectDB();

const app = express();

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors(buildCorsOptions()));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));

const api = '/api/v1';

/** Broad API limiter — per IP. Login/register use dedicated limiters in auth routes (skip double-count here). */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 2000),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    return p === '/auth/login' || p === '/auth/register';
  },
});

app.use(api, apiLimiter);

app.use(`${api}/auth`, authRoutes);
app.use(`${api}/users`, userRoutes);
app.use(`${api}/machines`, machineRoutes);
app.use(`${api}/block-products`, blockProductRoutes);
app.use(`${api}/tests`, testRoutes);
app.use(`${api}/work-orders`, workOrderRoutes);
app.use(`${api}/order-items`, orderItemRoutes);
app.use(`${api}/daily-logs`, dailyLogRoutes);
app.use(`${api}/appointments`, appointmentRoutes);
app.use(`${api}/payments`, paymentRoutes);
app.use(`${api}/reports`, reportRoutes);

app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  const isProd = process.env.NODE_ENV === 'production';
  const message = isProd ? 'Internal server error' : err.message || 'Internal server error';
  res.status(500).json({ success: false, message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
