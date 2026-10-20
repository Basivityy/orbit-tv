import { describe, expect, it } from "vitest";
import * as T from "@/tools/logic/text";

describe("counters", () => {
  it("counts words including contractions, hyphens and unicode", () => {
    expect(T.countWords("")).toBe(0);
    expect(T.countWords("Hello world")).toBe(2);
    expect(T.countWords("It's a well-known fact.")).toBe(4);
    expect(T.countWords("Здравствуй мир")).toBe(2);
    expect(T.countWords("   \n\t ")).toBe(0);
  });
  it("counts grapheme characters (emoji = 1)", () => {
    const c = T.countCharacters("a 👍🏽");
    expect(c.chars).toBe(3);
    expect(c.noSpaces).toBe(2);
    expect(c.bytes).toBe(1 + 1 + 8);
  });
  it("counts sentences ignoring abbreviations and decimals", () => {
    expect(T.countSentences("")).toBe(0);
    expect(T.countSentences("Hi there. How are you? Fine!")).toBe(3);
    expect(T.countSentences("Pi is 3.14. Dr. Smith agrees, e.g. today.")).toBe(2);
  });
  it("counts paragraphs and lines", () => {
    expect(T.countParagraphs("a\n\nb\n \nc")).toBe(3);
    expect(T.countLines("a\n\nb")).toEqual({ total: 3, nonEmpty: 2, empty: 1 });
    expect(T.countLines("")).toEqual({ total: 0, nonEmpty: 0, empty: 0 });
  });
  it("reading time and validation", () => {
    expect(T.readingTime("word ".repeat(238)).readingMinutes).toBeCloseTo(1);
    expect(() => T.readingTime("x", 0)).toThrow();
    expect(T.formatMinutes(1.5)).toBe("1 min 30 sec");
  });
  it("rejects oversized input", () => {
    expect(() => T.assertTextSize("x".repeat(T.MAX_TEXT_LENGTH + 1))).toThrow(/too large/);
  });
});

describe("case conversion", () => {
  it("title case keeps small words and acronyms", () => {
    expect(T.toTitleCase("a tale of two cities")).toBe("A Tale of Two Cities");
    expect(T.toTitleCase("how to use an iPhone with NASA data")).toBe("How to Use an iPhone With NASA Data");
    expect(T.toTitleCase("the end of the road", "all")).toBe("The End Of The Road");
  });
  it("sentence case", () => expect(T.toSentenceCase("HELLO WORLD. NEW SENTENCE")).toBe("Hello world. New sentence"));
  it("unicode upper/lower", () => {
    expect(T.toUpperCase("straße é")).toBe("STRASSE É");
    expect(T.toLowerCase("ÀB")).toBe("àb");
  });
});

describe("line operations", () => {
  it("removes duplicates preserving order", () => {
    expect(T.removeDuplicateLines("a\nb\nA\na").output).toBe("a\nb\nA");
    expect(T.removeDuplicateLines("a\nb\nA\na", { caseSensitive: false }).output).toBe("a\nb");
    expect(T.removeDuplicateLines("x\n\n\nx", { keepEmpty: true }).output).toBe("x\n\n");
  });
  it("removes empty lines", () => {
    expect(T.removeEmptyLines("a\n\n  \nb")).toEqual({ output: "a\nb", removed: 2 });
    expect(T.removeEmptyLines("a\n  \nb", false).output).toBe("a\n  \nb");
  });
  it("sorts in all modes", () => {
    expect(T.sortLines("b\na\nC", "az")).toBe("a\nb\nC");
    expect(T.sortLines("b\na\nC", "za")).toBe("C\nb\na");
    expect(T.sortLines("file10\nfile2", "natural")).toBe("file2\nfile10");
    expect(T.sortLines("10\n9\nx", "numeric")).toBe("9\n10\nx");
    expect(T.sortLines("ccc\na\nbb", "length")).toBe("a\nbb\nccc");
    expect(T.sortLines("1\n2\n3", "reverse")).toBe("3\n2\n1");
    const shuffled = T.sortLines("1\n2\n3\n4\n5", "shuffle").split("\n").sort();
    expect(shuffled).toEqual(["1", "2", "3", "4", "5"]);
  });
  it("reverses text safely", () => {
    expect(T.reverseText("ab👍🏽")).toBe("👍🏽ba");
    expect(T.reverseText("one two", "words")).toBe("two one");
    expect(T.reverseText("hello world", "each-word")).toBe("olleh dlrow");
    expect(T.reverseText("a\nb", "lines")).toBe("b\na");
  });
});

describe("find & replace", () => {
  it("plain, case-insensitive, whole word", () => {
    expect(T.findAndReplace("Cat cat category", "cat", "dog")).toEqual({ output: "dog dog dogegory", count: 3 });
    expect(T.findAndReplace("Cat cat category", "cat", "dog", { caseSensitive: true, wholeWord: true })).toEqual({ output: "Cat dog category", count: 1 });
    expect(T.findAndReplace("a.b", ".", "!").output).toBe("a!b");
  });
  it("regex with groups", () => {
    expect(T.findAndReplace("Smith, John", "(\\w+), (\\w+)", "$2 $1", { regex: true }).output).toBe("John Smith");
    expect(() => T.findAndReplace("x", "(", "", { regex: true })).toThrow(/Invalid regular expression/);
  });
});

describe("misc text", () => {
  it("removes extra spaces", () => expect(T.removeExtraSpaces("  a   b \n\n\n\n c\t\td ")).toBe("a b\n\nc d"));
  it("slugify", () => {
    expect(T.slugify("Héllo Wörld: 10 Tips & Tricks!")).toBe("hello-world-10-tips-and-tricks");
    expect(T.slugify("Ünïcödé Straße", { separator: "_" })).toBe("unicode_strasse");
    expect(T.slugify("one two three four", { maxLength: 9 })).toBe("one-two");
    expect(T.slugify("Don't stop")).toBe("dont-stop");
  });
  it("lorem ipsum respects counts", () => {
    expect(T.loremIpsum(5, "words").split(" ")).toHaveLength(5);
    expect(T.loremIpsum(3, "paragraphs").split("\n\n")).toHaveLength(3);
    expect(T.loremIpsum(1, "sentences").startsWith("Lorem ipsum")).toBe(true);
    expect(() => T.loremIpsum(0, "words")).toThrow();
  });
  it("repeat with limits", () => {
    expect(T.repeatText("ab", 3, "-")).toBe("ab-ab-ab");
    expect(() => T.repeatText("x", 0)).toThrow();
    expect(() => T.repeatText("xx", 1_500_000)).toThrow(/2,000,000/);
  });
  it("binary and hex round trips", () => {
    expect(T.textToBinary("Hi")).toBe("01001000 01101001");
    expect(T.binaryToText("01001000 01101001")).toBe("Hi");
    expect(T.binaryToText(T.textToBinary("Ünï 👋"))).toBe("Ünï 👋");
    expect(() => T.binaryToText("0101")).toThrow(/multiple of 8/);
    expect(() => T.binaryToText("0102")).toThrow();
    expect(T.textToHex("A", { prefix: true, uppercase: true })).toBe("0x41");
    expect(T.hexToText("48 65 6c 6c 6f")).toBe("Hello");
    expect(T.hexToText("0x48:0x69")).toBe("Hi");
    expect(() => T.hexToText("abc")).toThrow(/even/);
    expect(() => T.hexToText("ff fe")).toThrow(/UTF-8/);
  });
});
