#!/usr/bin/env python3
"""Serve the source UI without caching while it is being edited."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


class PreviewHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        params = dict(parse_qsl(url.query))
        if url.path in ("/", "/index.html") and "base" not in params:
            params["base"] = "https://plugins.sokel.dev/"
            self.send_response(302)
            self.send_header("Location", urlunsplit(("", "", url.path, urlencode(params), "")))
            self.end_headers()
            return
        # Always read the current source, including edits within the same second.
        if "If-Modified-Since" in self.headers:
            del self.headers["If-Modified-Since"]
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5180)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parents[1] / "site"
    handler = partial(PreviewHandler, directory=str(directory))
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"http://127.0.0.1:{args.port}/?base=https://plugins.sokel.dev/&lang=zh", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
