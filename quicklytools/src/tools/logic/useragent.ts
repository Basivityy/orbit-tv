/** Small, dependency-free User-Agent parser covering the browsers and systems that matter in practice. */

export interface ParsedUA {
  browser: string;
  browserVersion: string;
  engine: string;
  os: string;
  osVersion: string;
  device: "desktop" | "mobile" | "tablet" | "bot";
}

export function parseUserAgent(ua: string): ParsedUA {
  const r: ParsedUA = { browser: "Unknown", browserVersion: "", engine: "Unknown", os: "Unknown", osVersion: "", device: "desktop" };
  const m = (re: RegExp) => ua.match(re);
  let x: RegExpMatchArray | null;

  if (/bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit/i.test(ua)) r.device = "bot";
  else if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) r.device = "tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) r.device = "mobile";

  if ((x = m(/Edg(?:e|A|iOS)?\/([\d.]+)/))) [r.browser, r.browserVersion] = ["Microsoft Edge", x[1]];
  else if ((x = m(/OPR\/([\d.]+)/)) || (x = m(/Opera\/([\d.]+)/))) [r.browser, r.browserVersion] = ["Opera", x[1]];
  else if ((x = m(/SamsungBrowser\/([\d.]+)/))) [r.browser, r.browserVersion] = ["Samsung Internet", x[1]];
  else if ((x = m(/Vivaldi\/([\d.]+)/))) [r.browser, r.browserVersion] = ["Vivaldi", x[1]];
  else if ((x = m(/YaBrowser\/([\d.]+)/))) [r.browser, r.browserVersion] = ["Yandex Browser", x[1]];
  else if ((x = m(/(?:Firefox|FxiOS)\/([\d.]+)/))) [r.browser, r.browserVersion] = ["Firefox", x[1]];
  else if ((x = m(/CriOS\/([\d.]+)/))) [r.browser, r.browserVersion] = ["Chrome", x[1]];
  else if ((x = m(/Chrome\/([\d.]+)/)) && !/Chromium/.test(ua)) [r.browser, r.browserVersion] = ["Chrome", x[1]];
  else if ((x = m(/Chromium\/([\d.]+)/))) [r.browser, r.browserVersion] = ["Chromium", x[1]];
  else if ((x = m(/Version\/([\d.]+).*Safari/))) [r.browser, r.browserVersion] = ["Safari", x[1]];
  else if ((x = m(/(?:MSIE |Trident\/.*rv:)([\d.]+)/))) [r.browser, r.browserVersion] = ["Internet Explorer", x[1]];

  if (/Gecko\/\d/.test(ua) && /Firefox|FxiOS/.test(ua) && !/like Gecko/.test(ua)) r.engine = "Gecko";
  else if (/iPhone|iPad|iPod/.test(ua)) r.engine = "WebKit";
  else if (/Chrome|Chromium|Edg|OPR|SamsungBrowser/.test(ua)) r.engine = "Blink";
  else if (/AppleWebKit/.test(ua)) r.engine = "WebKit";
  else if (/Trident/.test(ua)) r.engine = "Trident";
  else if (/Gecko\//.test(ua)) r.engine = "Gecko";

  if ((x = m(/Windows NT ([\d.]+)/))) {
    const map: Record<string, string> = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7", "6.0": "Vista", "5.1": "XP" };
    [r.os, r.osVersion] = ["Windows", map[x[1]] ?? x[1]];
  } else if ((x = m(/(?:iPhone|CPU) OS ([\d_]+)/)) || (x = m(/iPad.*OS ([\d_]+)/))) [r.os, r.osVersion] = [/iPad/.test(ua) ? "iPadOS" : "iOS", x[1].replace(/_/g, ".")];
  else if ((x = m(/Mac OS X ([\d_.]+)/))) [r.os, r.osVersion] = ["macOS", x[1].replace(/_/g, ".")];
  else if ((x = m(/Android ([\d.]+)/))) [r.os, r.osVersion] = ["Android", x[1]];
  else if (/CrOS/.test(ua)) r.os = "ChromeOS";
  else if (/Linux/.test(ua)) r.os = "Linux";
  return r;
}
