import { ExtractedData } from "./lib/extractor.js";

export type OutputFormat = "json" | "table" | "yaml";

function printTable(data: Record<string, unknown>): void {
  const maxKeyLen = Math.max(...Object.keys(data).map((k) => k.length));

  for (const [key, value] of Object.entries(data)) {
    let displayValue: string;
    if (Array.isArray(value)) {
      displayValue = value.length > 0 ? value.join(", ") : "None";
    } else if (typeof value === "object" && value !== null) {
      displayValue = JSON.stringify(value);
    } else {
      displayValue = String(value ?? "None");
    }
    console.log(`${key.padEnd(maxKeyLen)}  │  ${displayValue}`);
  }
}

function printYaml(data: Record<string, unknown>, indent: number = 0): void {
  const prefix = "  ".repeat(indent);

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      console.log(`${prefix}${key}:`);
      for (const item of value) {
        console.log(`${prefix}  - ${item}`);
      }
    } else if (typeof value === "object" && value !== null) {
      console.log(`${prefix}${key}:`);
      printYaml(value as Record<string, unknown>, indent + 1);
    } else {
      console.log(`${prefix}${key}: ${value ?? "null"}`);
    }
  }
}

export function printOutput(data: ExtractedData, format: OutputFormat): void {
  switch (format) {
    case "json":
      console.log(JSON.stringify(data, null, 2));
      break;
    case "table":
      printTable(data as unknown as Record<string, unknown>);
      break;
    case "yaml":
      printYaml(data as unknown as Record<string, unknown>);
      break;
  }
}
