"""Mock OpenAI-compatible chat endpoint for end-to-end UI verification."""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 9999


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8", "replace")
        with open("mock_requests.log", "a", encoding="utf-8") as f:
            f.write(f"{self.path}\n{raw[:800]}\n---\n")

        content = json.dumps(
            {
                "expenses": [
                    {"amount": 12, "category": "餐饮", "note": "早饭", "date": "2026-11-09"},
                    {"amount": 25, "category": "交通", "note": "打车", "date": "2026-11-09"},
                    {"amount": 180, "category": "餐饮", "note": "请同事吃饭", "date": "2026-11-09"},
                    {"amount": 18, "category": "餐饮", "note": "下午咖啡", "date": "2026-11-09"},
                ]
            },
            ensure_ascii=False,
        )
        body = json.dumps(
            {"choices": [{"message": {"role": "assistant", "content": content}}]},
            ensure_ascii=False,
        ).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
