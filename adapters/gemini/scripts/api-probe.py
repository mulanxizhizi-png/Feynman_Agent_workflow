"""One-off Gemini API probe. Credentials enter only via stdin, never persisted."""
import base64
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request


def proxy_opener(proxy):
    # An empty URL is not a valid proxy. An empty mapping explicitly disables
    # both configured proxies and inherited HTTP(S)_PROXY for direct mode.
    proxies = {"http": proxy, "https": proxy} if proxy else {}
    return urllib.request.build_opener(urllib.request.ProxyHandler(proxies))


def main():
    config = json.loads(sys.stdin.readline())
    key = config.pop("key")
    proxy = config.get("proxy", "http://127.0.0.1:7897")
    opener = proxy_opener(proxy)
    action = config.get("action", "models")
    endpoint = "https://generativelanguage.googleapis.com/v1beta/"
    body = None
    if action == "models":
        endpoint += "models"
    else:
        endpoint += "interactions"
        user_input = config.get("prompt", "请只回复 GEMINI_CONNECTION_OK")
        if config.get("image"):
            data = pathlib.Path(config["image"]).read_bytes()
            user_input = [
                {"type": "text", "text": user_input},
                {"type": "image", "mime_type": "image/png", "data": base64.b64encode(data).decode("ascii")},
            ]
        if config.get("images"):
            user_input = [{"type": "text", "text": user_input}]
            for image in config["images"]:
                file = pathlib.Path(image["path"])
                mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}[file.suffix.lower()]
                user_input.extend([
                    {"type": "text", "text": "附件文件名：" + image["name"]},
                    {"type": "image", "mime_type": mime, "data": base64.b64encode(file.read_bytes()).decode("ascii")},
                ])
        payload = {"model": config.get("model", "gemini-3.8-flash"), "input": user_input, "store": False}
        if config.get("json_output"):
            payload["response_format"] = {"type": "text", "mime_type": "application/json"}
        body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(endpoint, data=body, headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    started = time.monotonic()
    def diagnostics(headers, status):
        return {"http_status": status, "elapsed_seconds": round(time.monotonic() - started, 2), "request_bytes": len(body or b""), "headers": {name: headers[name] for name in ["Server", "Date", "Content-Type", "Retry-After"] if name in headers}}
    try:
        with opener.open(request, timeout=60) as response:
            result = json.load(response)
            if action == "models":
                result = {"status": "ok", "models": [{"name": m["name"], "methods": m.get("supportedGenerationMethods", [])} for m in result.get("models", [])], "more": bool(result.get("nextPageToken"))}
            else:
                texts = [item.get("text", "") for step in result.get("steps", []) if step.get("type") == "model_output" for item in step.get("content", []) if item.get("type") == "text"]
                result = {"status": result.get("status"), "model": result.get("model"), "text": "\n".join(texts), "total_tokens": result.get("usage", {}).get("total_tokens")}
            if config.get("diagnostics"):
                result["diagnostics"] = diagnostics(response.headers, response.status)
            print(json.dumps(result, ensure_ascii=False).replace(key, "[REDACTED]"))
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8", errors="replace").replace(key, "[REDACTED]")
        result = {"http_status": error.code, "body": message}
        if config.get("diagnostics"):
            result["diagnostics"] = diagnostics(error.headers, error.code)
        print(json.dumps(result, ensure_ascii=False).replace(key, "[REDACTED]"))
        sys.exit(1)
    except Exception as error:
        print(json.dumps({"error": str(error).replace(key, "[REDACTED]")}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
