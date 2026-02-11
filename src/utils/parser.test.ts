
import { describe, test, expect } from "bun:test";
import { extractJSON } from "./parser";

describe("extractJSON", () => {
  test("should extract JSON from a markdown code block", () => {
    const input = `Here is the JSON:
\`\`\`json
{
  "key": "value"
}
\`\`\`
`;
    const result = extractJSON(input);
    expect(result).toBe(`{
  "key": "value"
}`);
  });

  test("should extract JSON from a markdown code block without language identifier", () => {
    const input = `
\`\`\`
{
  "key": "value"
}
\`\`\`
`;
    const result = extractJSON(input);
    expect(result).toBe(`{
  "key": "value"
}`);
  });

  test("should extract JSON without markdown code blocks if valid JSON structure is present", () => {
    const input = "Some text before { \"key\": \"value\" } and after.";
    const result = extractJSON(input);
    expect(result).toBe("{ \"key\": \"value\" }");
  });

  test("should return null for empty string", () => {
    expect(extractJSON("")).toBeNull();
  });

  test("should return null if no JSON-like structure is found", () => {
    expect(extractJSON("Just some text without braces.")).toBeNull();
  });

  test("should handle nested objects correctly", () => {
    const input = "Root object: { \"a\": { \"b\": 1 } } end.";
    const result = extractJSON(input);
    expect(result).toBe("{ \"a\": { \"b\": 1 } }");
  });

  test("should handle braces inside strings correctly", () => {
    const input = "JSON with string brace: { \"key\": \"}\" } end.";
    const result = extractJSON(input);
    expect(result).toBe("{ \"key\": \"}\" }");
  });

  test("should handle escaped quotes inside strings correctly", () => {
    const input = "JSON with escaped quote: { \"key\": \"a \\\"quote\\\"\" } end.";
    const result = extractJSON(input);
    expect(result).toBe("{ \"key\": \"a \\\"quote\\\"\" }");
  });

  test("should handle multiple code blocks by taking the first one", () => {
    const input = `
First block:
\`\`\`json
{"first": 1}
\`\`\`

Second block:
\`\`\`json
{"second": 2}
\`\`\`
`;
    const result = extractJSON(input);
    expect(result).toBe("{\"first\": 1}");
  });

  test("should handle incomplete JSON structure gracefully (return what it can parse or null)", () => {
    // parser implementation details: it looks for balanced braces
    const input = "Incomplete: { \"a\": 1";
    expect(extractJSON(input)).toBeNull();
  });

  test("should handle extra whitespace around JSON in code block", () => {
      const input = `
\`\`\`json
   { "a": 1 }
\`\`\`
`;
      const result = extractJSON(input);
      expect(result).toBe("{ \"a\": 1 }");
  });

  test("should extract JSON even if code block has non-json language but contains JSON", () => {
      // The regex matches \`\`\`(?:json)? which allows \"json\" or nothing.
      // If language is \"javascript\", regex won\"t match as code block.
      // So it falls back to full text search.
      const input = `
\`\`\`javascript
const obj = { "a": 1 };
\`\`\`
`;
      // It should extract { "a": 1 } from the full text
      const result = extractJSON(input);
      expect(result).toBe("{ \"a\": 1 }");
  });

    test("should extract JSON from code block with different casing for language", () => {
      const input = `
\`\`\`JSON
{ "a": 1 }
\`\`\`
`;
      const result = extractJSON(input);
      expect(result).toBe("{ \"a\": 1 }");
  });
});
