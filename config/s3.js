const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

/**
 * Fungsi untuk upload buffer multer ke S3
 * @returns URL CDN (CloudFront/Cloudflare)
 */
const uploadToS3 = async (file) => {
    const fileName = `uploads/${Date.now()}-${file.originalname}`;
    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
    });

    await s3Client.send(command);
    
    // Return URL via CDN sesuai aturan ETS
    return `${process.env.CDN_DOMAIN}/${fileName}`;
};

module.exports = { uploadToS3 };