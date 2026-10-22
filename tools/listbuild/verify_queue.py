#!/usr/bin/env python3
"""First-pass check of queued companies against their own websites.

usage: verify_queue.py [queue_file ...]   (default: every file in output/progress/db_queue)
env:   LISTBUILD_WORK=<dir for HTML cache>, MAXPAGES=4

For each pending record with a URL: fetch the top page, follow up to MAXPAGES links
that look like store-list / company-profile pages, and store the evidence:
  est.postal   distinct 〒 codes on store-like pages
  est.phrase   largest "N店舗" / "N拠点" figure in the text
  est.links    distinct links whose text ends in 店 / 店舗
plus contacts (tel, fax, form, mail, sns, rep, employees, buying-dept lines).
status -> needs_review (some estimate >= 4), likely_under5, no_url, fetch_failed.
Saves after every record so an interrupted run resumes where it stopped.
Fetching goes through fetch.py: serial, >=3s apart, robots.txt honoured, cached.
"""
import glob, html, json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
QDIR = os.path.join(ROOT, "output", "progress", "db_queue")
MAXPAGES = int(os.environ.get("MAXPAGES", "4"))
LINK_HINT = re.compile(r"(店舗|拠点|ショップ|shop|store|tenpo|access|会社概要|会社案内|企業情報|company|about|outline|corporate|gaiyo)", re.I)


def raw_of(p):
    return open(p, "rb").read().decode("utf-8", "ignore") if os.path.exists(p) else ""


def same_site(base, href):
    u = urllib.parse.urljoin(base, href)
    b, x = urllib.parse.urlsplit(base), urllib.parse.urlsplit(u)
    return u if x.scheme.startswith("http") and x.netloc.split(":")[0].removeprefix("www.") == b.netloc.split(":")[0].removeprefix("www.") else None


def check(rec):
    url = rec.get("url", "").strip()
    if not url:
        return "no_url", {}
    if not url.startswith("http"):
        url = "http://" + url
    p, st = fetch.fetch(url)
    if not (st.startswith("200") or st == "cached"):
        return "fetch_failed", {"top": [url, st]}
    top = raw_of(p)
    cand = []
    for m in re.finditer(r'<a\b[^>]*href="([^"#]+)"[^>]*>(.*?)</a>', top, re.S | re.I):
        href, text = m.group(1), html.unescape(re.sub(r"<[^>]+>", "", m.group(2))).strip()
        u = same_site(url, href)
        if u and u != url and (LINK_HINT.search(href) or LINK_HINT.search(text)) and u not in cand:
            cand.append(u)
    pages = [(url, fetch.text(p), top)]
    for u in cand[:MAXPAGES]:
        q, s2 = fetch.fetch(u)
        if s2.startswith("200") or s2 == "cached":
            pages.append((u, fetch.text(q), raw_of(q)))
    alltext = "\n".join(t for _, t, _ in pages)
    allraw = "\n".join(r for _, _, r in pages)
    postal = set()
    for u, t, _ in pages:
        if re.search(r"(店舗|shop|store|tenpo|access|拠点)", u, re.I) or "店舗一覧" in t:
            postal |= set(re.findall(r"〒\s?(\d{3}-?\d{4})", t))
    phrases = [int(n) for n in re.findall(r"(\d{1,3})\s?(?:店舗|拠点)", alltext) if 0 < int(n) < 500]
    shoplinks = set()
    for m in re.finditer(r'<a\b[^>]*>(.*?)</a>', allraw, re.S | re.I):
        t = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
        if 2 < len(t) < 30 and re.search(r"(店|店舗|営業所)$", t) and not re.search(r"(店舗一覧|全店舗|店舗情報|販売店|専門店)$", t):
            shoplinks.add(t)
    lines = [l.strip() for l in alltext.split("\n") if l.strip()]
    def after(label):
        for i, l in enumerate(lines):
            if re.match(label, l):
                v = l[len(re.match(label, l).group(0)):].strip(" ：:|") or (lines[i + 1] if i + 1 < len(lines) else "")
                return v[:60]
        return ""
    ev = {
        "pages": [u for u, _, _ in pages],
        "est": {"postal": len(postal), "phrase": max(phrases) if phrases else 0, "links": len(shoplinks),
                "link_names": sorted(shoplinks)[:40]},
        "company": after(r"(会社名|商号|社名)"),
        "rep": after(r"(代表取締役|代表者|代表)"),
        "addr": after(r"(本社所在地|本社|所在地)"),
        "employees": after(r"(従業員数|従業員|社員数)"),
        "tel": (re.findall(r"(?:TEL|Tel|電話)[^\d]{0,6}(0\d{1,4}-\d{1,4}-\d{3,4})", alltext) or [""])[0],
        "fax": (re.findall(r"(?:FAX|Fax|ＦＡＸ)[^\d]{0,6}(0\d{1,4}-\d{1,4}-\d{3,4})", alltext) or [""])[0],
        "mail": sorted(set(re.findall(r"mailto:([\w.+-]+@[\w.-]+)", allraw)))[:3],
        "form": sorted({u for h in re.findall(r'href="([^"]+)"', allraw)
                        if (u := same_site(url, h)) and re.search(r"(contact|inquiry|toiawase|otoiawase|form)", h, re.I)})[:3],
        "sns": sorted({h for h in re.findall(r'href="([^"]+)"', allraw)
                       if re.search(r"(instagram\.com|twitter\.com|//x\.com|facebook\.com|youtube\.com|tiktok\.com)", h)})[:8],
        "dept": sorted({l[:60] for l in lines if re.search(r"(買取|業販|仕入)", l) and len(l) < 60})[:5],
    }
    best = max(ev["est"]["postal"], ev["est"]["phrase"], ev["est"]["links"])
    return ("needs_review" if best >= 4 else "likely_under5"), ev


def main(files):
    files = files or sorted(glob.glob(os.path.join(QDIR, "*.json")))
    for f in files:
        recs = json.load(open(f, encoding="utf-8"))
        todo = [r for r in recs if r.get("status") == "pending"]
        print(f"{os.path.basename(f)}: {len(todo)}/{len(recs)} pending", flush=True)
        for r in todo:
            try:
                r["status"], r["evidence"] = check(r)
            except Exception as e:  # keep going; record the failure for manual follow-up
                r["status"], r["evidence"] = "fetch_failed", {"error": repr(e)[:200]}
            json.dump(recs, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            e = r["evidence"].get("est", {})
            print(f"  {r['status']:14} {r['name']} {e}", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
