---
name: web-research
description: Local web search and crawling capabilities using self-hosted SearXNG and local Crawl4AI containers. Useful when needing real-time library details, API documentation, or code answers.
---

# Web Research Workflow

When asked to fetch information from the web, locate external API documentation, resolve programming questions using online search engines, or crawl a specific link, you must use our local script execution helper.

## Execution Rules

Execute `/home/pisandbox/.pi/agent/scripts/search_crawl.py` using your standard `bash` tool.

1. **To Search Web Queries (returns title, URL, and clean snippets)**:
   ```bash
   python3 /home/pisandbox/.pi/agent/scripts/search_crawl.py search "search keywords"
   ```

2. **To Scrape and Read Specific Webpages (returns clean Markdown formatted for LLMs)**:
   ```bash
   python3 /home/pisandbox/.pi/agent/scripts/search_crawl.py crawl "https://target-url-here"
   ```

## Workflow Protocol
- **Proactive Search**: If you run into an unfamiliar framework pattern or code compilation error, run a web search instead of guessing.
- **Cross-Reference**: Read at least one high-quality link via the `crawl` tool rather than relying solely on short search snippets.
