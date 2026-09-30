// Local test-only binding adapter. No assertions or request handlers are changed.
"use strict";
const net = require("node:net");
const original = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  let callback = typeof args[args.length - 1] === "function" ? args.pop() : undefined;
  let options;
  if (typeof args[0] === "object" && args[0] !== null) {
    options = { ...args[0] };
    if ("path" in options || "fd" in options || "handle" in options)
      throw new Error("LOCAL_TEST_UNSUPPORTED_LISTENER");
  } else if (typeof args[0] === "number") {
    options = { port: args[0] };
    if (typeof args[1] === "string") options.host = args[1];
    const backlog = args.find((x, i) => i > 0 && typeof x === "number");
    if (backlog !== undefined) options.backlog = backlog;
  } else throw new Error("LOCAL_TEST_UNSUPPORTED_LISTENER");
  if (options.host && !["0.0.0.0", "::", "localhost", "127.0.0.1"].includes(options.host))
    throw new Error("LOCAL_TEST_NONLOCAL_LISTENER");
  options.host = "127.0.0.1";
  if (!options.port) options.port = 46197;
  if (Number(options.port) !== 46197) throw new Error("LOCAL_TEST_PORT_DENIED");
  // Supertest reads address() synchronously; use a pre-bound IPv4 handle.
  // Pinned Node 22 adapter only, never used for normal application startup.
  const handle = net._createServerHandle("127.0.0.1", 46197, 4);
  if (typeof handle === "number") throw new Error("LOCAL_TEST_BIND_FAILED");
  return callback ? original.call(this, handle, callback) : original.call(this, handle);
};
