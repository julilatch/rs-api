import { Request, Response } from "express";

import {
  AnalyzeDocumentCommand,
  AnalyzeDocumentCommandInput,
  TextractClient,
} from "@aws-sdk/client-textract"
// @ts-expect-error
import TextractHelper from "aws-textract-helper"

const client = new TextractClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})


export const getStatement = async (req: Request, res: Response) => {
  const file = req.files?.file;

  if(!file) {
    return res.status(400).json({ message: "No file provided" })
  }

  // discard that it's an array
  if(file instanceof Array) {
    return res.status(400).json({ message: "Multiple files provided" })
  }
  

  try {
    console.log("converting file to bytes")

    const input: AnalyzeDocumentCommandInput = {
      Document: {
        Bytes: new Uint8Array(file.data),
      },
      FeatureTypes: ["LAYOUT", "TABLES"],
    }

    console.log("sending request to textract")

    const command = new AnalyzeDocumentCommand(input)
    const result = await client.send(command)

    const formattedTables = TextractHelper.createTables(result)

    const tables = formattedTables.map((table: any) => {
      const tableData = {
        table_name: "",

        table: {
          headers: Object.values(table["1"]).map((header) => header),

          // get object value for each object except the first one, which is the headers
          rows: Object.values(table)
            .slice(1)
            .map((row: any) => {
              return Object.values(row).map((cell) => cell)
            }),
        },
      }

      return tableData
    })

    // const tables = formatBlocksIntoTables(result.Blocks || [])

    return res.status(200).json({ tables })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error })
  }
};
