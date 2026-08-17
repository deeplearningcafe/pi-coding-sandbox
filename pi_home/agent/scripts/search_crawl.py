import os
import sys
import json
import urllib.request
import urllib.parse


# Dynamic endpoint resolution with backward-compatible defaults
SEARXNG_URL = os.environ.get("SEARXNG_URL", "http://host.docker.internal:8080/search")
CRAWL4AI_URL = os.environ.get("CRAWL4AI_URL", "http://host.docker.internal:11235/crawl")


def search_searxng(query):
    params = urllib.parse.urlencode({"q": query, "format": "json"})
    url = f"{SEARXNG_URL}?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            results = data.get("results", [])[:5]
            formatted = []
            for r in results:
                formatted.append(
                    {
                        "title": r.get("title"),
                        "url": r.get("url"),
                        "snippet": r.get("content") or r.get("snippet"),
                    }
                )
            return json.dumps(formatted, indent=2)
    except Exception as e:
        return json.dumps({"error": f"SearXNG search failed: {str(e)}"})


def crawl_url(target_url):
    payload = json.dumps({"urls": [target_url], "wait_after_scroll": 1})
    try:
        req = urllib.request.Request(
            CRAWL4AI_URL,
            data=payload.encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0",
                "Authorization": "Bearer crawl_token",
            },
            method="POST",
        )
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            results = res_data.get("results", [])
            if results and isinstance(results, list):
                markdown_content = results[0].get("markdown", "") or results[0].get(
                    "html", ""
                )
                if markdown_content:
                    return markdown_content
            return json.dumps(res_data, indent=2)
    except Exception as e:
        return json.dumps({"error": f"Crawl4AI server request failed: {str(e)}"})


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage:")
        print('  python3 search_crawl.py search "query"')
        print('  python3 search_crawl.py crawl "https://example.com"')
        sys.exit(1)

    action = sys.argv[1]
    param = sys.argv[2]

    if action == "search":
        print(search_searxng(param))
    elif action == "crawl":
        print(crawl_url(param))
    else:
        print("Unknown action. Choose 'search' or 'crawl'.")
