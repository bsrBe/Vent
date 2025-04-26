const mongoose = require('mongoose');

const moodTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Mood type must have a name'],
      unique: true,
      trim: true,
    },
    emoji: {
      type: String,
      required: [true, 'Mood type must have an emoji'],
    },
    colorCode: {
      type: String,
      required: [true, 'Mood type must have a color code'],
      match: [/^#([0-9A-F]{3}){1,2}$/i, 'Please provide a valid hex color code'],
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

const MoodType = mongoose.model('MoodType', moodTypeSchema);

module.exports = MoodType;
