import { Request, Response } from "express";

import OpenAI from "openai";
import {
  ChatCompletionCreateParams,
  ChatCompletionMessage,
} from "openai/resources/chat/index";

interface RequestBody {
  content: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const instruction = `You're going to receive a text that represent a bank statement. Your task is to extract the following information from the text:
    Search for any table that contains relevant information about the bank statement.
    
    For example:

    Account Summary.
    Deposits.
    Withdrawals.
    Other credits.
    Transactions.

    Your task is return the table in a JSON format. The goal is to extract the information from the text and return it in a structured format.
    To be able to export as csv, xlsx or proper json.

    If there's a total amount (sum of certain column) in the table, please return it as well.
    You could append it as the last row, with other values as empty strings if needed.

    Always include a two-column table called "Information" with data about the bank statement and the holder of the account.
    The first column should be the name of the field and the second column should be the value. The table should be in the same format as the other tables.
    The table should be the first table in the JSON format. If fields are missing, don't include them in the table.

    Some of the fields that you should include are:
    - Account Number
    - Account Holder
    - Address
    - Bank Name
    - Statement Date (or Period)
    - Total Amount (if there's a total amount in the table). E.g: Total Deposits, Total Withdrawals, etc.
`;

const functions: ChatCompletionCreateParams.Function[] = [
  {
    name: "format_tables",
    description: "Format the tables in the bank statement to a JSON format.",
    parameters: {
      type: "object",

      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              table_name: {
                type: "string",
              },

              table: {
                type: "object",
                properties: {
                  headers: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },

                  rows: {
                    type: "array",
                    items: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      required: ["results"],
    },
  },
];

export const getStatement = async (req: Request, res: Response) => {
  const { content }: RequestBody = req.body;

  const messages: ChatCompletionMessage[] = [
    {
      role: "system",
      content: instruction,
    },
  ];

  messages.push({
    role: "user",
    content,
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages,
      temperature: 0.2,
      functions,
    });

    const usage = response.usage;
    const content = response.choices[0].message.function_call;

    console.log("usage format", usage);

    return res.json(content).status(200);
  } catch (error) {
    console.log("error", error);

    return res.json(error).status(500);
  }
};
