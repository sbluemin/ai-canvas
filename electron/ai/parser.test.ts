import { describe, expect, test } from "bun:test";
import { parsePhase1Response } from "./parser";

describe("parsePhase1Response", () => {
  test("should parse valid JSON response", () => {
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

  test("should handle valid JSON embedded in text", () => {
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

  test("should return default response for invalid JSON", () => {
    const invalidJson = "{ invalid json }";
    const result = parsePhase1Response(invalidJson);

    expect(result).toEqual({
      message: invalidJson,
      needsCanvasUpdate: false
    });
  });

  test("should return default response for non-JSON text", () => {
    const text = "Just plain text response";
    const result = parsePhase1Response(text);

    expect(result).toEqual({
      message: text,
      needsCanvasUpdate: false
    });
  });

  test("should return default response for schema mismatch (missing fields)", () => {
    const json = JSON.stringify({
      message: "Missing needsCanvasUpdate"
    });

    const result = parsePhase1Response(json);

    expect(result).toEqual({
      message: json,
      needsCanvasUpdate: false
    });
  });

  test("should return default response for schema mismatch (wrong types)", () => {
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

  test("should handle empty string", () => {
    const result = parsePhase1Response("");

    expect(result).toEqual({
      message: "",
      needsCanvasUpdate: false
    });
  });
});
