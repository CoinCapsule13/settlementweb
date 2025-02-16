// FHE-Integrated Merkle Tree (merkleTree.js)
'use strict';
const crypto = require('crypto');
const { encrypt, decrypt } = require('tfhe');

class MerkleTree {
  constructor(transactions) {
    this.transactions = transactions;
    this.leaves = transactions.map(tx => this.hash(fhe.encrypt(JSON.stringify(tx))));
    this.root = this.buildTree(this.leaves);
  }

  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  buildTree(leaves) {
    if (leaves.length === 0) return null;
    let layer = leaves;
    while (layer.length > 1) {
      const nextLayer = [];
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
}

module.exports = MerkleTree;

