#!/usr/bin/env node

import { Command } from "commander";
import { extractData } from "./lib/extractor.js";
import { printOutput, OutputFormat } from "./utils.js";
import dotenv from "dotenv";
dotenv.config();

const program = new Command();

program
  .name("info-exc")
  .description("brand info extractor CLI")
  .version("0.1.0");

program
  .command("extract")
  .description("extract brand info from a website URL")
  .argument("<url>", "The website URL to extract from")
  .option("-f, --format <format>", "Output format (json, table, yaml)", "json")
  .action(async (url: string, options) => {
    const format = options.format as OutputFormat;

    try {
      const data = await extractData(url, process.env.OPENAI_API_KEY);
      printOutput(data, format);
    } catch (error) {
      console.error(`Error extracting data: ${error}`);
      process.exit(1);
    }
  });

program.parse();
