"""Offline regression checks for empty-proxy direct transport."""
import importlib.util
import os
import pathlib
import threading
import unittest
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('api_probe', pathlib.Path(__file__).with_name('api-probe.py'))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class ProxyTests(unittest.TestCase):
    def test_explicit_proxy_is_kept_for_both_protocols(self):
        opener = probe.proxy_opener('http://127.0.0.1:7897')
        handler = next(h for h in opener.handlers if isinstance(h, urllib.request.ProxyHandler))
        self.assertEqual(handler.proxies, {'http': 'http://127.0.0.1:7897', 'https': 'http://127.0.0.1:7897'})

    def test_empty_proxy_reaches_local_server_despite_invalid_environment_proxy(self):
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'DIRECT_CONNECTION_OK')

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with patch.dict(os.environ, {'http_proxy': 'http://127.0.0.1:1',
                                         'https_proxy': 'http://127.0.0.1:1', 'no_proxy': ''}):
                opener = probe.proxy_opener('')
                with opener.open('http://127.0.0.1:' + str(server.server_port), timeout=3) as response:
                    self.assertEqual(response.read(), b'DIRECT_CONNECTION_OK')
                self.assertFalse(any(isinstance(h, urllib.request.ProxyHandler) and h.proxies for h in opener.handlers))
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)


if __name__ == '__main__':
    unittest.main()
