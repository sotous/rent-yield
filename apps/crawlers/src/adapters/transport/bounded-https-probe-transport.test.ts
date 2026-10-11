import { describe, expect, it } from "vitest";
import {
  classifyBoundedDiscoveryPage,
  classifyBoundedDiscoveryResponse,
} from "./bounded-https-probe-transport.js";

describe("bounded HTTPS discovery page classification", () => {
  it.each([
    [
      "CAPTCHA challenge",
      '<html><div class="g-recaptcha">Verify you are human</div></html>',
      "challenge",
    ],
    [
      "password login page",
      '<html><form action="/login"><input type="password" /></form></html>',
      "authentication_required",
    ],
  ] as const)("classifies a 200 %s before capture", (_case, body, expected) => {
    expect(
      classifyBoundedDiscoveryPage({
        content_type: "text/html",
        body: new TextEncoder().encode(body),
      }),
    ).toBe(expected);
  });

  it("leaves an ordinary HTML listing page eligible for capture", () => {
    expect(
      classifyBoundedDiscoveryPage({
        content_type: "text/html",
        body: new TextEncoder().encode(
          "<html><h1>Apartamento en arriendo</h1></html>",
        ),
      }),
    ).toBe("listing_discovery");
  });

  it("marks only the robots endpoint as policy input", () => {
    expect(
      classifyBoundedDiscoveryResponse({
        pathname: "/robots.txt",
        content_type: "text/plain",
        body: new TextEncoder().encode("User-agent: *\nDisallow:"),
      }),
    ).toBe("robots_policy");
  });
});
