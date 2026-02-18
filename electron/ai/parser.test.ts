import { describe, it, expect } from 'vitest';
import { parsePhase1Response, parsePhase2Response } from "./parser";

describe("parsePhase1Response", () => {
  it("should parse valid JSON response", () => {
    const validJson = JSON.stringify({
      message: "Test message",
      needsCanvasUpdate: true,
      updatePlan: "Update plan details"
    });

    const result = parsePhase1Response(validJson);

    expect(result).toEqual({
      message: "Test message",
      needsCanvasUpdate: true,
      updatePlan: "Update plan details"
    });
  });

  it("should handle valid JSON embedded in text", () => {
    const text = `Here is the response:
    {
      "message": "Embedded message",
      "needsCanvasUpdate": false
    }
    End of response.`;

    const result = parsePhase1Response(text);

    expect(result).toEqual({
      message: "Embedded message",
      needsCanvasUpdate: false,
      updatePlan: undefined
    });
  });

  it("should return default response for invalid JSON", () => {
    const invalidJson = "{ invalid json }";
    const result = parsePhase1Response(invalidJson);

    expect(result).toEqual({
      message: invalidJson,
      needsCanvasUpdate: false
    });
  });

  it("should return default response for non-JSON text", () => {
    const text = "Just plain text response";
    const result = parsePhase1Response(text);

    expect(result).toEqual({
      message: text,
      needsCanvasUpdate: false
    });
  });

  it("should return default response for schema mismatch (missing fields)", () => {
    const json = JSON.stringify({
      message: "Missing needsCanvasUpdate"
    });

    const result = parsePhase1Response(json);

    expect(result).toEqual({
      message: json,
      needsCanvasUpdate: false
    });
  });

  it("should return default response for schema mismatch (wrong types)", () => {
    const json = JSON.stringify({
      message: "Wrong type",
      needsCanvasUpdate: "not a boolean"
    });

    const result = parsePhase1Response(json);

    expect(result).toEqual({
      message: json,
      needsCanvasUpdate: false
    });
  });

  it("should handle empty string", () => {
    const result = parsePhase1Response("");

    expect(result).toEqual({
      message: "",
      needsCanvasUpdate: false
    });
  });
});

describe("parsePhase2Response", () => {
  it("should parse valid JSON correctly", () => {
    const input = JSON.stringify({
      message: "Hello world",
      canvasContent: "# Title\n\nContent"
    });

    const result = parsePhase2Response(input);

    expect(result).toEqual({
      message: "Hello world",
      canvasContent: "# Title\n\nContent"
    });
  });

  it("should parse JSON embedded in text", () => {
    const json = JSON.stringify({
      message: "Embedded",
      canvasContent: "Some content"
    });
    const input = `Here is the response: ${json} and some footer text.`;

    const result = parsePhase2Response(input);

    expect(result).toEqual({
      message: "Embedded",
      canvasContent: "Some content"
    });
  });

  it("should return null for invalid JSON structure", () => {
    const input = "{ invalid json }";
    const result = parsePhase2Response(input);
    expect(result).toBeNull();
  });

  it("should return null when required fields are missing", () => {
    const input = JSON.stringify({
      message: "Missing canvasContent"
    });

    const result = parsePhase2Response(input);

    expect(result).toBeNull();
  });

  it("should return null when field types are incorrect", () => {
    const input = JSON.stringify({
      message: 123, // Should be string
      canvasContent: "Content"
    });

    const result = parsePhase2Response(input);

    expect(result).toBeNull();
  });

  it("should return null for empty string", () => {
    const result = parsePhase2Response("");
    expect(result).toBeNull();
  });

  it("should return null for string without JSON braces", () => {
    const result = parsePhase2Response("Just some plain text without braces");
    expect(result).toBeNull();
  });

  it("should handle multiple JSON objects by taking the outermost braces (greedy match)", () => {
    // Current implementation uses greedy regex /\{[\s\S]*\}/
    // So if input is: { "a": 1 } text { "b": 2 }
    // It matches: { "a": 1 } text { "b": 2 }
    // Which is invalid JSON, so it should return null.

    const input = '{"message": "First", "canvasContent": "1"} filler {"message": "Second", "canvasContent": "2"}';

    const result = parsePhase2Response(input);

    // Expectation based on current implementation:
    // extractJSON returns null because JSON.parse fails on the concatenated string
    expect(result).toBeNull();
  });

  it("should handle nested objects correctly", () => {
    // Nested braces should be handled correctly by JSON.parse as long as the outer match is valid
    const input = JSON.stringify({
      message: "Nested",
      canvasContent: JSON.stringify({ key: "value" })
    });

    const result = parsePhase2Response(input);

    expect(result).toEqual({
      message: "Nested",
      canvasContent: JSON.stringify({ key: "value" })
    });
  });
});
