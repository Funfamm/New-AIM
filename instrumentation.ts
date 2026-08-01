// Next.js instrumentation — global server-side error capture.
// onRequestError fires for every uncaught error in Server Components, Route
// Handlers, and Server Actions, feeding them into the in-house error monitor.
// Runs only in the Node runtime (Prisma is unavailable on the Edge).

export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routeType?: string }
): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;
  try {
    const { captureError } = await import("@/lib/monitoring/capture-error");
    const SOURCE: Record<string, "SERVER" | "API" | "ACTION"> = {
      render: "SERVER",
      route:  "API",
      action: "ACTION",
    };
    captureError(error, {
      level:  "ERROR",
      source: SOURCE[context?.routeType ?? "render"] ?? "SERVER",
      route:  request?.path,
      method: request?.method,
    });
  } catch {
    // instrumentation must never throw
  }
}
