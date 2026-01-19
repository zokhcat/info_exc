import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface LLMConfig {
  model: string;
  temperature: number;
}

export interface AppConfig {
  llm: LLMConfig;
}

const DEFAULT_CONFIG: AppConfig = {
  llm: {
    model: "gpt-4o",
    temperature: 0,
  },
};

export function loadConfig(): AppConfig {
  const configPaths = [
    join(process.cwd(), "info-exc.config.json"),
    join(process.cwd(), ".info-excrc.json"),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const fileContent = readFileSync(configPath, "utf-8");
        const userConfig = JSON.parse(fileContent);
        return {
          llm: { ...DEFAULT_CONFIG.llm, ...userConfig.llm },
        };
      } catch (e) {
        console.warn(`Failed to parse config at ${configPath}`);
      }
    }
  }

  return DEFAULT_CONFIG;
}