'use strict';
require('dotenv').config();
const http = require('http');
const { app, executionLayer } = require('./app');
const { Server } = require('socket.io');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const { encrypt, getKeys } = require('./modules/encryption');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  logger.info(`Dashboard client connected: ${socket.id}`);

  // Emit initial dashboard data with encrypted transactions
  socket.emit('dashboardInit', {
    settlementMode: process.env.SETTLEMENT_MODE || 'both',
    batchSize: executionLayer.batchSize,
    currentTransactions: executionLayer.transactions.map(tx => ({
      ...tx,
      amount: encrypt(getKeys(), tx.amount)
    }))
  });

  socket.on('requestTransactionUpdate', () => {
    socket.emit('transactionUpdate', {
      transactions: executionLayer.transactions.map(tx => ({
        ...tx,
        amount: encrypt(getKeys(), tx.amount)
      }))
    });
  });

  socket.on('disconnect', () => {
    logger.info(`Dashboard client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`FHE-enabled API server live on port ${PORT}`);
});

// Global error handling
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

