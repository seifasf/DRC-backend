require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

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

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const api = '/api/v1';

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
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
