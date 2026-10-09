# Local dev server that behaves like GitHub Pages: /work serves work.html, unknown paths get 404.html,
# and nothing is cached by the browser. Run from the repo root: python3 mocks/serve.py [port]
import http.server
import os
import sys


class Pages(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def translate_path(self, path):
        local = super().translate_path(path)
        if not os.path.exists(local) and os.path.exists(local + ".html"):
            return local + ".html"
        return local

    def send_error(self, code, message=None, explain=None):
        page = os.path.join(os.getcwd(), "404.html")
        if code != 404 or not os.path.exists(page):
            return super().send_error(code, message, explain)
        body = open(page, "rb").read()
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


port = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
http.server.ThreadingHTTPServer(("127.0.0.1", port), Pages).serve_forever()
