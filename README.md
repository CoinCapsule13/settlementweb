# FHE-Based Settlement Protocol

## Overview
This project enables **Fully Homomorphic Encryption (FHE)-based settlements** for **Ethereum and Bitcoin**, ensuring **confidential transactions** and **trustless verification**.

## Features
- **FHE Encryption**: Transactions remain encrypted throughout processing.
- **Merkle Tree-Based Validation**: Settlement proofs are constructed from encrypted transactions.
- **Ethereum & Bitcoin Settlement**: On-chain storage of encrypted Merkle roots.
- **WebSocket-Based Dashboard**: Real-time transaction monitoring.

## Installation

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Ethereum & Bitcoin wallets with test funds

### Setup
```bash
git clone https://github.com/YOUR_REPO/FHE-Settlement.git
cd FHE-Settlement
cp .env.example .env
npm install
```

### Running the Server
```bash
npm start
```

### API Endpoints
- **POST /api/transactions** – Submit encrypted transactions
- **GET /api/merkle-proof** – Retrieve Merkle proofs for verification
- **POST /api/settle** – Trigger settlement batch processing

## Web Dashboard
Visit `http://localhost:3000/dashboard` to monitor encrypted transactions in real-time.