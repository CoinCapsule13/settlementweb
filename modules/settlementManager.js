'use strict';
require('dotenv').config();
const { ethers } = require('ethers');
const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const { encrypt } = require('tfhe'); // Assuming tfhe provides an encrypt function

function getPrivateKeyFromVault(keyName) {
  if (!process.env[keyName]) throw new Error(`${keyName} is not set`);
  return process.env[keyName];
}

class SettlementManager {
  constructor() {
    const ethereumRpc = process.env.ETHEREUM_RPC;
    this.ethProvider = new ethers.providers.JsonRpcProvider(ethereumRpc);
    const privateKey = getPrivateKeyFromVault('PRIVATE_KEY');
    this.ethWallet = new ethers.Wallet(privateKey, this.ethProvider);
    this.ethContractAddress = process.env.CONTRACT_ADDRESS;
    this.ethContractABI = ['function storeMerkleRoot(bytes32 root) public'];
    this.ethContract = new ethers.Contract(this.ethContractAddress, this.ethContractABI, this.ethWallet);

    this.bitcoinNetwork = process.env.BITCOIN_NETWORK === 'mainnet'
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;
    const bitcoinWif = getPrivateKeyFromVault('BITCOIN_WIF_PRIVATE_KEY');
    this.bitcoinKeyPair = bitcoin.ECPair.fromWIF(bitcoinWif, this.bitcoinNetwork);
    this.bitcoinAddress = bitcoin.payments.p2pkh({
      pubkey: this.bitcoinKeyPair.publicKey,
      network: this.bitcoinNetwork
    }).address;
    this.bitcoinPrevTxId = process.env.BITCOIN_PREVIOUS_TX_ID;
    this.bitcoinPrevTxVout = parseInt(process.env.BITCOIN_PREVIOUS_TX_VOUT || '0');
    this.bitcoinOutputAmount = parseInt(process.env.BITCOIN_OUTPUT_AMOUNT || '1000');
    this.bitcoinBroadcastUrl = process.env.BITCOIN_BROADCAST_URL || 'https://mempool.space/api/tx';
  }

  async settleOnEthereum(rootHash) {
    try {
      logger.info(`Initiating Ethereum settlement with root hash: ${rootHash}`);
      const encryptedRoot = encrypt(rootHash);
      const hashedRoot = ethers.keccak256(ethers.toUtf8Bytes(encryptedRoot));
      const tx = await this.ethContract.storeMerkleRoot(hashedRoot);
      logger.info(`Ethereum settlement transaction submitted: ${tx.hash}`);
      await tx.wait();
      logger.info("Ethereum settlement confirmed.");
      return { status: 'confirmed', txHash: tx.hash };
    } catch (error) {
      logger.error(`Ethereum settlement failed: ${error.message}`);
      throw error;
    }
  }

  async settleOnBitcoin(rootHash) {
    try {
      logger.info(`Initiating Bitcoin settlement with root hash: ${rootHash}`);
      const encryptedRoot = encrypt(rootHash);
      const txb = new bitcoin.TransactionBuilder(this.bitcoinNetwork);
      txb.addInput(this.bitcoinPrevTxId, this.bitcoinPrevTxVout);
      txb.addOutput(this.bitcoinAddress, this.bitcoinOutputAmount);
      const data = Buffer.from(encryptedRoot, 'hex');
      const embed = bitcoin.payments.embed({ data: [data] });
      txb.addOutput(embed.output, 0);
      txb.sign(0, this.bitcoinKeyPair);
      const tx = txb.build();
      const txHex = tx.toHex();
      logger.info(`Bitcoin transaction built: ${txHex}`);
      const response = await axios.post(this.bitcoinBroadcastUrl, txHex, {
        headers: { 'Content-Type': 'text/plain' }
      });
      logger.info(`Bitcoin transaction broadcasted: ${response.data}`);
      return { status: 'broadcasted', txHex, broadcastResponse: response.data };
    } catch (error) {
      logger.error(`Bitcoin settlement failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = SettlementManager;
