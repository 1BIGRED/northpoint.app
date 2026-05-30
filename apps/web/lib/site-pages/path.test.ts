import { describe, expect, it } from "vitest";

import {
  HOME_PATH,
  normalizePagePath,
  pageLabel,
  pathFromSlug,
  slugFromPath,
  sortPagePaths,
} from "./path";

describe("normalizePagePath", () => {
  it("slugifies words and spaces", () => {
    expect(normalizePagePath("About Us")).toBe("/about-us");
    expect(normalizePagePath("Our Work!")).toBe("/our-work");
  });
  it("strips slashes and collapses separators", () => {
    expect(normalizePagePath("/contact/")).toBe("/contact");
    expect(normalizePagePath("a -- b")).toBe("/a-b");
    expect(normalizePagePath("  spaced  ")).toBe("/spaced");
  });
  it("lowercases", () => {
    expect(normalizePagePath("CONTACT")).toBe("/contact");
  });
  it("returns null for input with no usable characters", () => {
    expect(normalizePagePath("")).toBeNull();
    expect(normalizePagePath("   ")).toBeNull();
    expect(normalizePagePath("///")).toBeNull();
    expect(normalizePagePath("!!!")).toBeNull();
  });
});

describe("pathFromSlug / slugFromPath round-trip", () => {
  it("maps a slug segment to a path and back", () => {
    expect(pathFromSlug("about")).toBe("/about");
    expect(slugFromPath("/about")).toBe("about");
  });
  it("treats missing/empty slug as home", () => {
    expect(pathFromSlug(undefined)).toBe(HOME_PATH);
    expect(pathFromSlug("")).toBe(HOME_PATH);
    expect(slugFromPath(HOME_PATH)).toBe("");
  });
});

describe("pageLabel", () => {
  it("labels home and other pages readably", () => {
    expect(pageLabel("/")).toBe("Home");
    expect(pageLabel("/about-us")).toBe("About us");
    expect(pageLabel("/contact")).toBe("Contact");
  });
});

describe("sortPagePaths", () => {
  it("puts home first, then alphabetical", () => {
    expect(sortPagePaths(["/contact", "/", "/about"])).toEqual([
      "/",
      "/about",
      "/contact",
    ]);
  });
  it("does not mutate the input", () => {
    const input = ["/b", "/", "/a"];
    sortPagePaths(input);
    expect(input).toEqual(["/b", "/", "/a"]);
  });
});
