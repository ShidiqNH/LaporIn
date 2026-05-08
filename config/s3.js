const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto'); // Tambahkan ini untuk generate string unik
require('dotenv').config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

/**
 * Fungsi untuk upload buffer multer ke S3 dengan nama unik
 * @returns URL CDN (CloudFront/Cloudflare)
 */
const uploadToS3 = async (file) => {
    const fileExtension = file.originalname.split('.').pop();

    const uniqueSuffix = crypto.randomBytes(4).toString('hex');
    const fileName = `uploads/${Date.now()}-${uniqueSuffix}.${fileExtension}`;

    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
    });

    try {
        await s3Client.send(command);
        
        return `${process.env.CDN_DOMAIN}/${fileName}`;
    } catch (error) {
        console.error("Error upload ke S3:", error);
        throw error;
    }
};

module.exports = { uploadToS3 };