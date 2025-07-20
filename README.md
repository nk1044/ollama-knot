# ollama-knot

A minimal, Docker-based web UI to interact with Ollama models.
This project includes a pre-configured setup using the official `ollama` backend and the `knot` frontend, running seamlessly together.

---

## Quick Setup

### 1. Create `docker-compose.yml`

Create a file named `docker-compose.yml` in your project directory and paste the following content:

```yaml
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ./ollama_models:/root/.ollama
    restart: unless-stopped
    environment:
      - OLLAMA_HOST=0.0.0.0

  knot:
    image: neerajkumar1044/knot:latest
    container_name: knot
    ports:
      - "3001:3001"
    depends_on:
      - ollama
    restart: unless-stopped
```

### 2. Start the Services

```bash
docker-compose up -d
```

Then open your browser and navigate to: [knot](http://localhost:3001)

```
http://localhost:3001
```

---

## About the Project

This setup combines:

* **[ollama](https://ollama.com/)**: a local LLM server for running and interacting with large language models.
* **[knot](https://hub.docker.com/r/neerajkumar1044/knot)**: a simple web interface for chatting with Ollama.

The services are containerized and isolated, requiring no manual configuration. All you need is Docker and `docker-compose`.

---

## Directory Structure

```
.
├── docker-compose.yml
├── ollama_models/         # Models pulled by Ollama are stored here (auto-created)
```

---

## Stopping and Removing

To stop and remove the containers:

```bash
docker-compose down
```

To view logs in real time:

```bash
docker-compose logs -f
```
