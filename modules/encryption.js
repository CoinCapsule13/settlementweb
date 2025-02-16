'use strict';
let tfheModule = null;
let clientKey = null;
let config = null;
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function loadTFHE() {
  if (!tfheModule) {
    try {
      const module = await import('node-tfhe');
      tfheModule = module.default || module;
    } catch (error) {
      logger.error(`Failed to load TFHE module: ${error.message}`);
      throw error;
    }
  }
  return tfheModule;
}

async function generateKeys() {
  const tfhe = await loadTFHE();
  if (typeof tfhe.init_panic_hook === 'function') {
    tfhe.init_panic_hook();
  }
  config = tfhe.TfheConfigBuilder.default().build();
  clientKey = tfhe.TfheClientKey.generate(config);
  logger.info("FHE keys generated successfully.");
  return clientKey;
}

async function getKeys() {
  if (!clientKey) {
    await generateKeys();
  }
  return clientKey;
}

async function encryptValue(value) {
  try {
    const tfhe = await loadTFHE();
    const key = await getKeys();
    const bigValue = BigInt(value);
    return tfhe.Shortint.encrypt(key, bigValue);
  } catch (error) {
    logger.error(`Encryption failed: ${error.message}`);
    throw error;
  }
}

async function decryptValue(encryptedValue) {
  try {
    const tfhe = await loadTFHE();
    const key = await getKeys();
    return tfhe.Shortint.decrypt(encryptedValue, key);
  } catch (error) {
    logger.error(`Decryption failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  generateKeys,
  getKeys,
  encryptValue,
  decryptValue,
};
