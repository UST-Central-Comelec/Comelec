import { createConnection, type Socket } from "node:net";

/** Let Node try both address families when a network advertises unusable IPv6. */
export function getGmailSocket(
  _options: unknown,
  callback: (error: Error | null, result?: { connection: Socket }) => void,
) {
  const socket = createConnection({
    host: "smtp.gmail.com",
    port: 587,
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 250,
  });
  const timer = setTimeout(() => socket.destroy(new Error("SMTP connection timed out")), 15_000);
  const onError = (error: Error) => {
    clearTimeout(timer);
    callback(error);
  };
  socket.once("error", onError);
  socket.once("connect", () => {
    clearTimeout(timer);
    socket.removeListener("error", onError);
    // The transport requires STARTTLS before authenticating on port 587.
    callback(null, { connection: socket });
  });
}
