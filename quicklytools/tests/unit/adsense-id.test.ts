import { expect, test } from "vitest";
import { adsSchema } from "@/lib/settings-schema";
const pid = (v: string) => adsSchema.shape.publisherId.safeParse(v);
test("publisher id", () => {
  expect(pid("pub-1234567890123456").data).toBe("ca-pub-1234567890123456");
  expect(pid(" ca-pub-1234567890123456 ").data).toBe("ca-pub-1234567890123456");
  expect(pid("CA-PUB-1234567890123456").data).toBe("ca-pub-1234567890123456");
  expect(pid("").data).toBe("");
  expect(pid("1234567890123456").success).toBe(false);
});
