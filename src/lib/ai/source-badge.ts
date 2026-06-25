export type CredentialSource = "oauth" | "key" | "mock";

export function sourceBadgeLabel(source: CredentialSource): string {
  switch (source) {
    case "oauth":
      return "OAuth";
    case "key":
      return "API key";
    case "mock":
      return "Demo";
  }
}

export function sourceBadgeVariant(
  source: CredentialSource
): "green" | "default" | "amber" {
  if (source === "oauth" || source === "key") return "green";
  return "default";
}

export function isLiveSource(source: CredentialSource): boolean {
  return source === "oauth" || source === "key";
}