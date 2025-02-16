'use strict';
const express = require('express');
const router = express.Router();
const { encryptValue } = require('../modules/encryption');
const { ethers } = require('ethers');
const settlementContract = require('../modules/settlementContract');
const Joi = require('joi');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

module.exports = (executionLayer) => {
  // Validation schema for incoming transactions
  const transactionSchema = Joi.object({
    amount: Joi.number().positive().required(),
    recipient: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
  });

  // POST /api/transactions: Submit an encrypted transaction
  router.post('/transactions', async (req, res) => {
    const { error, value } = transactionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    try {
      const { amount, recipient } = value;
      // Encrypt the transaction amount securely
      const encryptedAmount = await encryptValue(amount);
      
      // Create the transaction object
      const txObject = { amount: encryptedAmount, recipient };

      // Execute off-chain transaction logic
      await executionLayer.executeTransaction(txObject);
      
      // Generate a unique transaction hash using ethers’ keccak256
      const txHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(txObject)));
      
      // Store the encrypted transaction on-chain
      await settlementContract.storeEncryptedTransaction(txHash, encryptedAmount, recipient);
      
      logger.info(`Transaction processed and stored on-chain: ${txHash}`);
      res.status(200).json({ status: 'Transaction accepted and stored on-chain', txHash });
    } catch (err) {
      logger.error(`Error processing transaction: ${err.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/decrypted-transactions: Retrieve decrypted transactions
  router.get('/decrypted-transactions', async (req, res) => {
    try {
      let transactions = await executionLayer.getDecryptedTransactions();
      // Decrypt each transaction's amount asynchronously
      transactions = await Promise.all(transactions.map(async (tx) => ({
        ...tx,
        amount: await executionLayer.decryptTransactionAmount(tx.amount)
      })));
      res.status(200).json({ transactions });
    } catch (err) {
      logger.error(`Error retrieving decrypted transactions: ${err.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};

