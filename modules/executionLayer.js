'use strict';
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

class ExecutionLayer {
  constructor(batchSize = 10) {
    this.transactions = [];
    this.batchSize = batchSize;
    this.clientKey = null;
    this.serverKeys = null;
    this.tfhe = null;
  }

  async initializeTFHE() {
    if (!this.tfhe) {
      try {
        const module = await import('tfhe');
        this.tfhe = module.default || module;
      } catch (error) {
        logger.error(`Failed to load TFHE module in ExecutionLayer: ${error.message}`);
        throw error;
      }
    }
  }

  async initializeKeys() {
    await this.initializeTFHE();
    if (!this.clientKey) {
      try {
        const keys = this.tfhe.generate_keys();
        this.clientKey = keys[0];
        this.serverKeys = keys[1];
        logger.info("FHE keys generated in ExecutionLayer.");
      } catch (error) {
        logger.error(`Key generation failed: ${error.message}`);
        throw error;
      }
    }
  }

  async executeTransaction(tx) {
    try {
      await this.initializeKeys();
      // Encrypt the transaction amount using TFHE
      tx.amount = this.tfhe.try_encrypt(tx.amount, this.clientKey);
      this.transactions.push(tx);
      logger.info(`Encrypted transaction executed: ${JSON.stringify(tx)}`);
    } catch (error) {
      logger.error(`Error executing transaction: ${error.message}`);
      throw error;
    }
  }

  async getDecryptedTransactions() {
    await this.initializeKeys();
    return this.transactions.map(tx => ({
      ...tx,
      amount: this.tfhe.decrypt(tx.amount, this.clientKey),
    }));
  }

  async decryptTransactionAmount(encryptedAmount) {
    await this.initializeKeys();
    return this.tfhe.decrypt(encryptedAmount, this.clientKey);
  }
}

module.exports = ExecutionLayer;
