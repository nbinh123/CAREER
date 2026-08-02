// src/utils/uploadToCloudinary.js
const { Readable } = require("stream");
const cloudinary = require("../config/cloudinary");

function bufferToStream(buffer) {
    const readable = new Readable();
    readable._read = () => {}; // no-op — cần thiết để tự tạo Readable stream từ buffer
    readable.push(buffer);
    readable.push(null);
    return readable;
}

// Upload 1 buffer ảnh (lấy từ multer memoryStorage, req.file.buffer) lên
// Cloudinary. Trả về Promise resolve object kết quả của Cloudinary, trong
// đó cần nhất là result.secure_url (link ảnh) và result.public_id (dùng để
// xoá ảnh sau này nếu cần).
function uploadBufferToCloudinary(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "restaurant/foods",
                resource_type: "image",
                ...options,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        bufferToStream(buffer).pipe(uploadStream);
    });
}

module.exports = uploadBufferToCloudinary;
