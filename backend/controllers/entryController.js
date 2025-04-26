const mongoose = require('mongoose'); // Import mongoose
const JournalEntry = require('../models/Entry');
const Mood = require('../models/Mood'); // Needed for linking mood on creation/update
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
// const APIFeatures = require('../utils/apiFeatures'); // Removed - Filtering/pagination handled below

// Utility for handling API features like filtering, sorting, pagination
// Filtering/pagination logic is implemented directly in getEntries below.
// For now, let's assume basic filtering/pagination logic within the controller.

exports.getEntries = catchAsync(async (req, res, next) => {
  const userId = req.user.id; // User ID from protect middleware

  // --- Filtering ---
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(el => delete queryObj[el]);

  // Advanced filtering (gte, gt, lte, lt)
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

  let filter = JSON.parse(queryStr);
  filter.user = userId; // Ensure user only gets their entries
  // filter.deletedAt = null; // Filter out deleted entries (handled by pre-find hook in model)

  // Handle specific filters from backend.txt example
  if (req.query.category) {
    filter.category = req.query.category.toUpperCase();
  }
  if (req.query.moodId) {
    // This requires querying based on a field in the populated Mood document.
    // A more efficient approach might involve a separate query or denormalization.
    // Simple approach (less efficient): Query moods first, then entries.
    // Better approach: Adjust query if possible, or filter after fetching.
    // Let's stick to direct JournalEntry fields for now. Filtering by mood properties
    // might need adjustment based on performance needs.
    // We can filter by the existence of a mood or its ID directly on JournalEntry:
    // filter.mood = { $ne: null }; // Example: entries with any mood linked
    // Or if moodId refers to MoodType ID:
    // This requires a more complex query involving Mood collection.
    // We'll skip direct moodTypeId filtering here for simplicity,
    // but it can be added with an aggregation pipeline if needed.
  }
  if (req.query.fromDate || req.query.toDate) {
    filter.createdAt = {};
    if (req.query.fromDate) filter.createdAt.$gte = new Date(req.query.fromDate);
    if (req.query.toDate) filter.createdAt.$lte = new Date(req.query.toDate);
  }

  let query = JournalEntry.find(filter);

  // --- Sorting ---
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt'); // Default sort
  }

  // --- Field Limiting ---
  if (req.query.fields) {
    const fields = req.query.fields.split(',').join(' ');
    query = query.select(fields);
  } else {
    query = query.select('-__v'); // Exclude __v by default
  }

  // --- Pagination ---
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20; // Default limit 20
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit);

  // Execute query
  const entries = await query;
  const total = await JournalEntry.countDocuments({ ...filter, user: userId }); // Count documents matching filter for this user

  // Send response
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

// Get available entry categories (conditionally adds BISRAT)
exports.getEntryCategories = catchAsync(async (req, res, next) => {
  // Base categories available to everyone
  // Note: Ideally, this enum would be imported directly from the model
  // or a shared constants file to avoid duplication. For simplicity here,
  // we redefine it based on the model's current state.
  const baseCategories = ['FAMILY', 'RELATIONSHIP', 'MYSELF', 'WORK', 'OTHER'];
  let availableCategories = [...baseCategories]; // Start with a copy

  // Check if the logged-in user is betsi2426@gmail.com
  if (req.user && req.user.email === 'betsi2426@gmail.com') {
    // Add the special category only for this user
    availableCategories.push('BISRAT');
  }

  res.status(200).json({
    status: 'success',
    data: {
      categories: availableCategories,
    },
  });
});

exports.createEntry = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { title, content, category, moodTypeId, moodIntensity, moodNotes, moodDate, moodTimeOfDay } = req.body;

  if (!title || !content || !category) {
    return next(new AppError('Please provide title, content, and category', 400));
  }

  // Validate category enum (already handled by Mongoose schema enum validator)

  // Use a transaction if creating both Entry and Mood to ensure atomicity
  const session = await mongoose.startSession();
  session.startTransaction();
  let newEntry;
  try {
    // 1. Create the Journal Entry
    const entryData = {
      title,
      content,
      category: category.toUpperCase(),
      user: userId,
    };
    const createdEntries = await JournalEntry.create([entryData], { session });
    newEntry = createdEntries[0];

    // 2. If mood details are provided, create the Mood entry
    let newMood = null;
    if (moodTypeId) {
      const moodData = {
        moodType: moodTypeId,
        user: userId,
        intensity: moodIntensity,
        notes: moodNotes,
        date: moodDate ? new Date(moodDate) : new Date(), // Use provided date or now
        timeOfDay: moodTimeOfDay ? new Date(`1970-01-01T${moodTimeOfDay}`) : null, // Handle time
        journalEntry: newEntry._id, // Link mood to the new entry
      };
      const createdMoods = await Mood.create([moodData], { session });
      newMood = createdMoods[0];

      // 3. Update the Journal Entry with the Mood ID
      newEntry.mood = newMood._id;
      await newEntry.save({ session });
    }

    await session.commitTransaction();

    // Populate the newly created entry before sending response
    // Need to re-fetch or manually populate because session results might not be populated
    const populatedEntry = await JournalEntry.findById(newEntry._id);


    res.status(201).json({
      status: 'success',
      data: {
        entry: populatedEntry,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    // Handle potential validation errors or other issues
     if (error.name === 'ValidationError') {
        // Extract validation messages
        const errors = Object.values(error.errors).map(el => el.message);
        const message = `Invalid input data. ${errors.join('. ')}`;
        return next(new AppError(message, 400));
    }
    return next(new AppError('Error creating journal entry. ' + error.message, 500)); // Pass other errors
  } finally {
    session.endSession();
  }
});


exports.getEntry = catchAsync(async (req, res, next) => {
  const entryId = req.params.id;
  const userId = req.user.id;

  const entry = await JournalEntry.findOne({ _id: entryId, user: userId });
  // Pre-find hook handles population and filtering deletedAt: null

  if (!entry) {
    return next(new AppError('No journal entry found with that ID for this user', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      entry,
    },
  });
});

exports.updateEntry = catchAsync(async (req, res, next) => {
  const entryId = req.params.id;
  const userId = req.user.id;
  const { title, content, category, moodTypeId, moodIntensity, moodNotes, moodDate, moodTimeOfDay } = req.body;

  // Use a transaction for potential multi-document updates (Entry + Mood)
  const session = await mongoose.startSession();
  session.startTransaction();
  let updatedEntry;

  try {
    // 1. Find the existing entry for the user
    const existingEntry = await JournalEntry.findOne({ _id: entryId, user: userId }).session(session);

    if (!existingEntry) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('No journal entry found with that ID for this user', 404));
    }

    // 2. Update JournalEntry fields
    if (title !== undefined) existingEntry.title = title;
    if (content !== undefined) existingEntry.content = content;
    if (category !== undefined) existingEntry.category = category.toUpperCase();

    // 3. Handle Mood update/creation/deletion
    const existingMoodId = existingEntry.mood; // Get the ID of the currently linked mood

    if (moodTypeId !== undefined) { // If mood information is being provided in the update
      const moodData = {
        moodType: moodTypeId,
        user: userId,
        intensity: moodIntensity,
        notes: moodNotes,
        date: moodDate ? new Date(moodDate) : new Date(),
        timeOfDay: moodTimeOfDay ? new Date(`1970-01-01T${moodTimeOfDay}`) : null,
        journalEntry: existingEntry._id,
      };

      if (existingMoodId && moodTypeId) { // Update existing linked mood
        await Mood.findByIdAndUpdate(existingMoodId, moodData, { session, runValidators: true });
        existingEntry.mood = existingMoodId; // Ensure link remains
      } else if (!existingMoodId && moodTypeId) { // Create new mood and link it
        const createdMoods = await Mood.create([moodData], { session });
        existingEntry.mood = createdMoods[0]._id;
      } else if (existingMoodId && !moodTypeId) { // Remove existing mood link (and optionally delete mood)
        // Decide whether to delete the Mood document or just unlink it
        await Mood.findByIdAndDelete(existingMoodId, { session }); // Example: Delete the mood
        existingEntry.mood = null;
      }
    } else if (moodTypeId === null && existingMoodId) { // Explicitly removing mood link
        await Mood.findByIdAndDelete(existingMoodId, { session }); // Example: Delete the mood
        existingEntry.mood = null;
    }


    // 4. Save the updated JournalEntry
    updatedEntry = await existingEntry.save({ session });

    await session.commitTransaction();

    // Re-fetch to ensure population after transaction
    const populatedEntry = await JournalEntry.findById(updatedEntry._id);

    res.status(200).json({
      status: 'success',
      data: {
        entry: populatedEntry,
      },
    });

  } catch (error) {
    await session.abortTransaction();
     if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(el => el.message);
        const message = `Invalid input data. ${errors.join('. ')}`;
        return next(new AppError(message, 400));
    }
    return next(new AppError('Error updating journal entry. ' + error.message, 500));
  } finally {
    session.endSession();
  }
});


exports.deleteEntry = catchAsync(async (req, res, next) => {
  const entryId = req.params.id;
  const userId = req.user.id;

  const entry = await JournalEntry.findOne({ _id: entryId, user: userId });

  if (!entry) {
    return next(new AppError('No journal entry found with that ID for this user', 404));
  }

  // Use the softDelete instance method defined in the model
  await entry.softDelete();

  // Also consider deleting the associated Mood entry if it exists and is only linked here
  if (entry.mood) {
      await Mood.findByIdAndDelete(entry.mood);
  }


  // Send 204 No Content for successful deletion
  res.status(204).json({
    status: 'success',
    data: null,
  });
});
