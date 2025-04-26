const express = require('express');
const moodController = require('../controllers/moodController');
const { protect } = require('../middleware/auth'); // Import protect middleware

const router = express.Router();

// All routes below this middleware require authentication
router.use(protect);

// Route for getting available mood types
router.get('/types', moodController.getMoodTypes); // GET /api/v1/moods/types

// Routes for managing user's mood entries
router
  .route('/')
  .get(moodController.getMoods) // GET /api/v1/moods (with filtering/pagination query params)
  .post(moodController.createMood); // POST /api/v1/moods

// Routes for mood statistics, calendar, and insights
router.get('/stats', moodController.getMoodStats); // GET /api/v1/moods/stats
router.get('/calendar', moodController.getMoodCalendar); // GET /api/v1/moods/calendar
router.get('/insights', moodController.getMoodInsights); // GET /api/v1/moods/insights

// Note: Routes for updating or deleting specific mood entries might be needed,
// depending on application requirements. They are not explicitly defined in the
// backend.txt example routes, but could be added here if necessary.
// Example:
// router.route('/:id')
//   .get(moodController.getMood) // Need to implement getMood in controller
//   .patch(moodController.updateMood) // Need to implement updateMood in controller
//   .delete(moodController.deleteMood); // Need to implement deleteMood in controller

module.exports = router;
