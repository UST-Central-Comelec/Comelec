import { z } from "zod";
import { documentBodyText, isSerializedDocumentBody, parseDocumentBody } from "./document-body";

/** Lists, search, metadata and reading times use readable text instead of stored formatting. */
export const newsContentText = (value: string) => documentBodyText(parseDocumentBody(value));

const content = (storageLimit: number) => z.string().trim().max(storageLimit, "The formatted content is too long.")
  .refine(value => !value.startsWith("::document-body:v1::") || isSerializedDocumentBody(value), "The formatting couldn’t be read. Please edit the content and try again.");

export const newsSummarySchema = content(50000)
  .refine(value => newsContentText(value).trim().length >= 10, "Add a short summary (at least 10 characters).")
  .refine(value => newsContentText(value).length <= 300, "Keep the summary under 300 characters.");
export const newsArticleSchema = content(200000)
  .refine(value => newsContentText(value).length <= 20000, "The article is too long.");
