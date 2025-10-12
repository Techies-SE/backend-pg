// upload.js
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "doctor_profiles", // optional Cloudinary folder
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

module.exports = multer({ storage });
