const multer = require('multer');
const path = require('path');

// Use memoryStorage — buffer available as req.file.buffer for Cloudinary
// AND we keep the original filename for local fallback
const storage = multer.memoryStorage();

function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Images only! Allowed: jpg, jpeg, png, webp'));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

module.exports = upload;
