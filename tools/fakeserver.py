"""Serveur d'essai : sert le site et joue le rôle de la base temps réel (relais d'écritures + déconnexions)."""
import json, os, queue, sys, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8790
LOG = sys.argv[3] if len(sys.argv) > 3 else None
lock = threading.Lock()
tree = {}
clients = {}   # cid -> Queue
ondisc = {}    # cid -> [paths]
writes = []    # journal des écritures (pour vérifier ce qui passe par le réseau)

def parts(p): return [k for k in str(p or '').split('/') if k]
def prune(n):
    if not isinstance(n, dict): return n
    for k in list(n):
        c = prune(n[k])
        if c is None or (isinstance(c, dict) and not c): del n[k]
    return n
def set_at(p, v):
    global tree
    ks = parts(p)
    if not ks: tree = v or {}; return
    n = tree
    for k in ks[:-1]:
        if not isinstance(n.get(k), dict): n[k] = {}
        n = n[k]
    if v is None: n.pop(ks[-1], None)
    else: n[ks[-1]] = v
    prune(tree)
def broadcast(msg):
    data = json.dumps(msg)
    for q in list(clients.values()): q.put(data)
def do_set(p, v, frm):
    with lock:
        set_at(p, v)
        writes.append({'path': p, 'size': len(json.dumps(v)), 'from': frm})
        broadcast({'path': p, 'v': v, 'from': frm})

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def body(self):
        n = int(self.headers.get('content-length') or 0)
        return json.loads(self.rfile.read(n) or b'null')
    def ok(self, obj=None):
        b = json.dumps(obj if obj is not None else {'ok': True}).encode()
        self.send_response(200); self.send_header('content-type', 'application/json'); self.send_header('content-length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path == '/fb/tree':
            with lock: return self.ok(tree)
        if u.path == '/fb/writes':
            with lock: return self.ok(writes)
        if u.path == '/fb/events':
            cid = q.get('cid', [''])[0]
            qu = queue.Queue(); clients[cid] = qu
            self.send_response(200); self.send_header('content-type', 'text/event-stream'); self.end_headers()
            try:
                self.wfile.write(b': hi\n\n'); self.wfile.flush()
                while True:
                    try: d = qu.get(timeout=1.0); self.wfile.write(('data: ' + d + '\n\n').encode())
                    except queue.Empty: self.wfile.write(b': ka\n\n')
                    self.wfile.flush()
            except Exception:
                pass
            finally:
                clients.pop(cid, None)
                for p in ondisc.pop(cid, []): do_set(p, None, 'server')
            return
        return super().do_GET()
    def do_POST(self):
        u = urlparse(self.path); q = parse_qs(u.query); cid = q.get('cid', [''])[0]
        if u.path == '/fb/op':
            m = self.body(); do_set(m['path'], m['v'], cid); return self.ok()
        if u.path == '/fb/ondisc':
            m = self.body(); ondisc.setdefault(cid, []).append(m['path']); return self.ok()
        self.send_error(404)

ThreadingHTTPServer.daemon_threads = True
ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
