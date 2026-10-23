#!/usr/bin/env python3
"""Polite fetcher: serial, >=3s between requests (tracked across runs), robots.txt Crawl-delay
honoured per host, cached on disk.
usage: fetch.py URL [URL...]  -> prints cache path + status; text dump with --text"""
import sys, os, time, hashlib, re, html, subprocess, json
BASE = os.environ.get("LISTBUILD_WORK") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(BASE, "cache", "pages")
os.makedirs(CACHE, exist_ok=True)
STAMP = os.path.join(BASE, "cache", ".last_request")
LOG = os.path.join(BASE, "cache", "fetch_log.tsv")

def path_for(url):
    return os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest()[:16] + ".html")

import urllib.robotparser, urllib.parse
_rp = {}
def allowed(url):
    if url.endswith("/robots.txt"): return True
    u = urllib.parse.urlsplit(url); root = f"{u.scheme}://{u.netloc}"
    if root not in _rp:
        rp = urllib.robotparser.RobotFileParser()
        rp_path, st = fetch(root + "/robots.txt")
        if st.startswith("200") or st == "cached":
            try:
                rp.parse(open(rp_path, encoding="utf-8", errors="ignore").read().splitlines())
            except Exception:
                rp.allow_all = True
        elif st[:1] in ("0", "5") or not st[:1].isdigit():
            rp.disallow_all = True   # robots.txt unreachable (5xx/network/000): RFC 9309 says assume full disallow
        else:
            rp.allow_all = True   # 4xx/no robots.txt = no restriction
        _rp[root] = rp
    return _rp[root].can_fetch("*", url)

def fetch(url):
    if not allowed(url):
        return path_for(url), "ROBOTS_DISALLOWED"
    p = path_for(url)
    if os.path.exists(p) and os.path.getsize(p) > 0:
        return p, "cached"
    if os.path.exists(p + ".err") and not url.endswith("/robots.txt"):
        return p, "cached-error"
    try:
        last = float(open(STAMP).read())
    except Exception:
        last = 0
    wait = 3.2 - (time.time() - last)
    host = urllib.parse.urlsplit(url).netloc
    hstamp = os.path.join(BASE, "cache", ".last_" + re.sub(r"[^\w.-]", "_", host))
    rp = _rp.get(f"{urllib.parse.urlsplit(url).scheme}://{host}")
    delay = (rp.crawl_delay("*") if rp and not url.endswith("/robots.txt") else None) or 0
    try:
        wait = max(wait, float(delay) - (time.time() - float(open(hstamp).read())))
    except Exception:
        pass
    if wait > 0:
        time.sleep(wait)
    r = subprocess.run(["curl", "-sS", "-L", "-m", "40", "--compressed", "-A",
                        "Mozilla/5.0 (compatible; research list building; manual review)",
                        "-o", p, "-w", "%{http_code} %{url_effective}", url],
                       capture_output=True, text=True)
    open(STAMP, "w").write(str(time.time()))
    open(hstamp, "w").write(str(time.time()))
    status = (r.stdout or r.stderr).strip()
    with open(LOG, "a") as f:
        f.write(f"{time.strftime('%F %T')}\t{url}\t{status}\n")
    if not status.startswith("200") and os.path.exists(p):
        os.rename(p, p + ".err")
    return p, status

def text(p):
    raw = open(p, "rb").read()
    m = re.search(rb'charset=["\']?([\w-]+)', raw[:3000])
    enc = (m.group(1).decode() if m else "utf-8").lower()
    if enc in ("shift_jis", "sjis", "x-sjis"): enc = "cp932"
    t = raw.decode(enc, errors="ignore")
    t = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", "", t)
    t = re.sub(r"(?i)<br\s*/?>|</(p|div|li|tr|h\d|dt|dd|td|th)>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"[ \t　]+", " ", t)
    return re.sub(r"\n\s*\n+", "\n", t)

if __name__ == "__main__":
    args = sys.argv[1:]
    show = "--text" in args; links = "--links" in args
    for u in [a for a in args if not a.startswith("--")]:
        p, s = fetch(u)
        print(f"## {u} [{s}] {p}")
        if os.path.exists(p) and (show or links):
            if show: print(text(p)[:int(os.environ.get("MAXC", "6000"))])
            if links:
                raw = open(p, "rb").read().decode("utf-8", "ignore")
                for h in sorted(set(re.findall(r'href="([^"#]+)"', raw))):
                    try: print("  ", h)
                    except BrokenPipeError: sys.exit(0)
