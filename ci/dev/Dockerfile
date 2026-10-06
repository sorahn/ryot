FROM docker.io/library/rust:1.93.1-trixie
RUN apt-get update && apt-get install -y --no-install-recommends clang cmake patch python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
CMD ["python3", "ci/dev/watch-backend.py"]
