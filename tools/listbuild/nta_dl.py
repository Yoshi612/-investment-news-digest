# Serial download of NTA 法人番号 zenken (CSV Unicode) per prefecture; keep only rows whose name is in targets.
# usage: nta_dl.py targets.json out.jsonl ID:PREF ...
import sys, json, re, time, io, zipfile, csv, os, requests, unicodedata
N = lambda x: unicodedata.normalize("NFKC", x).replace(" ", "").replace("　", "")
BASE = "https://www.houjin-bangou.nta.go.jp/download/zenken/index.html"
targets = {N(t) for t in json.load(open(sys.argv[1]))}
out = open(sys.argv[2], "a", encoding="utf-8")
done_f = sys.argv[2] + ".done"
done = set(open(done_f).read().split()) if os.path.exists(done_f) else set()
s = requests.Session(); s.headers["User-Agent"] = "Mozilla/5.0 (listbuild; polite serial fetch)"
last = [0.0]
def wait():
    dt = time.time() - last[0]
    if dt < 3.5: time.sleep(3.5 - dt)
    last[0] = time.time()
for spec in sys.argv[3:]:
    fid, pref = spec.split(":")
    if fid in done: continue
    wait(); r = s.get(BASE, timeout=60)
    tok = re.search(r'name="(jp\.go\.nta[^"]+token)" value="([^"]+)"', r.text)
    wait()
    z = s.post(BASE, data={tok.group(1): tok.group(2), "event": "download", "selDlFileNo": fid}, timeout=600)
    if not z.content[:2] == b"PK":
        print(pref, "not a zip", z.status_code, z.headers.get("content-type")); continue
    zf = zipfile.ZipFile(io.BytesIO(z.content)); hit = 0
    for nm in zf.namelist():
        if not nm.endswith(".csv"): continue
        with zf.open(nm) as fh:
            for row in csv.reader(io.TextIOWrapper(fh, encoding="utf-8")):
                if len(row) > 6 and N(row[6]) in targets:
                    out.write(json.dumps({"pref_file": pref, "row": row}, ensure_ascii=False) + "\n"); hit += 1
    out.flush(); open(done_f, "a").write(fid + "\n")
    print(pref, len(z.content)//1024, "KB, hits", hit, flush=True)
    del z, zf
