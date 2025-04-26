const mongoose = require('mongoose');

const moodSchema = new mongoose.Schema(
  {
    moodType: {
      type: mongoose.Schema.ObjectId,
      ref: 'MoodType',
      required: [true, 'Mood entry must belong to a mood type'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Mood entry must belong to a user'],
    },
    intensity: {
      type: Number,
      min: [1, 'Intensity must be between 1 and 5'],
      max: [5, 'Intensity must be between 1 and 5'],
      default: 3,
    },
    date: {
      type: Date,
      required: [true, 'Mood entry must have a date'],
      default: Date.now,
      // Consider adding an index if querying by date range is frequent
      // index: true,
    },
    timeOfDay: {
      // Storing time as a string HH:MM or HH:MM:SS might be simpler
      // if only time is needed without date context.
      // Alternatively, store the full DateTime and extract time in application logic.
      // For simplicity, let's store the full date/time and allow filtering/display logic to handle the time part.
      // If specific time-only queries are needed, storing as string or separate fields might be better.
      type: Date, // Store the full timestamp, can extract time later
      default: null,
    },
    notes: {
      type: String,
      trim: true,
    },
    journalEntry: {
      type: mongoose.Schema.ObjectId,
      ref: 'JournalEntry',
      default: null, // Moods don't always have an associated journal entry
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Indexes ---
// Indexing fields commonly used in queries can improve performance
moodSchema.index({ user: 1, date: -1 }); // Example: Index for user's moods sorted by date
moodSchema.index({ moodType: 1 });

// --- Middleware ---
// Populate moodType and user details when finding moods
moodSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'moodType',
    select: 'name emoji colorCode', // Select specific fields from MoodType
  }).populate({
    path: 'user',
    select: 'name email', // Select specific fields from User (optional)
  });
  // Optionally populate journalEntry if needed frequently
  // this.populate('journalEntry', 'title');
  next();
});

const Mood = mongoose.model('Mood', moodSchema);

module.exports = Mood;
