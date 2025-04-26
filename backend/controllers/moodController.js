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

// Create a new mood entry
exports.createMood = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { moodTypeId, intensity, date, timeOfDay, notes, journalEntryId } = req.body;

  if (!moodTypeId) {
    return next(new AppError('Please provide a mood type ID', 400));
  }

  // Validate mood type exists
  const moodTypeExists = await MoodType.findById(moodTypeId);
  if (!moodTypeExists) {
    return next(new AppError('Invalid mood type ID', 400));
  }

  // Validate journal entry if provided
  if (journalEntryId) {
    const entryExists = await JournalEntry.findOne({ _id: journalEntryId, user: userId });
    if (!entryExists) {
      return next(new AppError('Invalid journal entry ID or entry does not belong to user', 400));
    }
    // Check if this journal entry already has a mood linked? Depends on desired logic.
    // const existingMoodLink = await Mood.findOne({ journalEntry: journalEntryId });
    // if (existingMoodLink) {
    //   return next(new AppError('This journal entry is already linked to a mood', 400));
    // }
  }

  const moodData = {
    moodType: moodTypeId,
    user: userId,
    intensity: intensity, // Uses default from schema if undefined
    date: date ? parseISO(date) : new Date(),
    // Combine date and time if timeOfDay is provided
    timeOfDay: timeOfDay ? parseISO(`${format(date ? parseISO(date) : new Date(), 'yyyy-MM-dd')}T${timeOfDay}`) : null,
    notes,
    journalEntry: journalEntryId || null,
  };

  const newMood = await Mood.create(moodData);

  // If linked to a journal entry, update the entry's mood field
  if (journalEntryId) {
      await JournalEntry.findByIdAndUpdate(journalEntryId, { mood: newMood._id });
  }

  // Re-fetch to populate associated data
  const populatedMood = await Mood.findById(newMood._id);


  res.status(201).json({
    status: 'success',
    data: {
      mood: populatedMood,
    },
  });
});

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

  // Use Aggregation Pipeline for stats
  const stats = await Mood.aggregate([
    {
      $match: {
        user: req.user._id, // Match moods for the logged-in user
        date: { $gte: fromDate, $lte: toDate }, // Match within the date range
      },
    },
    {
      $lookup: { // Join with MoodTypes collection
        from: 'moodtypes', // The actual name of the MoodTypes collection in MongoDB
        localField: 'moodType',
        foreignField: '_id',
        as: 'moodTypeDetails',
      },
    },
    {
      $unwind: '$moodTypeDetails', // Deconstruct the moodTypeDetails array
    },
    {
      $group: {
        _id: '$moodType', // Group by moodType ID
        moodTypeName: { $first: '$moodTypeDetails.name' }, // Get the name
        moodTypeEmoji: { $first: '$moodTypeDetails.emoji' }, // Get the emoji
        moodTypeColor: { $first: '$moodTypeDetails.colorCode' }, // Get the color
        count: { $sum: 1 }, // Count occurrences of each mood type
        avgIntensity: { $avg: '$intensity' }, // Calculate average intensity
      },
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
           averageIntensity: '$avgIntensity'
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

  // Find moods within the month
  const moods = await Mood.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate },
  })
  .populate('moodType', 'name emoji colorCode') // Populate mood type details
  .sort('date'); // Sort by date

  // Format data for calendar: group moods by date
  const calendarData = moods.reduce((acc, mood) => {
    const dateKey = format(mood.date, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push({
      id: mood._id,
      intensity: mood.intensity,
      notes: mood.notes,
      moodType: mood.moodType, // Already populated
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
