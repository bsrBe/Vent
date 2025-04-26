const mongoose = require('mongoose');
const Mood = require('../models/Mood');
const MoodType = require('../models/MoodType');
const JournalEntry = require('../models/Entry');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { subMonths, startOfDay, endOfDay, format } = require('date-fns'); // Removed parseISO, subDays

// Get all available mood types
exports.getMoodTypes = catchAsync(async (req, res, next) => {
  let moodTypes = await MoodType.find().lean(); // Use .lean() for plain JS objects

  // Check if the logged-in user is betsi2426@gmail.com
  if (req.user && req.user.email === 'betsi2426@gmail.com') {
    // Define the special "Bisrat" mood type
    const bisratMoodType = {
      _id: new mongoose.Types.ObjectId().toString(), // Generate a temporary unique ID as string
      name: 'Bisrat',
      emoji: '🌟', // Placeholder emoji
      colorCode: '#FFD700', // Placeholder color (Gold)
      description: 'Special category for Bisrat',
      // Timestamps aren't typically needed for virtual types unless frontend expects them
    };
    // Add the special mood type to the list
    moodTypes.push(bisratMoodType);
  }

  res.status(200).json({
    status: 'success',
    results: moodTypes.length,
    data: { moodTypes },
  });
});

// Get moods recorded by the logged-in user (potentially redundant)
exports.getMoods = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(el => delete queryObj[el]);
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
  let filter = JSON.parse(queryStr);
  filter.user = userId;
  // Removed date range filtering based on query params as it's simplified now
  let query = Mood.find(filter);
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-date -createdAt');
  }
  if (req.query.fields) {
    const fields = req.query.fields.split(',').join(' ');
    query = query.select(fields);
  } else {
    query = query.select('-__v');
  }
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;
  query = query.skip(skip).limit(limit);
  const moods = await query;
  const total = await Mood.countDocuments({ ...filter, user: userId });
  res.status(200).json({
    status: 'success',
    results: moods.length,
    data: { moods },
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// Removed standalone createMood function

// Get mood statistics for the user (Default: Last Month)
exports.getMoodStats = catchAsync(async (req, res, next) => { // Re-added catchAsync
  const userId = req.user.id;

  // Default to last month
  const toDate = endOfDay(new Date());
  const fromDate = startOfDay(subMonths(toDate, 1));

  console.log(`getMoodStats - User: ${userId}, Range: ${fromDate.toISOString()} to ${toDate.toISOString()}`); // Log final range

  const userIdStr = req.user.id;
  if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
    console.error(`Invalid user ID format: ${userIdStr}`);
    return next(new AppError('Invalid user ID format', 400));
  }
  const userObjectId = new mongoose.Types.ObjectId(userIdStr);

  const pipeline = [
    // 1. Match entries by user and date range (last month)
    {
      $match: {
        user: userObjectId,
        createdAt: { $gte: fromDate, $lte: toDate },
        mood: { $exists: true, $ne: null }
      }
    },
    // 2. Lookup Mood
    {
      $lookup: {
        from: 'moods',
        localField: 'mood',
        foreignField: '_id',
        as: 'moodDetails'
      }
    },
    { $unwind: { path: '$moodDetails', preserveNullAndEmptyArrays: true } },
    // 3. Lookup MoodType
    {
      $lookup: {
        from: 'moodtypes',
        localField: 'moodDetails.moodType',
        foreignField: '_id',
        as: 'moodTypeDetails'
      }
    },
    { $unwind: { path: '$moodTypeDetails', preserveNullAndEmptyArrays: true } },
    // 4. Filter out docs where lookups failed
    {
        $match: {
            'moodDetails': { $exists: true, $ne: null, $ne: [] },
            'moodTypeDetails': { $exists: true, $ne: null, $ne: [] }
        }
    },
    // 5. Group by MoodType to count
    {
      $group: {
        _id: '$moodTypeDetails._id',
        moodTypeName: { $first: '$moodTypeDetails.name' },
        moodTypeEmoji: { $first: '$moodTypeDetails.emoji' },
        moodTypeColor: { $first: '$moodTypeDetails.colorCode' },
        count: { $sum: 1 },
      }
    },
    // 6. Sort by count descending to easily find max count later
    { $sort: { count: -1 } },
    // 7. Project into desired shape (intermediate step)
    {
       $project: {
           _id: 0,
           moodType: {
               id: '$_id',
               name: '$moodTypeName',
               emoji: '$moodTypeEmoji',
               colorCode: '$moodTypeColor'
           },
           count: 1,
       }
    }
  ];

  console.log("Executing pipeline:", JSON.stringify(pipeline, null, 2));
  const stats = await JournalEntry.aggregate(pipeline);
  console.log("Aggregation Result:", JSON.stringify(stats, null, 2));

  // Determine the maximum count
  const maxCount = stats.length > 0 ? stats[0].count : 0;

  // Filter to get all moods with the maximum count (handles ties)
  const mostFrequentMoods = maxCount > 0 ? stats.filter(stat => stat.count === maxCount).map(stat => stat.moodType) : [];

  console.log("Most Frequent Moods:", mostFrequentMoods);

  res.status(200).json({
    status: 'success',
    data: {
      mostFrequentMoods, // Return array of moods
      moodCounts: stats, // Return all counts for the chart
      dateRange: { // Still useful to return the range used
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
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;

  if (month < 1 || month > 12) {
    return next(new AppError('Invalid month specified.', 400));
  }

  const startDate = startOfDay(new Date(year, month - 1, 1));
  const endDate = endOfDay(new Date(year, month, 0));

  const userIdStr = req.user.id;
  if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
    console.error(`Invalid user ID format in getMoodCalendar: ${userIdStr}`);
    return next(new AppError('Invalid user ID format', 400));
  }
  const userObjectId = new mongoose.Types.ObjectId(userIdStr);

  const entries = await JournalEntry.find({
    user: userObjectId,
    createdAt: { $gte: startDate, $lte: endDate },
    mood: { $exists: true, $ne: null }
  })
  .populate({
      path: 'mood',
      populate: {
          path: 'moodType',
          select: 'name emoji colorCode'
      }
  })
  .sort('createdAt');

  const calendarData = entries.reduce((acc, entry) => {
    if (!entry.mood || !entry.mood.moodType) {
        console.warn(`Entry ${entry._id} missing populated mood/moodType.`);
        return acc;
    }
    const dateKey = format(entry.createdAt, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push({
      id: entry.mood._id,
      intensity: entry.mood.intensity,
      notes: entry.mood.notes,
      moodType: entry.mood.moodType,
    });
    return acc;
  }, {});

  res.status(200).json({
    status: 'success',
    data: { calendarData, month, year },
  });
});

// Placeholder for Mood Insights
exports.getMoodInsights = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const fromDate = startOfDay(subMonths(new Date(), 3));
  const toDate = endOfDay(new Date());

   const userIdStr = req.user.id;
   if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
     console.error(`Invalid user ID format in getMoodInsights: ${userIdStr}`);
     return res.status(200).json({
         status: 'success',
         message: 'Mood insights feature under development.',
         data: { period: 'last 3 months', totalMoodsRecorded: 0 }
     });
   }
   const userObjectId = new mongoose.Types.ObjectId(userIdStr);

  const moodCount = await JournalEntry.countDocuments({
      user: userObjectId,
      createdAt: { $gte: fromDate, $lte: toDate },
      mood: { $exists: true, $ne: null }
  });

  // Fetch most frequent mood data again for the insight text (using default last month)
  const statsData = await exports.getMoodStatsData(userId); // Call helper

  res.status(200).json({
      status: 'success',
      message: 'Mood insights feature under development. Basic data provided.',
      data: {
          period: 'last 3 months', // Insight period might differ from stats period
          totalMoodsRecorded: moodCount,
          // Use statsData for most frequent mood text
          mostFrequentMoods: statsData.mostFrequentMoods,
      }
  });
});

// Helper function to get stats data (used by getMoodStats and getMoodInsights)
// This avoids duplicating the aggregation logic.
exports.getMoodStatsData = async (userId) => {
  const toDate = endOfDay(new Date());
  const fromDate = startOfDay(subMonths(toDate, 1)); // Default last month

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID format provided to getMoodStatsData');
  }
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const pipeline = [
    { $match: { user: userObjectId, createdAt: { $gte: fromDate, $lte: toDate }, mood: { $exists: true, $ne: null } } },
    { $lookup: { from: 'moods', localField: 'mood', foreignField: '_id', as: 'moodDetails' } },
    { $unwind: { path: '$moodDetails', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'moodtypes', localField: 'moodDetails.moodType', foreignField: '_id', as: 'moodTypeDetails' } },
    { $unwind: { path: '$moodTypeDetails', preserveNullAndEmptyArrays: true } },
    { $match: { 'moodDetails': { $exists: true, $ne: null, $ne: [] }, 'moodTypeDetails': { $exists: true, $ne: null, $ne: [] } } },
    { $group: { _id: '$moodTypeDetails._id', moodTypeName: { $first: '$moodTypeDetails.name' }, moodTypeEmoji: { $first: '$moodTypeDetails.emoji' }, moodTypeColor: { $first: '$moodTypeDetails.colorCode' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, moodType: { id: '$_id', name: '$moodTypeName', emoji: '$moodTypeEmoji', colorCode: '$moodTypeColor' }, count: 1 } }
  ];

  const stats = await JournalEntry.aggregate(pipeline);
  const maxCount = stats.length > 0 ? stats[0].count : 0;
  const mostFrequentMoods = maxCount > 0 ? stats.filter(stat => stat.count === maxCount).map(stat => stat.moodType) : [];

  return {
    mostFrequentMoods,
    moodCounts: stats,
    dateRange: { from: format(fromDate, 'yyyy-MM-dd'), to: format(toDate, 'yyyy-MM-dd') },
  };
};
