import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const datasets = [
  { file: "words-en.json", language: "en", field: "words", minimum: 300 },
  { file: "words-vi.json", language: "vi", field: "words", minimum: 300 },
  { file: "sentences-en.json", language: "en", field: "sentences", minimum: 100 },
  { file: "sentences-vi.json", language: "vi", field: "sentences", minimum: 100 },
  { file: "paragraphs-en.json", language: "en", field: "paragraphs", minimum: 30 },
  { file: "paragraphs-vi.json", language: "vi", field: "paragraphs", minimum: 30 }
];

let hasErrors = false;

function reportError(file, message) {
  hasErrors = true;
  console.error(`FAIL ${file}: ${message}`);
}

for (const dataset of datasets) {
  const errorsBeforeDataset = hasErrors;
  const filePath = path.join(rootDirectory, "data", dataset.file);
  let data;

  try {
    data = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    reportError(dataset.file, `invalid or unreadable JSON (${error.message})`);
    continue;
  }

  if (data === null || Array.isArray(data) || typeof data !== "object") {
    reportError(dataset.file, "top-level value must be an object");
    continue;
  }

  const expectedFields = ["language", dataset.field].sort();
  const actualFields = Object.keys(data).sort();
  if (JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
    reportError(
      dataset.file,
      `expected fields ${expectedFields.join(", ")}; received ${actualFields.join(", ")}`
    );
  }

  if (data.language !== dataset.language) {
    reportError(
      dataset.file,
      `language must be "${dataset.language}"; received ${JSON.stringify(data.language)}`
    );
  }

  const entries = data[dataset.field];
  if (!Array.isArray(entries)) {
    reportError(dataset.file, `field "${dataset.field}" must be an array`);
    continue;
  }

  if (entries.length < dataset.minimum) {
    reportError(
      dataset.file,
      `requires at least ${dataset.minimum} entries; received ${entries.length}`
    );
  }

  const invalidEntryIndex = entries.findIndex(
    (entry) => typeof entry !== "string" || entry.trim().length === 0
  );
  if (invalidEntryIndex !== -1) {
    reportError(dataset.file, `entry ${invalidEntryIndex} must be a non-empty string`);
  }

  const nonNormalizedEntryIndex = entries.findIndex(
    (entry) => typeof entry === "string" && entry !== entry.normalize("NFC")
  );
  if (nonNormalizedEntryIndex !== -1) {
    reportError(dataset.file, `entry ${nonNormalizedEntryIndex} must use NFC Unicode normalization`);
  }

  const comparableEntries = entries
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim().normalize("NFC"));
  const duplicateEntries = comparableEntries.filter(
    (entry, index) => comparableEntries.indexOf(entry) !== index
  );
  if (duplicateEntries.length > 0) {
    reportError(
      dataset.file,
      `contains duplicate entries: ${[...new Set(duplicateEntries)].join(", ")}`
    );
  }

  if (hasErrors === errorsBeforeDataset) {
    console.log(`PASS ${dataset.file}: ${entries.length} ${dataset.field}`);
  } else {
    console.log(`CHECKED ${dataset.file}: ${entries.length} ${dataset.field}`);
  }
}

if (hasErrors) {
  console.error("\nData validation failed.");
  process.exitCode = 1;
} else {
  console.log("\nAll Phase 0 data files are valid.");
}
