import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { writeFile, unlink, utimes } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createGameServer } from "../server.mjs";

test("compressed public text preserves exact bytes, HTTP negotiation and build revalidation", async t => {
  const name = `cache-test-${process.pid}.mjs`, file = new URL(`../public/${name}`, import.meta.url);
  const first = '// original module\n' + 'export const value = 1;\n'.repeat(90);
  await writeFile(file, first);
  const app = createGameServer(), address = await app.listen(0, "127.0.0.1");
  t.after(async () => { app.server.closeAllConnections(); await app.close(); await unlink(file); });
  const request = (headers, method = "GET") => new Promise((resolve, reject) => {
    const req = http.request({ host:"127.0.0.1", port:address.port, path:`/rebirth/${name}`, method, headers, agent:false }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({status:res.statusCode, headers:res.headers, body:Buffer.concat(chunks)}));
    });
    req.on("error", reject); req.end();
  });
  const compressed = await request({"Accept-Encoding":"gzip"});
  assert.equal(compressed.status,200);
  assert.equal(compressed.headers["content-encoding"],"gzip");
  assert.equal(compressed.headers.vary,"Accept-Encoding");
  assert.equal(gunzipSync(compressed.body).toString(),first);
  assert(compressed.body.length < Buffer.byteLength(first) / 2);
  assert.equal(Number(compressed.headers["content-length"]),compressed.body.length);
  const identity = await request({"Accept-Encoding":"gzip;q=0, *;q=1"});
  assert.equal(identity.headers["content-encoding"],undefined);
  assert.equal(identity.body.toString(),first);
  const head = await request({"Accept-Encoding":"gzip"},"HEAD");
  assert.equal(head.body.length,0);
  assert.equal(head.headers["content-length"],compressed.headers["content-length"]);
  const cached = await request({"Accept-Encoding":"gzip","If-None-Match":compressed.headers.etag});
  assert.equal(cached.status,304); assert.equal(cached.body.length,0);
  const second = first.replaceAll('value = 1','value = 2');
  await writeFile(file,second);
  const newer = new Date(Date.now()+2000); await utimes(file,newer,newer);
  const revised = await request({"Accept-Encoding":"gzip","If-None-Match":compressed.headers.etag});
  assert.equal(revised.status,200); assert.notEqual(revised.headers.etag,compressed.headers.etag);
  assert.equal(gunzipSync(revised.body).toString(),second);
});
