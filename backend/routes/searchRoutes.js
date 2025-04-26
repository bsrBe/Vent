const express = require('express');
const searchController = require('../controllers/searchController');
const { protect } = require('../middleware/auth'); // Import protect middleware

const router = express.Router();

// All search routes require authentication
router.use(protect);

// Route for searching journal entries
// GET /api/v1/search?query=...&categories=...&moods=...&fromDate=...&toDate=...&page=...&limit=...
router.get('/', searchController.searchEntries);

module.exports = router;
