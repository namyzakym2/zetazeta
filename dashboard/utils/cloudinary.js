const { v2: cloudinary } = require('cloudinary');

function isConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function configure() {
  if (!isConfigured()) throw new Error('Cloudinary is not configured.');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

function uploadBuffer(buffer, folder) {
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', use_filename: false, unique_filename: true },
      (error, result) => error ? reject(error) : resolve(result)
    );
    stream.end(buffer);
  });
}

module.exports = { isConfigured, uploadBuffer };
