#!/usr/bin/env python3
"""Upsert company records (JSON from stdin: object or list) into national progress file, keyed by name."""
import sys, json, os
F = "/home/user/-investment-news-digest/output/progress/national_companies.json"
data = json.load(open(F)) if os.path.exists(F) else []
idx = {d["name"]: i for i, d in enumerate(data)}
new = json.load(sys.stdin)
for r in (new if isinstance(new, list) else [new]):
    r.setdefault("count", len(r.get("stores", [])))
    if r["name"] in idx: data[idx[r["name"]]] = r
    else: idx[r["name"]] = len(data); data.append(r)
json.dump(data, open(F, "w"), ensure_ascii=False, indent=1)
print("records:", len(data), "| list:", sum(d["status"] == "list" for d in data))
