const cloudinary = require('../config/cloudinary'); // Get configured Cloudinary instance
const { Readable } = require('stream'); // Needed for buffer uploads

/**
 * Uploads a file buffer to Cloudinary.
 *
 * @param {Buffer} buffer - The file buffer to upload.
 * @param {string} folder - The folder name in Cloudinary to store the file.
 * @param {string} public_id - Optional public ID for the file in Cloudinary.
 * @returns {Promise<object>} - The Cloudinary upload result object.
 * @throws {Error} - If the upload fails.
 */
const uploadBufferToCloudinary = (buffer, folder, public_id = null) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        public_id: public_id, // Let Cloudinary generate if null
        overwrite: true, // Overwrite if public_id is provided and exists
        // Add any other desired transformations or options here
        // e.g., transformation: [{ width: 500, height: 500, crop: "limit" }]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary Upload Error:', error);
          return reject(new Error('Failed to upload file to Cloudinary'));
        }
        resolve(result);
      }
    );

    // Create a readable stream from the buffer and pipe it to Cloudinary
    const stream = Readable.from(buffer);
    stream.pipe(uploadStream);
  });
};

module.exports = { uploadBufferToCloudinary };
