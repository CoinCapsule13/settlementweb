'use strict';
const { ethers } = require("ethers");
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

if (!process.env.CONTRACT_ADDRESS || !process.env.ETHEREUM_RPC || !process.env.PRIVATE_KEY) {
  throw new Error("Environment variables CONTRACT_ADDRESS, ETHEREUM_RPC, and PRIVATE_KEY must be set");
}

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ABI = [
  "function storeEncryptedTransaction(bytes32 txHash, bytes encryptedAmount, address recipient) public",
  "function verifyEncryptedTransaction(bytes32 txHash, bytes proof) public view returns (bool)",
  "function getEncryptedTransaction(bytes32 txHash) public view returns (bytes encryptedAmount, address recipient)",
  "event TransactionStored(bytes32 indexed txHash, address indexed recipient)"
];

let contractInstance = null;

function initContract() {
  if (contractInstance) return contractInstance;
  try {
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    contractInstance = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
    logger.info("Smart contract initialized successfully.");
    return contractInstance;
  } catch (error) {
    logger.error(`Failed to initialize smart contract: ${error.message}`);
    throw error;
  }
}

async function storeEncryptedTransaction(txHash, encryptedAmount, recipient) {
  const contract = initContract();
  try {
    logger.info(`Storing transaction on-chain: ${txHash}`);
    const tx = await contract.storeEncryptedTransaction(txHash, encryptedAmount, recipient);
    await tx.wait();
    logger.info(`Transaction confirmed on-chain: ${txHash}`);
    return tx;
  } catch (error) {
    logger.error(`Error storing encrypted transaction: ${error.message}`);
    throw error;
  }
}

async function verifyEncryptedTransaction(txHash, proof) {
  const contract = initContract();
  try {
    return await contract.verifyEncryptedTransaction(txHash, proof);
  } catch (error) {
    logger.error(`Error verifying encrypted transaction: ${error.message}`);
    throw error;
  }
}

async function getEncryptedTransaction(txHash) {
  const contract = initContract();
  try {
    return await contract.getEncryptedTransaction(txHash);
  } catch (error) {
    logger.error(`Error retrieving encrypted transaction: ${error.message}`);
    throw error;
  }
}

module.exports = {
  initContract,
  storeEncryptedTransaction,
  verifyEncryptedTransaction,
  getEncryptedTransaction
};
