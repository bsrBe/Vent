const express = require('express');
const exportController = require('../controllers/exportController');
const { protect } = require('../middleware/auth'); // Import protect middleware

const router = express.Router();

// All export routes require authentication
router.use(protect);

// Route for exporting journal entries
// GET /api/v1/export/entries?format=json|csv|pdf&fromDate=...&toDate=...
router.get('/entries', exportController.exportEntries);

// Route for exporting mood data
// GET /api/v1/export/moods?format=json|csv|pdf&fromDate=...&toDate=...
router.get('/moods', exportController.exportMoods);

module.exports = router;
