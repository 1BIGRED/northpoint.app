import { describe, expect, it } from "vitest";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  validateImageFile,
} from "./upload-image";

// Pure validation only — no browser/network. The upload() call itself is
// exercised once the storage bucket exists (E4).

describe("validateImageFile", () => {
  it("accepts allowed raster types within the size limit", () => {
    for (const type of ALLOWED_IMAGE_TYPES) {
      expect(validateImageFile({ type, size: 1024 })).toBeNull();
    }
  });

  it("rejects SVG (excluded for a public inline-served bucket)", () => {
    expect(validateImageFile({ type: "image/svg+xml", size: 1024 })).toMatch(
      /supported/i,
    );
  });

  it("rejects non-image types", () => {
    expect(validateImageFile({ type: "application/pdf", size: 1024 })).toMatch(
      /supported/i,
    );
  });

  it("rejects files over the 5 MB limit", () => {
    expect(
      validateImageFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 }),
    ).toMatch(/too large/i);
    expect(
      validateImageFile({ type: "image/png", size: MAX_IMAGE_BYTES }),
    ).toBeNull();
  });
});
