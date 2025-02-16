'use strict';
const express = require('express');
const router = express.Router();

module.exports = (executionLayer) => {
  // POST /api/settle: manually trigger settlement for the current batch.
  router.post('/settle', async (req, res) => {
    try {
      await executionLayer.settleBatch();
      res.status(200).json({ status: 'Batch settlement triggered' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
