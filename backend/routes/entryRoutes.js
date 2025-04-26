const express = require('express');
const entryController = require('../controllers/entryController');
const { protect } = require('../middleware/auth'); // Import protect middleware

const router = express.Router();

// All routes below this middleware require authentication
router.use(protect);

// Route to get available categories (conditionally includes 'BISRAT')
router.get('/categories', entryController.getEntryCategories); // GET /api/v1/entries/categories

router
  .route('/')
  .get(entryController.getEntries) // GET /api/v1/entries (with filtering/pagination query params)
  .post(entryController.createEntry); // POST /api/v1/entries

router
  .route('/:id')
  .get(entryController.getEntry) // GET /api/v1/entries/:id
  .patch(entryController.updateEntry) // PATCH /api/v1/entries/:id (Using PATCH for partial updates)
  .delete(entryController.deleteEntry); // DELETE /api/v1/entries/:id (Soft delete)

module.exports = router;
