# Lokalny server pre hru: ako "python -m http.server", ale prehliadac si nepamata stare subory (vzdy najnovsia verzia).
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class BezCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

import os
PORT = int(os.environ.get('PORT', 8125))   # launch.json moze dat iny port, ked je 8125 obsadeny
print(f'Hra bezi na http://localhost:{PORT}')
ThreadingHTTPServer(('127.0.0.1', PORT), BezCache).serve_forever()
