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


## Pull Any Open-Source Model

Once your Ollama server is running, you can pull from the ui itself and start using various open-source language models.


### Popular Models

| Model Name     | Tag                  | Size   |
| -------------- | -------------------- | ------ |
| DeepSeek-R1    | `deepseek-r1:1.5b`   | 1.1 GB |
| Qwen 2.5 Coder | `qwen2.5-coder:0.5b` | 398 MB |
| Qwen 2.5 Coder | `qwen2.5-coder:1.5b` | 986 MB |
| Gemma 3        | `gemma3:1b`          | 815 MB |
| Gemma 3n (e2b) | `gemma3n:e2b`        | 5.6 GB |

> After pulling a model, you can immediately start chatting with it through the Knot UI.


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
