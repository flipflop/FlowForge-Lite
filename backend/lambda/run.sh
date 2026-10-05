#!/bin/bash
# Lambda entrypoint: the Web Adapter layer (AWS_LAMBDA_EXEC_WRAPPER=/opt/bootstrap) proxies to this server.
exec python -m uvicorn main:app --host 0.0.0.0 --port "${PORT:-8080}"
