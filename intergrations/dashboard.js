const socket = io();

// Initialize dashboard with system info.
socket.on('dashboardInit', (data) => {
  document.getElementById('settlementMode').innerText = `Settlement Mode: ${data.settlementMode}`;
  document.getElementById('batchSize').innerText = `Batch Size: ${data.batchSize}`;
  updateTransactionList(data.currentTransactions);
});

// Update dashboard events.
socket.on('transactionExecuted', (tx) => {
  addEvent(`Transaction executed: ${JSON.stringify(tx)}`);
  updateTransactionList();
});

socket.on('batchCreated', (data) => {
  addEvent(`Batch created with Merkle Root: ${data.merkleRoot}`);
  updateTransactionList(data.transactions);
});

socket.on('batchSettled', (data) => {
  addEvent(`Batch settled on ${data.settlementMode} with Merkle Root: ${data.merkleRoot}`);
  updateTransactionList([]);
});

socket.on('settlementUpdate', (data) => {
  addEvent(`Settlement update on ${data.chain}: ${data.status}${data.txHash ? ' - TX: ' + data.txHash : ''}`);
});

socket.on('transactionError', (data) => {
  addEvent(`Transaction error: ${data.error}`);
});

socket.on('fraudAlert', (tx) => {
  addEvent(`Fraud alert for transaction: ${JSON.stringify(tx)}`);
});

function updateTransactionList(transactions) {
  const listEl = document.getElementById('transactionList');
  if (transactions) {
    listEl.innerHTML = '';
    transactions.forEach(tx => {
      const li = document.createElement('li');
      li.innerText = JSON.stringify(tx);
      listEl.appendChild(li);
    });
  } else {
    // Optionally, you could implement a refresh mechanism via an API call.
  }
}

function addEvent(message) {
  const eventsEl = document.getElementById('events');
  const li = document.createElement('li');
  li.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
  eventsEl.prepend(li);
}
