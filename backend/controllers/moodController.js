const mongoose = require('mongoose'); // Import mongoose
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
// Note: This function might be redundant now if moods are only tied to entries.
// Consider removing if no longer used directly by the frontend.
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
exports.getMoodStats = async (req, res, next) => { // Removed catchAsync temporarily for detailed logging
  try {
    console.log("Entering getMoodStats..."); // Log entry point
    const userId = req.user.id;
    const period = req.query.period || 'month'; // Default to last month
    console.log(`User ID: ${userId}, Period: ${period}`); // Log inputs

    let fromDate;
    let toDate = endOfDay(new Date()); // Use let for potential reassignment

    console.log(`Initial toDate: ${toDate.toISOString()}`);

    switch (period) {
      case 'week':
        fromDate = startOfDay(subDays(toDate, 7));
        break;
      case '3months':
        fromDate = startOfDay(subMonths(toDate, 3));
        break;
      case 'custom':
        // Use provided fromDate or default to 1 month ago
        fromDate = req.query.fromDate ? startOfDay(parseISO(req.query.fromDate)) : startOfDay(subMonths(new Date(), 1)); // Use new Date() for default start
        // Use provided toDate or default to today's end
        const customToDate = req.query.toDate ? endOfDay(parseISO(req.query.toDate)) : endOfDay(new Date()); // Use new Date() for default end
        console.log(`Custom Dates - Raw from: ${req.query.fromDate}, Raw to: ${req.query.toDate}`);
        console.log(`Custom Dates - Parsed from: ${fromDate.toISOString()}, Parsed to: ${customToDate.toISOString()}`);
        // Ensure fromDate is not after toDate
        if (fromDate > customToDate) {
            console.error("Validation Error: Start date cannot be after end date.");
            return next(new AppError('Start date cannot be after end date', 400));
        }
        // Reassign toDate only if custom toDate was provided and valid
        toDate = customToDate; // Assign the calculated customToDate to the main toDate variable
        break;
      case 'month':
      default:
        fromDate = startOfDay(subMonths(toDate, 1));
        break;
    }

    console.log(`Calculated Date Range: ${fromDate.toISOString()} - ${toDate.toISOString()}`);

    // --- Validate User ID ---
    const userIdStr = req.user.id;
    if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
      console.error(`Invalid user ID format received in getMoodStats: ${userIdStr}`);
      return res.status(400).json({ status: 'fail', message: 'Invalid user ID format' });
      // return next(new AppError('Invalid user ID format', 400));
    }
    const userObjectId = new mongoose.Types.ObjectId(userIdStr);
    console.log(`User ObjectId: ${userObjectId}`);

    // --- Aggregation Pipeline ---
    console.log("Starting aggregation pipeline...");
    const pipeline = [
      // 1. Match entries by user and date range
      {
        $match: {
          user: userObjectId,
          createdAt: { $gte: fromDate, $lte: toDate },
          mood: { $exists: true, $ne: null }
        }
      },
      // 2. Lookup the associated Mood document
      {
        $lookup: {
          from: 'moods', // Ensure this collection name is correct
          localField: 'mood',
          foreignField: '_id',
          as: 'moodDetails'
        }
      },
      // 3. Unwind moodDetails
      {
        $unwind: { path: '$moodDetails', preserveNullAndEmptyArrays: true } // Preserve if lookup fails
      },
      // 4. Lookup the associated MoodType document
      {
        $lookup: {
          from: 'moodtypes', // Ensure this collection name is correct
          localField: 'moodDetails.moodType',
          foreignField: '_id',
          as: 'moodTypeDetails'
        }
      },
      // 5. Unwind moodTypeDetails
      {
        $unwind: { path: '$moodTypeDetails', preserveNullAndEmptyArrays: true } // Preserve if lookup fails
      },
      // 6. Filter out documents where lookups failed
      {
          $match: {
              'moodDetails': { $exists: true, $ne: null, $ne: [] }, // Ensure mood was found and not empty array
              'moodTypeDetails': { $exists: true, $ne: null, $ne: [] } // Ensure moodType was found and not empty array
          }
      },
      // 7. Group by MoodType
      {
        $group: {
          _id: '$moodTypeDetails._id',
          moodTypeName: { $first: '$moodTypeDetails.name' },
          moodTypeEmoji: { $first: '$moodTypeDetails.emoji' },
          moodTypeColor: { $first: '$moodTypeDetails.colorCode' },
          count: { $sum: 1 },
        }
      },
      // 8. Sort
      {
        $sort: { count: -1 },
      },
      // 9. Project final shape
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
    console.log("Aggregation Result:", JSON.stringify(stats, null, 2)); // Log the raw result

    // Find the most frequent mood
    const mostFrequentMood = stats.length > 0 ? stats[0].moodType : null;
    console.log("Most Frequent Mood:", mostFrequentMood);

    res.status(200).json({
      status: 'success',
      data: {
        mostFrequentMood,
        moodCounts: stats,
        dateRange: {
          from: format(fromDate, 'yyyy-MM-dd'),
          to: format(toDate, 'yyyy-MM-dd'),
        },
      },
    });

  } catch (error) {
    console.error("Error in getMoodStats:", error); // Log the specific error
    // Pass the error to the global error handler
    next(error);
  }
};


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
   const userIdStr = req.user.id; // Get user ID string
   if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
     console.error(`Invalid user ID format received in getMoodCalendar: ${userIdStr}`);
     return res.status(400).json({ status: 'fail', message: 'Invalid user ID format' });
   }
   const userObjectId = new mongoose.Types.ObjectId(userIdStr); // Convert safely


  const entries = await JournalEntry.find({
    user: userObjectId, // Use ObjectId
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
// This might also need adjustment to pull from Entries if that's the sole source now.
exports.getMoodInsights = catchAsync(async (req, res, next) => {
  // This endpoint requires significant analysis (trends, correlations, patterns)
  // based on the user's mood history. Implementing this fully might involve
  // complex aggregation pipelines or dedicated analysis logic.
  // For now, return a placeholder or basic info.

  // Example: Return simple count of moods linked to entries in the last 3 months
  const userId = req.user.id;
  const fromDate = startOfDay(subMonths(new Date(), 3));
  const toDate = endOfDay(new Date());

   const userIdStr = req.user.id; // Get user ID string
   if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
     console.error(`Invalid user ID format received in getMoodInsights: ${userIdStr}`);
     // Return 0 or appropriate default if ID is invalid
     return res.status(200).json({
         status: 'success',
         message: 'Mood insights feature under development. Basic data provided.',
         data: { period: 'last 3 months', totalMoodsRecorded: 0 }
     });
   }
   const userObjectId = new mongoose.Types.ObjectId(userIdStr); // Convert safely

  // Count entries with moods in the period
  const moodCount = await JournalEntry.countDocuments({
      user: userObjectId,
      createdAt: { $gte: fromDate, $lte: toDate },
      mood: { $exists: true, $ne: null }
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
