import json, re, unicodedata, sys
W = "/tmp/claude-0/-home-user--investment-news-digest/e443c7e3-875e-5910-a4a1-6255cd49a44a/scratchpad"
N = lambda x: unicodedata.normalize("NFKC", x or "").replace(" ", "").replace("　", "")
d = json.load(open("/home/user/-investment-news-digest/output/progress/national_companies.json"))
apple = json.load(open(W + "/cache/apple_stores.json")); upos = json.load(open(W + "/cache/upos_stores.json"))
rows = {}
for l in open(W + "/nta/hits.jsonl"):
    r = json.loads(l)["row"]
    if r[23] != "1" or r[18]: continue          # latest only, not closed
    rows.setdefault(N(r[6]), {})[r[1]] = r
n = lambda c: c.get("count", len(c.get("stores", [])))
L = [c for c in d if c["status"] == "list" or (c["status"] == "under5" and n(c) >= 3)]
res = {}
for c in L:
    if c.get("hq") or "未確認" in c["name"]: continue
    nm = N(re.sub(r"（.*?）|\(.*?\)", "", c["name"]))
    prefs = {s.get("pref") for s in c.get("stores", [])}
    cand = [r for r in rows.get(nm, {}).values() if r[9] in prefs]
    # store addresses (cities) from FC caches, for disambiguation
    key = re.sub(r"(株式会社|有限会社)", "", nm)
    addrs = [N(s.get("addr", "")) for s in apple + upos if key and key in N(s.get("owner", ""))]
    pick = None
    if len(cand) == 1: pick, why = cand[0], "unique"
    elif len(cand) > 1:
        m = [r for r in cand if any(N(r[9] + r[10]) in a or N(r[10]) in a for a in addrs)]
        if len(m) == 1: pick, why = m[0], "city-match"
        else: why = f"ambiguous {len(cand)}"
    else: why = "none (all prefs: %s)" % [r[9] for r in rows.get(nm, {}).values()]
    res[c["name"]] = {"why": why, "pick": pick and {"no": pick[1], "addr": pick[9] + pick[10] + pick[11], "post": pick[15]}}
    print(c["name"], "|", why, "|", pick and (pick[1], pick[9] + pick[10] + pick[11]))
json.dump(res, open(W + "/nta/match.json", "w"), ensure_ascii=False, indent=1)
