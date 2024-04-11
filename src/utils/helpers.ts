import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { UploadedFile } from "express-fileupload";


export const UploadFileToWasabi = async (file: UploadedFile) => {
    // Set up AWS credentials and region
    const s3Client = new S3Client({
        region: "us-west-1",
        credentials: {
            accessKeyId: process.env.WASABI_ACCESS_KEY_ID!,
            secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY!,
        },
        endpoint: 'https://s3.us-west-1.wasabisys.com',
    });

    // Specify the parameters for uploading the file
    const uploadParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: `Error/${file.name}`,
        Body: file.data,
    };

    const upload = new Upload({
        client: s3Client,
        params: uploadParams,
    });


    // Upload the file to S3
    try {
        const result = await upload.done();
        console.log("File uploaded successfully");
    } catch (err) {
        console.error("Error uploading file:", err);
    }
}