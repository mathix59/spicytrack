import * as BrowserSdk from "@sentry/browser";
import * as ReactSdk from "@sentry/react";

const parameters = new URLSearchParams(window.location.search);
const kind = parameters.get("sdk") === "react" ? "react" : "browser";
const sdk = kind === "react" ? ReactSdk : BrowserSdk;
const version = kind === "react" ? "sdk-react@10.69.0" : "sdk-browser@10.69.0";
const status = document.querySelector("#status");

async function sendProbe() {
  try {
    sdk.init({
      dsn: parameters.get("dsn"),
      environment: "sdk-matrix",
      release: version,
      sendDefaultPii: false,
    });
    sdk.captureException(new Error(`Real ${kind} SDK compatibility probe`));
    status.textContent = (await sdk.flush(10_000)) ? "sent" : "flush failed";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

void sendProbe();
