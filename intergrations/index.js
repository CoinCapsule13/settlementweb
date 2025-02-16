'use strict';
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const crypto = require('crypto');
const { ethers } = require('ethers');
const bitcoin = require('bitcoinjs-lib');
const { Server } = require('socket.io');
const path = require('path');

// Create Express app and HTTP server.
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Use middleware.
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from "public" folder

/**
 * SettlementManager handles settlement on Ethereum and Bitcoin.
 */
class SettlementManager {
  constructor() {
    // Ethereum configuration using environment variables.
    this.ethProvider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC);
    this.ethWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.ethProvider);
    this.ethContractAddress = process.env.CONTRACT_ADDRESS;
    // Minimal contract ABI for storing a Merkle root.
    this.ethContractABI = ['function storeMerkleRoot(bytes32 root) public'];
    this.ethContract = new ethers.Contract(this.ethContractAddress, this.ethContractABI, this.ethWallet);

    // Bitcoin configuration using environment variables.
    this.bitcoinNetwork = process.env.BITCOIN_NETWORK === 'mainnet'
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;
    this.bitcoinKeyPair = bitcoin.ECPair.fromWIF(process.env.BITCOIN_WIF_PRIVATE_KEY, this.bitcoinNetwork);
    this.bitcoinAddress = bitcoin.payments.p2pkh({
      pubkey: this.bitcoinKeyPair.publicKey,
      network: this.bitcoinNetwork
    }).address;
    this.bitcoinPrevTxId = process.env.BITCOIN_PREVIOUS_TX_ID;
    this.bitcoinPrevTxVout = parseInt(process.env.BITCOIN_PREVIOUS_TX_VOUT || '0');
    this.bitcoinOutputAmount = parseInt(process.env.BITCOIN_OUTPUT_AMOUNT || '1000');
  }

  async settleOnEthereum(rootHash) {
    try {
      console.log(`Settling on Ethereum with root: ${rootHash}`);
      const tx = await this.ethContract.storeMerkleRoot(
        ethers.keccak256(ethers.toUtf8Bytes(rootHash))
      );
      console.log('Ethereum Settlement TX:', tx.hash);
      await tx.wait();
      console.log('Ethereum Settlement Confirmed');
      io.emit('settlementUpdate', { chain: 'ethereum', status: 'confirmed', txHash: tx.hash });
    } catch (error) {
      console.error('Error settling on Ethereum:', error);
      io.emit('settlementUpdate', { chain: 'ethereum', status: 'error', error: error.message });
    }
  }

  async settleOnBitcoin(rootHash) {
    try {
      console.log(`Settling on Bitcoin with root: ${rootHash}`);
      const txb = new bitcoin.TransactionBuilder(this.bitcoinNetwork);
      txb.addInput(this.bitcoinPrevTxId, this.bitcoinPrevTxVout);
      // First output: minimal amount sent back to our own address.
      txb.addOutput(this.bitcoinAddress, this.bitcoinOutputAmount);
      // Second output: embed the Merkle root via OP_RETURN.
      const data = Buffer.from(rootHash, 'hex');
      const embed = bitcoin.payments.embed({ data: [data] });
      txb.addOutput(embed.output, 0);
      txb.sign(0, this.bitcoinKeyPair);
      const tx = txb.build();
      console.log('Bitcoin Settlement TX (hex):', tx.toHex());
      io.emit('settlementUpdate', { chain: 'bitcoin', status: 'built', txHex: tx.toHex() });
      // In production, broadcast the transaction via a Bitcoin node/API.
    } catch (error) {
      console.error('Error settling on Bitcoin:', error);
      io.emit('settlementUpdate', { chain: 'bitcoin', status: 'error', error: error.message });
    }
  }
}

/**
 * MerkleTree constructs a Merkle tree from transaction data,
 * and provides proof generation and verification methods.
 */
class MerkleTree {
  constructor(transactions) {
    this.transactions = transactions;
    this.leaves = transactions.map(tx => this.hash(JSON.stringify(tx)));
    this.root = this.buildTree(this.leaves);
  }

  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  buildTree(leaves) {
    if (leaves.length === 0) return null;
    let layer = leaves;
    while (layer.length > 1) {
      let nextLayer = [];
      for (let i = 0; i < layer.length; i += 2) {
        const left = layer[i];
        const right = i + 1 < layer.length ? layer[i + 1] : left;
        nextLayer.push(this.hash(left + right));
      }
      layer = nextLayer;
    }
    return layer[0];
  }

  getRoot() {
    return this.root;
  }

  getProof(leaf) {
    let index = this.leaves.indexOf(leaf);
    if (index === -1) return null;
    let proof = [];
    let layer = this.leaves.slice();
    while (layer.length > 1) {
      let nextLayer = [];
      for (let i = 0; i < layer.length; i += 2) {
        const left = layer[i];
        const right = i + 1 < layer.length ? layer[i + 1] : left;
        if (i === index || i + 1 === index) {
          proof.push(i === index ? right : left);
        }
        nextLayer.push(this.hash(left + right));
      }
      index = Math.floor(index / 2);
      layer = nextLayer;
    }
    return proof;
  }

  verifyProof(leaf, proof, root) {
    let computedHash = leaf;
    for (let sibling of proof) {
      computedHash = this.hash(computedHash + sibling);
    }
    return computedHash === root;
  }
}

/**
 * ExecutionLayer simulates off-chain transaction execution,
 * supports batching, fraud prevention, and optional code transparency.
 */
class ExecutionLayer {
  constructor(batchSize = 10) {
    this.transactions = [];
    this.batchSize = batchSize;
    this.settlementManager = new SettlementManager();
    this.settlementMode = process.env.SETTLEMENT_MODE || 'both';
  }

  async executeTransaction(tx, overrideSettlementMode) {
    if (!this.fraudCheck(tx)) {
      console.error('Transaction failed fraud check:', tx);
      io.emit('transactionError', { tx, error: 'Fraud check failed' });
      throw new Error('Fraud check failed');
    }
    this.transactions.push(tx);
    console.log(`Executed: ${JSON.stringify(tx)}`);
    io.emit('transactionExecuted', tx);
    if (overrideSettlementMode) {
      this.settlementMode = overrideSettlementMode;
    }
    if (this.transactions.length >= this.batchSize) {
      await this.settleBatch();
    }
  }

  fraudCheck(tx) {
    if (!tx.from || !tx.to || typeof tx.amount !== 'number') return false;
    if (tx.code && (typeof tx.code !== 'string' || tx.code.trim() === '')) return false;
    return true;
  }

  async settleBatch() {
    if (this.transactions.length === 0) return;
    const merkleTree = new MerkleTree(this.transactions);
    const root = merkleTree.getRoot();
    console.log('Batch Merkle Root:', root);
    io.emit('batchCreated', { merkleRoot: root, transactions: this.transactions, settlementMode: this.settlementMode });

    // Verify each transaction's inclusion via its Merkle proof.
    for (const tx of this.transactions) {
      const leaf = merkleTree.hash(JSON.stringify(tx));
      const proof = merkleTree.getProof(leaf);
      const isValid = merkleTree.verifyProof(leaf, proof, root);
      if (!isValid) {
        console.error('Fraudulent transaction detected:', tx);
        io.emit('fraudAlert', tx);
        throw new Error('Fraudulent transaction detected');
      }
    }

    // Settle based on the configured settlement mode.
    switch (this.settlementMode.toLowerCase()) {
      case 'ethereum':
        await this.settlementManager.settleOnEthereum(root);
        break;
      case 'bitcoin':
        await this.settlementManager.settleOnBitcoin(root);
        break;
      case 'both':
      default:
        await Promise.all([
          this.settlementManager.settleOnEthereum(root),
          this.settlementManager.settleOnBitcoin(root)
        ]);
        break;
    }
    io.emit('batchSettled', { merkleRoot: root, settlementMode: this.settlementMode });
    this.transactions = [];
  }
}

// Global ExecutionLayer instance.
const executionLayer = new ExecutionLayer(parseInt(process.env.BATCH_SIZE) || 10);

/**
 * Express API Endpoints
 */
app.post('/api/transactions', async (req, res) => {
  try {
    const tx = req.body;
    const settlementMode = req.body.settlementMode; // Optional override.
    await executionLayer.executeTransaction(tx, settlementMode);
    res.status(200).json({ status: 'Transaction accepted', tx });
  } catch (error) {
    console.error('Error processing transaction:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/settle', async (req, res) => {
  try {
    await executionLayer.settleBatch();
    res.status(200).json({ status: 'Batch settlement triggered' });
  } catch (error) {
    console.error('Error during settlement:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/merkle-proof', (req, res) => {
  try {
    const { txData } = req.query;
    if (!txData) {
      res.status(400).json({ error: 'txData query parameter is required' });
      return;
    }
    const tx = JSON.parse(txData);
    const merkleTree = new MerkleTree(executionLayer.transactions);
    const leaf = merkleTree.hash(JSON.stringify(tx));
    const proof = merkleTree.getProof(leaf);
    res.status(200).json({ tx, proof, merkleRoot: merkleTree.getRoot() });
  } catch (error) {
    console.error('Error generating Merkle proof:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve the dashboard page.
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`API server and Dashboard listening on port ${PORT}`);
});

// Socket.io connection handling.
io.on('connection', (socket) => {
  console.log('Dashboard client connected:', socket.id);
  socket.emit('dashboardInit', {
    settlementMode: executionLayer.settlementMode,
    batchSize: executionLayer.batchSize,
    currentTransactions: executionLayer.transactions,
  });

  socket.on('disconnect', () => {
    console.log('Dashboard client disconnected:', socket.id);
  });
});
