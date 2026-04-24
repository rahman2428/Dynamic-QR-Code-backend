const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/db');
const redirectController = require('./controllers/redirectController');

const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { message: 'Too many requests, please try again later.' }
});

const redirectLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 min
  max: 60,
  message: 'Too many requests.'
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Redirect route (public, must be before API limiter)
app.get('/r/:id', redirectLimiter, redirectController.handleRedirect);

// API routes
app.use('/api', apiLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/qrcodes', require('./routes/qrcodes'));
app.use('/api/analytics', require('./routes/analytics'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   🚀 QR Code Manager Server Running     ║
  ║   Port: ${PORT}                            ║
  ║   Mode: ${process.env.NODE_ENV || 'development'}                  ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
