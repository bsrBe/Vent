const JournalEntry = require('../models/Entry');
const Mood = require('../models/Mood');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { format, parseISO, startOfDay, endOfDay } = require('date-fns');
const { createObjectCsvStringifier } = require('csv-writer');
const PDFDocument = require('pdfkit');

// Helper function to fetch entries based on filters
const fetchEntriesForExport = async (userId, fromDateStr, toDateStr) => {
  const filter = {
    user: userId,
    // deletedAt: null, // Handled by pre-find hook
  };

  if (fromDateStr || toDateStr) {
    filter.createdAt = {};
    if (fromDateStr) filter.createdAt.$gte = startOfDay(parseISO(fromDateStr));
    if (toDateStr) filter.createdAt.$lte = endOfDay(parseISO(toDateStr));
  }

  // Fetch entries, ensuring necessary fields are populated
  const entries = await JournalEntry.find(filter)
    .populate('mood', 'moodType intensity notes') // Populate mood details
    .populate({ // Nested populate for moodType within mood
        path: 'mood',
        populate: {
            path: 'moodType',
            select: 'name emoji'
        }
    })
    .sort('-createdAt'); // Sort by date

  // Format for export
  return entries.map(entry => ({
    id: entry._id.toString(),
    title: entry.title,
    content: entry.content,
    category: entry.category,
    mood: entry.mood?.moodType?.name || null,
    moodEmoji: entry.mood?.moodType?.emoji || null,
    moodIntensity: entry.mood?.intensity || null,
    moodNotes: entry.mood?.notes || null,
    createdAt: format(entry.createdAt, 'yyyy-MM-dd HH:mm:ss'),
  }));
};

// Helper function to fetch moods based on filters
const fetchMoodsForExport = async (userId, fromDateStr, toDateStr) => {
    const filter = { user: userId };

    if (fromDateStr || toDateStr) {
        filter.date = {};
        if (fromDateStr) filter.date.$gte = startOfDay(parseISO(fromDateStr));
        if (toDateStr) filter.date.$lte = endOfDay(parseISO(toDateStr));
    }

    const moods = await Mood.find(filter)
        .populate('moodType', 'name emoji') // Populate mood type details
        .populate('journalEntry', 'title') // Populate linked entry title
        .sort('-date'); // Sort by date

    // Format for export
    return moods.map(mood => ({
        id: mood._id.toString(),
        mood: mood.moodType?.name || null,
        emoji: mood.moodType?.emoji || null,
        intensity: mood.intensity,
        date: format(mood.date, 'yyyy-MM-dd'),
        timeOfDay: mood.timeOfDay ? format(mood.timeOfDay, 'HH:mm:ss') : null,
        notes: mood.notes || null,
        journalEntryTitle: mood.journalEntry?.title || null,
        createdAt: format(mood.createdAt, 'yyyy-MM-dd HH:mm:ss'),
    }));
};


// --- Export Entries ---

exports.exportEntries = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const exportFormat = req.query.format || 'json'; // Default to JSON
  const { fromDate, toDate } = req.query;

  const entries = await fetchEntriesForExport(userId, fromDate, toDate);

  switch (exportFormat.toLowerCase()) {
    case 'pdf':
      exportEntriesToPdf(entries, res);
      break;
    case 'csv':
      exportEntriesToCsv(entries, res);
      break;
    case 'json':
    default:
      exportEntriesToJson(entries, res);
      break;
  }
});

const exportEntriesToJson = (entries, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=journal_entries.json');
  res.status(200).json(entries);
};

const exportEntriesToCsv = (entries, res) => {
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'createdAt', title: 'Created At' },
      { id: 'title', title: 'Title' },
      { id: 'category', title: 'Category' },
      { id: 'mood', title: 'Mood' },
      { id: 'moodEmoji', title: 'Mood Emoji' },
      { id: 'moodIntensity', title: 'Mood Intensity' },
      { id: 'moodNotes', title: 'Mood Notes' },
      { id: 'content', title: 'Content' }, // Content last as it can be long
    ],
  });

  const csvHeader = csvStringifier.getHeaderString();
  const csvRows = csvStringifier.stringifyRecords(entries);
  const csvContent = csvHeader + csvRows;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=journal_entries.csv');
  res.status(200).send(csvContent);
};

const exportEntriesToPdf = (entries, res) => {
  const doc = new PDFDocument({ bufferPages: true, margin: 50 });
  const buffers = [];

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    const pdfData = Buffer.concat(buffers);
    res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=journal_entries.pdf',
        'Content-Length': pdfData.length
    });
    res.end(pdfData);
  });

  // PDF Content
  doc.fontSize(20).text('Journal Entries Export', { align: 'center' });
  doc.moveDown(2);

  entries.forEach((entry, index) => {
    doc.fontSize(14).font('Helvetica-Bold').text(entry.title);
    doc.font('Helvetica').fontSize(10).text(`Date: ${entry.createdAt} | Category: ${entry.category}`);
    if (entry.mood) {
      doc.text(`Mood: ${entry.moodEmoji} ${entry.mood} (Intensity: ${entry.moodIntensity || 'N/A'})`);
      if(entry.moodNotes) doc.text(`Mood Notes: ${entry.moodNotes}`);
    }
    doc.moveDown(0.5);
    doc.fontSize(11).text(entry.content, {
        align: 'justify',
        indent: 10,
    });

    // Add page break before next entry if not the last one
    if (index < entries.length - 1) {
      doc.addPage();
    }
  });

  doc.end();
};


// --- Export Moods ---

exports.exportMoods = catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const exportFormat = req.query.format || 'json';
    const { fromDate, toDate } = req.query;

    const moods = await fetchMoodsForExport(userId, fromDate, toDate);

    switch (exportFormat.toLowerCase()) {
        case 'pdf':
            exportMoodsToPdf(moods, res);
            break;
        case 'csv':
            exportMoodsToCsv(moods, res);
            break;
        case 'json':
        default:
            exportMoodsToJson(moods, res);
            break;
    }
});

const exportMoodsToJson = (moods, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=mood_data.json');
    res.status(200).json(moods);
};

const exportMoodsToCsv = (moods, res) => {
    const csvStringifier = createObjectCsvStringifier({
        header: [
            { id: 'date', title: 'Date' },
            { id: 'timeOfDay', title: 'Time' },
            { id: 'mood', title: 'Mood' },
            { id: 'emoji', title: 'Emoji' },
            { id: 'intensity', title: 'Intensity' },
            { id: 'notes', title: 'Notes' },
            { id: 'journalEntryTitle', title: 'Linked Journal Entry' },
            { id: 'createdAt', title: 'Recorded At' },
        ],
    });

    const csvHeader = csvStringifier.getHeaderString();
    const csvRows = csvStringifier.stringifyRecords(moods);
    const csvContent = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=mood_data.csv');
    res.status(200).send(csvContent);
};

const exportMoodsToPdf = (moods, res) => {
    const doc = new PDFDocument({ bufferPages: true, margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename=mood_data.pdf',
            'Content-Length': pdfData.length
        });
        res.end(pdfData);
    });

    // PDF Content
    doc.fontSize(20).text('Mood Data Export', { align: 'center' });
    doc.moveDown(2);

    // Optional: Add Summary Stats
    const moodCounts = moods.reduce((acc, mood) => {
        const name = mood.mood || 'Unknown';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {});
    doc.fontSize(14).font('Helvetica-Bold').text('Mood Summary');
    Object.entries(moodCounts).forEach(([moodName, count]) => {
        doc.fontSize(11).font('Helvetica').text(`${moodName}: ${count} entries`);
    });
    doc.moveDown(1.5);


    doc.fontSize(14).font('Helvetica-Bold').text('Mood Entries');
    doc.moveDown(1);

    moods.forEach((mood) => {
        doc.fontSize(12).font('Helvetica-Bold').text(`${mood.date} ${mood.timeOfDay || ''}: ${mood.emoji} ${mood.mood}`);
        doc.font('Helvetica').fontSize(10).text(`Intensity: ${mood.intensity}`);
        if (mood.journalEntryTitle) {
            doc.text(`Linked Entry: ${mood.journalEntryTitle}`);
        }
        if (mood.notes) {
            doc.text(`Notes: ${mood.notes}`);
        }
        doc.moveDown(1);
    });

    doc.end();
};
