'use strict';
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const ExecutionLayer = require('./modules/executionLayer');

const app = express();
const executionLayerInstance = new ExecutionLayer(parseInt(process.env.BATCH_SIZE) || 10);

// Use security middleware
app.use(helmet());

// Use body parser middleware with strict limits
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const transactionsRouter = require('./api/transactions')(executionLayerInstance);
const settlementRouter = require('./api/settlement')(executionLayerInstance); // Ensure similar updates on settlement routes if needed
app.use('/api', transactionsRouter);
app.use('/api', settlementRouter);

// Serve the dashboard page
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = { app, executionLayer: executionLayerInstance };
