const secretPatterns = [
  /postgres(?:ql)?:\/\/[^@\s]+@/gi,
  /redis:\/\/[^@\s]+@/gi,
  /(?:token|secret|password|authorization|cookie)=([^&\s]+)/gi,
];

function safeMessage(error: unknown): string {
  let message = error instanceof Error ? error.message : "unknown";
  for (const pattern of secretPatterns)
    message = message.replace(pattern, "[REDACTED]");
  return message.slice(0, 500);
}

export function logError(event: string, error: unknown): void {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      message: safeMessage(error),
      timestamp: new Date().toISOString(),
    }),
  );
}
