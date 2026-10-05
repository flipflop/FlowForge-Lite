import pytest
from fastapi.testclient import TestClient

import main
import providers


@pytest.fixture
def client():
    return TestClient(main.app)


def test_health_open_without_secret(client, monkeypatch):
    monkeypatch.delenv("ORIGIN_VERIFY_SECRET", raising=False)
    assert client.get("/health").json() == {"status": "ok"}


def test_origin_verify_rejects_missing_and_wrong(client, monkeypatch):
    monkeypatch.setenv("ORIGIN_VERIFY_SECRET", "s3cret")
    assert client.get("/health").status_code == 403
    assert client.get("/health", headers={"x-origin-verify": "nope"}).status_code == 403
    assert client.get("/health", headers={"x-origin-verify": "s3cret"}).status_code == 200


def test_origin_verify_applies_to_post(client, monkeypatch):
    monkeypatch.setenv("ORIGIN_VERIFY_SECRET", "s3cret")
    body = {"nodes": [], "edges": []}
    assert client.post("/pipelines/parse", json=body).status_code == 403
    r = client.post("/pipelines/parse", json=body, headers={"x-origin-verify": "s3cret"})
    assert r.status_code == 200


def test_client_ip_uses_peer_when_not_behind_proxy():
    h = {"cloudfront-viewer-address": "1.2.3.4:5555", "x-forwarded-for": "9.9.9.9"}
    assert main.client_ip(h, "10.0.0.1", False) == "10.0.0.1"
    assert main.client_ip({}, None, False) == "unknown"


def test_client_ip_prefers_cloudfront_viewer_address():
    assert main.client_ip({"cloudfront-viewer-address": "1.2.3.4:5555"}, "127.0.0.1", True) == "1.2.3.4"
    assert main.client_ip({"cloudfront-viewer-address": "[2001:db8::1]:443"}, "127.0.0.1", True) == "2001:db8::1"


def test_client_ip_falls_back_to_forwarded_for():
    h = {"x-forwarded-for": "5.6.7.8, 10.0.0.2"}
    assert main.client_ip(h, "127.0.0.1", True) == "5.6.7.8"
    assert main.client_ip({}, "127.0.0.1", True) == "127.0.0.1"


def test_run_stream_headers_disable_buffering(client, monkeypatch):
    monkeypatch.delenv("ORIGIN_VERIFY_SECRET", raising=False)
    r = client.post("/pipelines/run", json={"nodes": [], "edges": []})
    assert r.headers["cache-control"] == "no-cache"
    assert r.headers["x-accel-buffering"] == "no"
    assert r.headers["content-type"].startswith("text/event-stream")


def test_default_cors_is_not_wildcard(client):
    r = client.options(
        "/models",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert r.headers.get("access-control-allow-origin") != "*"
    ok = client.get("/models", headers={"Origin": "http://localhost:8080"})
    assert ok.headers["access-control-allow-origin"] == "http://localhost:8080"


def test_server_key_env_fallback(monkeypatch):
    monkeypatch.setattr(providers, "_ssm_cache", None)
    monkeypatch.delenv("SSM_PREFIX", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "envkey")
    assert providers.server_key("gemini") == "envkey"


def test_server_key_prefers_ssm_and_reads_once(monkeypatch):
    import sys, types

    calls = []

    class FakeSSM:
        def get_parameters(self, Names, WithDecryption):
            calls.append((tuple(Names), WithDecryption))
            return {"Parameters": [{"Name": "/ff/test/gemini-api-key", "Value": "ssmkey"}]}

    fake = types.SimpleNamespace(client=lambda svc: FakeSSM())
    monkeypatch.setitem(sys.modules, "boto3", fake)
    monkeypatch.setattr(providers, "_ssm_cache", None)
    monkeypatch.setenv("SSM_PREFIX", "/ff/test/")
    monkeypatch.setenv("GEMINI_API_KEY", "envkey")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert providers.server_key("gemini") == "ssmkey"
    assert providers.server_key("anthropic") is None
    assert len(calls) == 1 and calls[0][1] is True
    monkeypatch.setattr(providers, "_ssm_cache", None)


def test_ssm_failure_falls_back_to_env(monkeypatch):
    import sys, types

    def boom(svc):
        raise RuntimeError("no creds")

    monkeypatch.setitem(sys.modules, "boto3", types.SimpleNamespace(client=boom))
    monkeypatch.setattr(providers, "_ssm_cache", None)
    monkeypatch.setenv("SSM_PREFIX", "/ff/test")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "envkey")
    assert providers.server_key("anthropic") == "envkey"
    monkeypatch.setattr(providers, "_ssm_cache", None)
