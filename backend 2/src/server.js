require('dotenv').config();
const express = require('express');
const cors = require('cors');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), winston.format.simple()) }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

const app = express();
app.use(express.json({ extended: false }));
app.use(cors());
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, { body: req.body, query: req.query, params: req.params });
  next();
});

let dbConnected = false;
try {
  if (process.env.MONGO_URI && process.env.OFFLINE_MODE !== 'true') {
    const connectDB = require('./config/db');
    connectDB();
    dbConnected = true;
    logger.info('MongoDB Connected...');
  } else {
    logger.info('Running in offline mode - MongoDB connection skipped');
  }
} catch (err) {
  logger.error('MongoDB connection error:', err.message);
  logger.info('Running in offline mode');
});

app.use('/api', require('./routes/api'));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    dbConnected,
    environment: process.env.NODE_ENV || 'development',
    offlineMode: !dbConnected
  });
});

app.use((err, req, res, next) => {
  logger.error('Server error:', { message: err.message, stack: err.stack, code: err.code, status: err.status, path: req.path });
  res.status(err.status || 500).json({
    error: 'Server Error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Offline Mode: ${process.env.OFFLINE_MODE === 'true' ? 'Enabled' : 'Disabled'}`);
  logger.info(`OpenAI API Key configured: ${!!process.env.OPENAI_API_KEY}`);
});