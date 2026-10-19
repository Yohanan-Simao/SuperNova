from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        Path(r'C:\Users\Usuario\Documents\Projetos\SuperNova\dist\index-recovered.html').write_bytes(self.rfile.read(length))
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self, format, *args): pass
HTTPServer(('127.0.0.1', 4174), Handler).handle_request()
