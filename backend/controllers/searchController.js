const JournalEntry = require('../models/Entry');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const mongoose = require('mongoose'); // Needed for ObjectId validation if filtering by mood ID

exports.searchEntries = catchAsync(async (req, res, next) => {
  const userId = req.user.id; // User ID from protect middleware
  const { query: searchQuery, categories, moods: moodTypeIds, fromDate, toDate } = req.query;

  // --- Build Search Conditions ---
  const filter = {
    user: userId,
    // deletedAt: null, // Handled by pre-find hook in model
  };

  // Text search (across title and content)
  if (searchQuery) {
    filter.$text = { $search: searchQuery };
    // Note: Requires a text index on title and content fields in the Entry model.
    // Let's add that index to the model.
  }

  // Category filter (expecting comma-separated string or array)
  if (categories) {
    const categoryList = Array.isArray(categories) ? categories : categories.split(',');
    // Validate categories against the enum if necessary, though schema validation handles it on creation/update
    filter.category = { $in: categoryList.map(cat => cat.trim().toUpperCase()) };
  }

  // Mood filter (expecting comma-separated string or array of MoodType IDs)
  if (moodTypeIds) {
    const moodIdList = Array.isArray(moodTypeIds) ? moodTypeIds : moodTypeIds.split(',');
    // Validate IDs are valid ObjectIds
    const validMoodIds = moodIdList.filter(id => mongoose.Types.ObjectId.isValid(id.trim()));

    if (validMoodIds.length > 0) {
      // This requires finding entries whose linked mood has a moodType in the list.
      // This is complex with a direct find(). An aggregation pipeline is better.
      // Alternative: Find moods first, then find entries linked to those moods.

      // Simpler (less direct) approach: Find entries that HAVE a mood linked.
      // filter.mood = { $ne: null };
      // To filter by specific mood types, we need aggregation or a multi-step query.

      // Let's use a multi-step query for now:
      // 1. Find Mood documents matching the user and moodTypeIds
      const relevantMoods = await mongoose.model('Mood').find({
          user: userId,
          moodType: { $in: validMoodIds }
      }).select('_id'); // Select only the IDs

      const relevantMoodObjectIds = relevantMoods.map(mood => mood._id);

      // 2. Filter Journal Entries where the 'mood' field is in the list of relevant mood IDs
      if (relevantMoodObjectIds.length > 0) {
          filter.mood = { $in: relevantMoodObjectIds };
      } else {
          // If no moods match the criteria, no entries will match either.
          // Set a condition that cannot be met.
          filter.mood = { $in: [] };
      }
    }
  }

  // Date range filter
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);
  }

  // --- Pagination ---
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  // --- Sorting ---
  // Default sort by relevance if text search is used, otherwise by date
  const sortOptions = searchQuery ? { score: { $meta: 'textScore' } } : { createdAt: -1 };

  // --- Projection ---
  // Include relevance score if text search is used
  const projection = searchQuery ? { score: { $meta: 'textScore' } } : {};


  // Execute Search Query
  const query = JournalEntry.find(filter, projection)
                            .sort(sortOptions)
                            .skip(skip)
                            .limit(limit);

  const entries = await query;
  const total = await JournalEntry.countDocuments(filter); // Count matching documents

  res.status(200).json({
    status: 'success',
    results: entries.length,
    data: {
      entries,
    },
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Need to add text index to JournalEntry model for $text search
// Let's modify the Entry.js model file.
