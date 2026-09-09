import {
  invitationEmail,
  passwordResetEmail,
  verificationEmail,
  renderEmail,
} from "./email-template";

describe("transactional email templates", () => {
  const url = "https://spicytrack.example.test/accept-invitation?token=abc&mode=register";
  it.each([
    [
      "invitation",
      () => invitationEmail(url, 'Team <script>alert(1)</script> & "Friends"', "member"),
    ],
    ["password reset", () => passwordResetEmail(url)],
    ["verification", () => verificationEmail(url)],
  ])("preserves the action link in HTML and plain text for %s", (_, create) => {
    const email = create();
    expect(email.text).toContain(url);
    expect(
      email.html.match(
        /href="https:\/\/spicytrack.example.test\/accept-invitation\?token=abc&amp;mode=register"/g,
      ),
    ).toHaveLength(2);
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).not.toContain("<script>");
  });
  it("escapes organization names and keeps them readable in plain text", () => {
    const email = invitationEmail(url, '<img src=x onerror="alert(1)">', "owner");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(email.html).not.toContain("<img src=x");
    expect(email.text).toContain('<img src=x onerror="alert(1)">');
  });
  it("rejects executable action URLs", () => {
    expect(() => passwordResetEmail("javascript:alert(1)")).toThrow("HTTP or HTTPS");
  });
  it("escapes alert content without changing the plain-text message", () => {
    const email = renderEmail({
      subject: "Alert",
      eyebrow: "Issue",
      title: "<error>",
      paragraphs: ["one\ntwo & three"],
    });
    expect(email.html).toContain("&lt;error&gt;");
    expect(email.text).toContain("one\ntwo & three");
  });
});
