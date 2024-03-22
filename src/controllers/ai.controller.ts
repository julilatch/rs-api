const { fromBuffer } = require("pdf2pic");
const { PDFDocument } = require("pdf-lib");
import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import {
  AnalyzeDocumentCommand,
  AnalyzeDocumentCommandInput,
  TextractClient,
} from "@aws-sdk/client-textract";
// @ts-expect-error
import TextractHelper from "aws-textract-helper";

const client = new TextractClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

type FullFilledResults = {
  status: "fulfilled";
  value: any;
};

type RejectResults = {
  status: "rejected";
  reason: string;
};

type AiResponse = {
  fileName: string;
  tables: Results[];
};

type Results = RejectResults | FullFilledResults;
const batchSize = 10;
const imageBatchSize = 50

export const getStatement = async (req: Request, res: Response) => {
  const files = Array.isArray(req.files?.file)
    ? req.files?.file
    : [req.files?.file].filter(
      (file): file is UploadedFile => file !== undefined
    );

  if (!files) {
    return res.status(400).json({ message: "No file provided" });
  }

  // discard that it's an array
  if (!Array.isArray(files)) {
    return res.status(400).json({ message: "Files Object Should be a List!" });
  }

  try {
    const response: any = await Promise.allSettled(
      files.map(async (file) => {
        const images: Buffer[][] = await toImages(file);
        const rawResults: Results[] = await toRawResults(images);
        const results: Results[] = await toResults(rawResults);

        return {
          fileName: file.name,
          tables: results,
        } as AiResponse;
      })
    ).then((res) => toResults(res));

    return res.status(200).json(response);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error });
  }
};

/**
 * Converts a PDF file to a collection of image buffers.
 * @param file The PDF file to convert.
 * @returns An array of batches, each containing image buffers.
 */
const toImages = async (file: UploadedFile) => {
  console.log("Converting PDF To Images");

  const pdfDoc = await PDFDocument.load(file.data);
  const numPages = pdfDoc.getPageCount();
  const imagesPromises = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum += imageBatchSize) {
    imagesPromises.push(
      fromBuffer(file.data, {
        width: 595,
        height: 892,
        density: 330,
      })
        .bulk(generateArray(pageNum, Math.min(pageNum + imageBatchSize, numPages)), {
          responseType: "buffer",
        })
        .then((outputs: { buffer: Buffer }[]) =>
          outputs.map((item) => item.buffer)
        )
    );
  }
  const images: Buffer[] = (await Promise.all(imagesPromises)).flat();

  // Step 2: Split images into batches
  const batches: Buffer[][] = [];
  const numBatches = Math.ceil(images.length / batchSize);
  for (let i = 0; i < numBatches; i++) {
    const startIdx = i * batchSize;
    const endIdx = Math.min((i + 1) * batchSize, images.length);
    batches.push(images.slice(startIdx, endIdx));
  }

  console.log("Converting PDF To Images (Success)");
  return batches;
};

/**
 * Extracts tables from an image using Amazon Textract.
 * @param image The image from which tables are to be extracted.
 * @returns An array of formatted tables extracted from the image.
 */
const toTables = async (image: any) => {
  const input: AnalyzeDocumentCommandInput = {
    Document: {
      Bytes: new Uint8Array(image as any),
    },
    FeatureTypes: ["TABLES"],
  };

  const command = new AnalyzeDocumentCommand(input);
  const result = await client.send(command);
  const formattedTables = TextractHelper.createTables(result);
  return formattedTables.map((table: any) => {
    return {
      table_name: "",
      table: {
        // get object value for each object except the first one, which is the headers
        headers: Object.values(table["1"]).map((header) => header),
        rows: Object.values(table)
          .slice(1)
          .map((row: any) => {
            return Object.values(row).map((cell) => cell);
          }),
      },
    };
  });
};

/**
 * Extracts raw results from a collection of images.
 * @param images An array of arrays containing image buffers, organized into batches.
 * @returns An array of raw results extracted from the images.
 */
const toRawResults = async (images: Buffer[][]) => {
  const results: Results[] = [];
  for (let i = 0; i < images.length; i++) {
    console.log("==============================");
    console.log(
      `=====  Batch No-${i} || Total Batches-${images.length} || Batch Size-${batchSize}  =====`
    );
    console.log("==============================");

    const batch = images[i];
    const batchResults: Results[] = await Promise.allSettled(
      batch.map(async (image, j) => {
        console.log("==============================");
        console.log(`=====  Batch-${i} || Image-${j}   =====`);
        console.log("==============================");
        return await toTables(image);
      })
    );

    results.push(...batchResults);
  }
  return results;
};

const toResults = async (results: Results[]) => {
  const rejected = results.filter(
    (result): result is RejectResults => result.status === "rejected"
  );

  if (rejected.length > 0) {
    console.error(rejected);
  }

  return results
    .filter(
      (result): result is FullFilledResults => result.status === "fulfilled"
    )
    .map((result) => result.value)
    .flat();
};

const generateArray = (start: number, end: number) => {
  return Array.from({ length: end - start }, (_, index) => start + index);
};
