// upload.js
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../cloudinary");
// const path = require('path');

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/'); // folder to store uploaded images
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     const ext = path.extname(file.originalname);
//     cb(null, file.fieldname + '-' + uniqueSuffix + ext);
//   }
// });

// const upload = multer({ storage: storage });

// module.exports = upload;
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "doctor_profiles", // optional Cloudinary folder
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

module.exports = multer({ storage });
