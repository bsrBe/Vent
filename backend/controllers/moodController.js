const Mood = require('../models/Mood');
const MoodType = require('../models/MoodType');
const JournalEntry = require('../models/Entry'); // Needed for validation when linking mood
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { subDays, subMonths, startOfDay, endOfDay, format, parseISO } = require('date-fns'); // For date manipulation

// Get all available mood types
exports.getMoodTypes = catchAsync(async (req, res, next) => {
  const moodTypes = await MoodType.find();

  res.status(200).json({
    status: 'success',
    results: moodTypes.length,
    data: {
      moodTypes,
    },
  });
});

// Get moods recorded by the logged-in user, with filtering and pagination
exports.getMoods = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  // --- Filtering ---
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(el => delete queryObj[el]);

  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

  let filter = JSON.parse(queryStr);
  filter.user = userId; // Ensure user only gets their moods

  // Date range filtering
  if (req.query.fromDate || req.query.toDate) {
    filter.date = {};
    if (req.query.fromDate) filter.date.$gte = startOfDay(parseISO(req.query.fromDate));
    if (req.query.toDate) filter.date.$lte = endOfDay(parseISO(req.query.toDate));
  }

  let query = Mood.find(filter); // Pre-find hook in Mood model handles population

  // --- Sorting ---
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-date -createdAt'); // Default sort by date descending, then creation time
  }

  // --- Field Limiting ---
  if (req.query.fields) {
    const fields = req.query.fields.split(',').join(' ');
    query = query.select(fields);
  } else {
    query = query.select('-__v');
  }

  // --- Pagination ---
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit);

  // Execute query
  const moods = await query;
  const total = await Mood.countDocuments({ ...filter, user: userId });

  res.status(200).json({
    status: 'success',
    results: moods.length,
    data: {
      moods,
    },
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Removed standalone createMood function as moods are now created/managed via entryController

// Get mood statistics for the user
exports.getMoodStats = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const period = req.query.period || 'month'; // Default to last month

  let fromDate;
  const toDate = endOfDay(new Date()); // End of today

  switch (period) {
    case 'week':
      fromDate = startOfDay(subDays(toDate, 7));
      break;
    case '3months':
      fromDate = startOfDay(subMonths(toDate, 3));
      break;
    case 'custom':
      fromDate = req.query.fromDate ? startOfDay(parseISO(req.query.fromDate)) : startOfDay(subMonths(toDate, 1));
      // Use provided toDate or default to today's end
      const customToDate = req.query.toDate ? endOfDay(parseISO(req.query.toDate)) : toDate;
      // Ensure fromDate is not after toDate
      if (fromDate > customToDate) {
          return next(new AppError('Start date cannot be after end date', 400));
      }
      // Reassign toDate only if custom toDate was provided
      if (req.query.toDate) toDate = customToDate;
      break;
    case 'month':
    default:
      fromDate = startOfDay(subMonths(toDate, 1));
      break;
  }

  // --- New Aggregation Pipeline starting from Entries ---
  const stats = await JournalEntry.aggregate([
    // 1. Match entries by user and date range
    {
      $match: {
        user: req.user.id, // Match entries for the logged-in user
        createdAt: { $gte: fromDate, $lte: toDate }, // Match entries within the date range
        mood: { $exists: true, $ne: null } // Only include entries that have a mood linked
      }
    },
    // 2. Lookup the associated Mood document
    {
      $lookup: {
        from: 'moods', // Collection name for Moods
        localField: 'mood',
        foreignField: '_id',
        as: 'moodDetails'
      }
    },
    // 3. Unwind the moodDetails array (should only be one mood per entry)
    {
      $unwind: '$moodDetails'
    },
    // 4. Lookup the associated MoodType document
    {
      $lookup: {
        from: 'moodtypes', // Collection name for MoodTypes
        localField: 'moodDetails.moodType',
        foreignField: '_id',
        as: 'moodTypeDetails'
      }
    },
    // 5. Unwind the moodTypeDetails array
    {
      $unwind: '$moodTypeDetails'
    },
    // 6. Group by MoodType to count occurrences
    {
      $group: {
        _id: '$moodTypeDetails._id', // Group by MoodType ID
        moodTypeName: { $first: '$moodTypeDetails.name' },
        moodTypeEmoji: { $first: '$moodTypeDetails.emoji' },
        moodTypeColor: { $first: '$moodTypeDetails.colorCode' },
        count: { $sum: 1 }, // Count entries for each mood type
        // Note: avgIntensity might be less relevant now or need recalculation based on entry context if needed
        // avgIntensity: { $avg: '$moodDetails.intensity' } // Example if intensity is stored on Mood
      }
    },
    {
      $sort: { count: -1 }, // Sort by count descending (most frequent first)
    },
    {
       $project: { // Reshape the output
           _id: 0, // Exclude the default _id
           moodType: { // Create a nested moodType object
               id: '$_id',
               name: '$moodTypeName',
               emoji: '$moodTypeEmoji',
               colorCode: '$moodTypeColor'
           },
           count: 1,
           // averageIntensity: '$avgIntensity' // Include if needed
       }
    }
  ]);

  // Find the most frequent mood from the aggregated results
  const mostFrequentMood = stats.length > 0 ? stats[0].moodType : null;

  res.status(200).json({
    status: 'success',
    data: {
      mostFrequentMood,
      moodCounts: stats, // The aggregated results are the counts
      dateRange: {
        from: format(fromDate, 'yyyy-MM-dd'),
        to: format(toDate, 'yyyy-MM-dd'),
      },
    },
  });
});

// Get mood data formatted for a calendar view (e.g., moods per day)
exports.getMoodCalendar = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1; // Month is 1-based

  if (month < 1 || month > 12) {
    return next(new AppError('Invalid month specified. Must be between 1 and 12.', 400));
  }

  // Calculate start and end dates for the requested month
  const startDate = startOfDay(new Date(year, month - 1, 1)); // First day of the month
  const endDate = endOfDay(new Date(year, month, 0)); // Last day of the month

  // --- Find Entries with Moods within the month ---
  const entries = await JournalEntry.find({
    user: userId,
    createdAt: { $gte: startDate, $lte: endDate }, // Filter by entry creation date
    mood: { $exists: true, $ne: null } // Ensure mood is linked
  })
  .populate({ // Populate the linked mood
      path: 'mood',
      populate: { // Then populate the moodType within the mood
          path: 'moodType',
          select: 'name emoji colorCode' // Select desired fields from MoodType
      }
  })
  .sort('createdAt'); // Sort by entry creation date

  // Format data for calendar: group entry moods by date
  const calendarData = entries.reduce((acc, entry) => {
    // Ensure mood and moodType are populated before proceeding
    if (!entry.mood || !entry.mood.moodType) {
        console.warn(`Entry ${entry._id} is missing populated mood or moodType.`);
        return acc; // Skip this entry if data is incomplete
    }

    const dateKey = format(entry.createdAt, 'yyyy-MM-dd'); // Use entry's creation date
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    // Push data based on the linked mood
    acc[dateKey].push({
      id: entry.mood._id, // Use the mood's ID
      intensity: entry.mood.intensity, // Get intensity from mood
      notes: entry.mood.notes, // Get notes from mood
      moodType: entry.mood.moodType, // Use the populated moodType object
    });
    return acc;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      calendarData, // Object with date strings as keys and arrays of moods as values
      month,
      year,
    },
  });
});

// Placeholder for Mood Insights - requires more complex analysis
exports.getMoodInsights = catchAsync(async (req, res, next) => {
  // This endpoint requires significant analysis (trends, correlations, patterns)
  // based on the user's mood history. Implementing this fully might involve
  // complex aggregation pipelines or dedicated analysis logic.
  // For now, return a placeholder or basic info.

  // Example: Return simple count of moods in the last 3 months
  const userId = req.user.id;
  const fromDate = startOfDay(subMonths(new Date(), 3));
  const toDate = endOfDay(new Date());

  const moodCount = await Mood.countDocuments({
      user: userId,
      date: { $gte: fromDate, $lte: toDate }
  });

  res.status(200).json({
      status: 'success',
      message: 'Mood insights feature under development. Basic data provided.',
      data: {
          period: 'last 3 months',
          totalMoodsRecorded: moodCount,
          // Add more basic insights here if feasible
      }
  });
});
