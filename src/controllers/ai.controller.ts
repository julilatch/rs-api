import { Request, Response } from "express";
const { fromBuffer } = require("pdf2pic");
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

type Results = RejectResults | FullFilledResults;

export const getStatement = async (req: Request, res: Response) => {
  const file = req.files?.file;

  if (!file) {
    return res.status(400).json({ message: "No file provided" });
  }

  // discard that it's an array
  if (file instanceof Array) {
    return res.status(400).json({ message: "Multiple files provided" });
  }

  try {
    console.log("converting file to images");
    const baseOptions = {
      width: 595,
      height: 892,
      density: 330,
    };
    const images: Buffer[] = await fromBuffer(file.data, baseOptions)
    .bulk(-1, { responseType: "buffer" })
    .then((outputs:{ buffer: Buffer }[]) => outputs.map(item => item.buffer))

    console.log("sending request to textract");

    // analyze each image on parralel. This is the most expensive part
    const results: Results[] = await Promise.allSettled(
      images.map(async (image, idx) => {
        console.log(`analyzing image #${idx + 1}`);

        const input: AnalyzeDocumentCommandInput = {
          Document: {
            Bytes: new Uint8Array(image as any),
          },
          FeatureTypes: ["TABLES"],
        };

        const command = new AnalyzeDocumentCommand(input);
        const result = await client.send(command);

        const formattedTables = TextractHelper.createTables(result);

        const tables = formattedTables.map((table: any) => {
          const tableData = {
            table_name: "",

            table: {
              headers: Object.values(table["1"]).map((header) => header),

              // get object value for each object except the first one, which is the headers
              rows: Object.values(table)
                .slice(1)
                .map((row: any) => {
                  return Object.values(row).map((cell) => cell);
                }),
            },
          };

          return tableData;
        });

        return tables;
      })
    );

    const rejected = results.filter(
      (result): result is RejectResults => result.status === "rejected"
    );

    if (rejected.length > 0) {
      console.log(rejected);
    }

    const tables = results
      .filter(
        (result): result is FullFilledResults => result.status === "fulfilled"
      )
      .map((result) => result.value)
      .flat();

    return res.status(200).json({ tables });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error });
  }
};
