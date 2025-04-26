const mongoose = require('mongoose');

const categoryEnum = ['FAMILY', 'RELATIONSHIP', 'MYSELF', 'WORK', 'OTHER'];

const entrySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Journal entry must have a title'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Journal entry must have content'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Journal entry must have a category'],
      enum: {
        values: categoryEnum,
        message: 'Category must be one of: ' + categoryEnum.join(', '),
      },
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Journal entry must belong to a user'],
    },
    mood: {
      // This establishes a one-to-one relationship from Entry to Mood
      // The Mood model also has a reference back to JournalEntry
      type: mongoose.Schema.ObjectId,
      ref: 'Mood',
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      select: false, // Hide deletedAt field by default
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Indexes ---
entrySchema.index({ user: 1, createdAt: -1 }); // Index for user's entries sorted by creation date
entrySchema.index({ category: 1 });
entrySchema.index({ deletedAt: 1 }); // Index for querying non-deleted entries
entrySchema.index({ title: 'text', content: 'text' }); // Text index for searching

// --- Query Middleware ---

// Filter out soft-deleted entries by default for all 'find' operations
entrySchema.pre(/^find/, function (next) {
  // Only apply this if the query doesn't explicitly ask for deleted documents
  if (this.getOptions().withDeleted !== true) {
    this.where({ deletedAt: null });
  }
  next();
});

// Populate user and mood details when finding entries
entrySchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name email', // Select specific fields from User
  }).populate({
    path: 'mood',
    select: 'moodType intensity date notes', // Select specific fields from Mood
    populate: { // Nested populate for MoodType within Mood
      path: 'moodType',
      select: 'name emoji colorCode'
    }
  });
  next();
});


// --- Methods ---

// Instance method for soft deleting an entry
entrySchema.methods.softDelete = async function () {
  this.deletedAt = new Date();
  await this.save({ validateBeforeSave: false }); // Skip validation as we are just marking as deleted
};

// Static method to find deleted entries (if needed)
entrySchema.statics.findDeleted = function () {
  return this.find({ deletedAt: { $ne: null } }).setOptions({ withDeleted: true });
};

// Static method to restore a soft-deleted entry (if needed)
entrySchema.statics.restoreById = async function (id) {
  const entry = await this.findByIdAndUpdate(
    id,
    { $set: { deletedAt: null } },
    { new: true, runValidators: false } // Return updated doc, skip validation
  ).setOptions({ withDeleted: true }); // Ensure we can find it even if deleted
  return entry;
};


const Entry = mongoose.model('JournalEntry', entrySchema); // Model name 'JournalEntry' as per schema

module.exports = Entry;
