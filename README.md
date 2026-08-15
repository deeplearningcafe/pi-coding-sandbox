[[Japanese](README.jp.md)/English]

# Local Pi Coding Agent Sandbox

A fully self-hosted, secure, and privacy-focused development sandbox for running the [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent) powered by local LLMs (llama.cpp) and self-hosted web research tools.

A detail explanation is published here [ローカルLLMで「Pi」エージェントを動かす](https://zenn.dev/fuwamoekissaten/articles/bb5f5364838ced)

## Key Features

- **100% Local & Free**: Powered by `llama-server` and open-weights models (e.g., Qwen 3.6-35B-MoE) with zero API subscription fees.
- **Hardened Sandbox**:
  - Isolated non-root execution (`UID: 5000`).
  - Read-only root filesystem (`read_only: true`) with memory-backed `tmpfs`.
  - Kernel privileges stripped (`cap_drop: ALL`, `no-new-privileges: true`).
  - File permissions orchestrated via Linux POSIX ACLs.
- **Local Web Research Engine**: Integrated with self-hosted **SearXNG** (JSON meta-search) and **Crawl4AI** (HTML-to-Markdown scraper) for web search without leaking queries to external search engines.

---

## Directory Structure

```text
pi-sandbox/
├── docker-compose.yml          # Pi agent sandbox container definition
├── pi.Dockerfile               # Hardened Node.js/Python sandbox environment
├── project/                    # Target workspace mounted to agent container
└── pi_home/                    # Agent configurations & persistent runtime
    └── agent/
        ├── models.json         # LLM endpoints (llama-server configuration)
        ├── Agents.md           # Custom agent system prompt / instructions
        ├── scripts/
        │   └── search_crawl.py # Helper script for SearXNG & Crawl4AI
        └── skills/
            └── web-research.md # Skill definition for web search & crawling
```

---

## Prerequisites

- **Host OS**: Linux (Ubuntu, Pop_OS, Debian, etc.)
- **Container Engine**: Docker & Docker Compose
- **Local LLM Engine**: [llama.cpp](https://github.com/ggml-org/llama.cpp).
- **Recommended Model**: `unsloth/Qwen3.6-35B-A3B-GGUF` (Q4_K_M or Q4_K_XL)

---

## Step-by-Step Setup

### 1. Start Local LLM Inference Engine (`llama.cpp`)

Build `llama.cpp` and launch the OpenAI-compatible server on port `8001`:

```bash
./build/bin/llama-server \
  -m models/Qwen3.6-35b-a3b-ud-q4_k_xl.gguf \
  --port 8001 \
  --host 0.0.0.0 \
  -c 131072 \
  --fit on \
  -ctk q8_0 -ctv q8_0 \
  -np 1 \
  -ot "exps=cpu" \
  --no-mmap \
  --threads 8 \
  --cpu-range 0-7 \
  --cpu-strict 1 \
  --prio 2 \
  --temp 0.6 \
  --top-p 0.95 \
  --top-k 20 \
  --min-p 0.00 \
  --repeat-penalty 1.00 \
  --presence-penalty 0.00 \
  --chat-template-kwargs '{"preserve_thinking": true}' \
  --fit-target 512 \
  --alias "qwen3.6-35b-a3b"
```

### 2. Configure Host Permissions (POSIX ACL)

Ensure the host user (`UID: 1000`) and the container agent (`UID: 5000`) can safely read/write workspace files:

```bash
mkdir -p project pi_home/agent/scripts pi_home/agent/skills

# Assign ownership to container user (5000)
sudo chown -R 5000:5000 project pi_home

# Grant read/write/execute permissions to host user (1000)
sudo setfacl -R -m u:1000:rwx project pi_home
sudo setfacl -R -d -m u:1000:rwx project pi_home
```

### 3. Launch Local Search & Scraping Engines

#### SearXNG
Create `searxng/settings.yml` enabling JSON output format:
```yaml
use_default_settings: true
server:
  port: 8080
  bind_address: "0.0.0.0"
  secret_key: "GENERATE_RANDOM_HEX_KEY"
  limiter: false
search:
  formats:
    - html
    - json
```
Run SearXNG:
```bash
docker run -d \
  --name searxng \
  -p 8080:8080 \
  -v $(pwd)/searxng:/etc/searxng:rw \
  -e SEARXNG_BASE_URL=http://localhost:8080/ \
  searxng/searxng:latest
```

#### Crawl4AI
```bash
docker run -d \
  --name crawl4ai_server \
  -p 11235:11235 \
  -e CRAWL4AI_API_TOKEN="sk-crawl4ai-token" \
  unclecode/crawl4ai:latest
```

### 4. Configure Agent Settings

#### `pi_home/agent/models.json`
```json
{
  "providers": {
    "local-server": {
      "baseUrl": "http://host.docker.internal:8001/v1",
      "api": "openai-chat",
      "apiKey": "none",
      "models": [
        { "id": "qwen3.6-35b" }
      ]
    }
  },
  "defaultModel": "qwen3.6-35b"
}
```

#### `pi_home/agent/scripts/search_crawl.py`
Make the script executable (`chmod +x pi_home/agent/scripts/search_crawl.py`):

---

## Running the Agent

Launch the interactive coding agent sandbox:
```bash
docker compose run --rm pi-agent
```

To run a shell inside the sandbox container for inspection:
```bash
docker compose run --rm --entrypoint bash pi-agent
```

---

## Security Architecture

| Security Mechanism | Implementation | Rationale |
| :--- | :--- | :--- |
| **UID Isolation** | `UID: 5000` (`pisandbox`) | Prevents filesystem destruction on the host user space (`UID: 1000`). |
| **Read-Only Root FS** | `read_only: true` | Blocks unauthorized package installations, malware drops, and backdoor persistence. |
| **Drop Capabilities** | `cap_drop: ALL` | Eliminates kernel-level exploitation from container processes. |
| **Privilege Escalation Block** | `no-new-privileges: true` | Prevents `sudo` or `setuid` binaries from escalating privileges. |
| **Volatile Scratchpads** | `tmpfs: /tmp, /run, ~/.cache` | Grants temporary write access for build tools and linters in memory only. |


## References
*   **pi coding agent**: [pi.dev](https://pi.dev/)
*   **unsloth and qwen**: [unsloth/Qwen3.6-35B-A3B-GGUF](https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF)

## Author
[aipracticecafe](https://github.com/deeplearningcafe)
[aipracticecafe-codeberg](https://codeberg.org/aipracticecafe)

## License
This project is licensed under the `MIT`. Details are in the [LICENSE](LICENSE.txt) file.
