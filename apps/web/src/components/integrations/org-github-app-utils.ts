function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function submitGithubManifest(action: string, state: string, manifest: string) {
  const form = document.createElement("form");
  form.action = `${action}?state=${encodeURIComponent(state)}`;
  form.method = "POST";

  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "manifest";
  input.value = manifest;
  form.append(input);
  document.body.append(form);
  form.submit();
}

export { asOptionalString, submitGithubManifest };
