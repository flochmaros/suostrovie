# Lokalny server pre hru: ako "python -m http.server", ale prehliadac si nepamata stare subory (vzdy najnovsia verzia).
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class BezCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

print('Hra bezi na http://localhost:8125')
ThreadingHTTPServer(('127.0.0.1', 8125), BezCache).serve_forever()
