[Japanese/[English](README.md)]

# Local Pi Coding Agent Sandbox

ローカルLLM（llama.cpp）およびセルフホスト型Web検索基盤と連携した、高セキュリティな [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent) 向け実行サンドボックス環境です。

詳しい話は以下の記事を参考してください。
[ローカルLLMで「Pi」エージェントを動かす](https://zenn.dev/fuwamoekissaten/articles/bb5f5364838ced)

## 特徴

- **完全ローカル & コストゼロ**: 商用APIのサブスクリプション課金なし。`llama-server` とローカルMoEモデル（例: Qwen 3.6-35B-MoE）で駆動。
- **要塞化されたサンドボックス環境**:
  - 非rootユーザー (`UID: 5000`) によるプロセス隔離。
  - ルートファイルシステムの読み取り専用化 (`read_only: true`) と `tmpfs` によるインメモリ一時領域。
  - カーネル権限の完全剥奪 (`cap_drop: ALL` / `no-new-privileges: true`)。
  - Linux POSIX ACLによるホスト・コンテナ間のシームレスなファイル共有権限管理。
- **プライバシー特化型 Webリサーチ機能**: **SearXNG**（メタ検索）および **Crawl4AI**（HTML→Markdown変換）をローカル稼働させ、外部へ検索ログを送信せずに最新情報をエージェントへ供給。

---

## ディレクトリ構成

```text
pi-sandbox/
├── docker-compose.yml          # Piエージェント用サンドボックス設定
├── pi.Dockerfile               # サンドボックス環境定義（Node.js / Python / ツール群）
├── project/                    # 開発対象のソースコード（マウント領域）
└── pi_home/                    # Piの設定および永続化データ
    └── agent/
        ├── models.json         # LLM接続設定（llama-serverエンドポイント）
        ├── Agents.md           # エージェント挙動指示プロンプト
        ├── scripts/
        │   └── search_crawl.py # SearXNG / Crawl4AI 連携ヘルパースクリプト
        └── skills/
            └── web-research.md # Web検索・スクレイピングSkill定義
```

---

## 必要要件

- **ホストOS**: Linux (Ubuntu, Pop_OS, Debian 等)
- **コンテナ基盤**: Docker / Docker Compose
- **推論基盤**: [llama.cpp](https://github.com/ggml-org/llama.cpp)（CUDA または CPUビルド）
- **推奨モデル**: `unsloth/Qwen3.6-35B-A3B-GGUF` (Q4_K_M または Q4_K_XL)

---

## セットアップ手順

### 1. ローカルLLMサーバー（`llama.cpp`）の起動

`llama.cpp` をビルドし、ポート `8001` でOpenAI互換サーバーを起動します。

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

### 2. ホスト側パーミッションの設定（POSIX ACL）

ホストユーザー（UID: 1000）とコンテナ内エージェント（UID: 5000）の間で安全にファイル共有を行うため、ACLを設定します。

```bash
mkdir -p project pi_home/agent/scripts pi_home/agent/skills

# ディレクトリ所有者をコンテナユーザー (5000) に設定
sudo chown -R 5000:5000 project pi_home

# ホストユーザー (1000) に読み書き・実行権限およびデフォルトACLを付与
sudo setfacl -R -m u:1000:rwx project pi_home
sudo setfacl -R -d -m u:1000:rwx project pi_home
```

### 3. ローカル検索・スクレイピング基盤の起動

#### SearXNG (メタ検索エンジン)
`searxng/settings.yml` を作成し、JSONフォーマット出力を有効にします。
```yaml
use_default_settings: true
server:
  port: 8080
  bind_address: "0.0.0.0"
  secret_key: "ランダムな16進数キー"
  limiter: false
search:
  formats:
    - html
    - json
```
起動:
```bash
docker run -d \
  --name searxng \
  -p 8080:8080 \
  -v $(pwd)/searxng:/etc/searxng:rw \
  -e SEARXNG_BASE_URL=http://localhost:8080/ \
  searxng/searxng:latest
```

#### Crawl4AI (HTML→Markdown変換サーバー)
```bash
docker run -d \
  --name crawl4ai_server \
  -p 11235:11235 \
  -e CRAWL4AI_API_TOKEN="sk-crawl4ai-token" \
  unclecode/crawl4ai:latest
```

### 4. エージェント設定ファイルの配置

#### 環境変数 (`.env`)
`.env.example`から`.env`ファイルを作成してください。llama-serverや他のサービスを他のサーバーやアドレスに設計しているなら変数を変えてください。例えば、同じネットワークでホスティングしているならこのように変えられます。`LLAMA_SERVER_URL=http://your-machine.local:8001/v1`

```bash
cp .env.example .env
```

```bash
# Target llama-server endpoint (defaults to local host if omitted)
LLAMA_SERVER_URL=http://host.docker.internal:8001/v1

# Optional Google AI Studio key for cloud fallback
GEMINI_API_KEY=your_gemini_api_key_here

# Local search helper endpoints
SEARXNG_URL=http://host.docker.internal:8080/search
CRAWL4AI_URL=http://host.docker.internal:11235/crawl
```


#### `pi_home/agent/models.json`
```json
{
    "providers": {
        "local-server": {
            "baseUrl": "${PI_LLM_BASE_URL:-http://host.docker.internal:8001/v1}",
            "api": "openai-completions",
            "apiKey": "none",
            "models": [
                {
                    "id": "qwen3.6-35b",
                    "name": "Qwen 3.6 35B (Local LLM)"
                }
            ]
        },
        "google": {
            "api": "google-generative-ai",
            "apiKey": "${GEMINI_API_KEY}",
            "models": [
                {
                    "id": "gemma-4-31b-it",
                    "name": "gemma-4-31b-it (Cloud Reserve)"
                },
                {
                    "id": "gemini-2.5-flash",
                    "name": "gemini-2.5-flash (Cloud Reserve)"
                }
            ]
        }
    },
    "defaultModel": "qwen3.6-35b"
}
```

#### `pi_home/agent/scripts/search_crawl.py`

スクリプトに実行権限を付与してください。
```bash
chmod +x pi_home/agent/scripts/search_crawl.py
```

---

## 実行方法

### エージェントの起動
```bash
docker compose run --rm pi-agent
```

### コンテナ内でのデバッグ・手動作業
```bash
docker compose run --rm --entrypoint bash pi-agent
```

---

## セキュリティ設計概要

| セキュリティ機構 | 設定内容 | 導入理由 |
| :--- | :--- | :--- |
| **UID分離** | `UID: 5000` (`pisandbox`) | エージェントの暴走コマンドからホストユーザー領域（UID: 1000）を保護。 |
| **ルートFSの読み取り専用化** | `read_only: true` | システム領域へのファイル書き込み、ツールの無断インストール、バックドア設置を防止。 |
| **Linux Capability剥奪** | `cap_drop: ALL` | コンテナプロセスからのカーネルレベル操作・特権悪用を遮断。 |
| **権限昇格の禁止** | `no-new-privileges: true` | `sudo` や `setuid` バイナリによる特権昇格経路を完全閉鎖。 |
| **tmpfsによる一時領域** | `tmpfs: /tmp, ~/.cache 等` | パッケージビルドやリンターに必要な一時キャッシュ領域のみをメモリ上で安全に確保。 |


## 参考
*   **pi coding agent**: [pi.dev](https://pi.dev/)
*   **unsloth and qwen**: [unsloth/Qwen3.6-35B-A3B-GGUF](https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF)

## 著者
[aipracticecafe](https://github.com/deeplearningcafe)
[aipracticecafe-codeberg](https://codeberg.org/aipracticecafe)

## ライセンス
このプロジェクトはMITのライセンスを使用する。[LICENSE](LICENSE.txt)を参考してください。
