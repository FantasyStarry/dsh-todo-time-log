#!/usr/bin/env python3
"""Live UTF-8 round-trip check against the running DSH Web API."""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("DSH_WEB_URL", "http://127.0.0.1:52283").rstrip("/") + "/api/dsh-todo-time-log"


def call(path, payload=None, method="POST"):
    data = None
    headers = {}
    if method == "POST":
        data = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8")
        headers["content-type"] = "application/json; charset=utf-8"
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))


failures = []


def check(name, condition, detail=None):
    if not condition:
        failures.append((name, detail))
        print("FAIL", name, detail if detail is not None else "")


TITLE = "中文标题：写插件文档 ✅"
_, created = call("/create", {"title": TITLE})
todo = created["value"]["todo"]
check("create ok", created["ok"] is True, created)
check("utf-8 title round-trip", todo["title"] == TITLE, todo["title"])
check("createdAt present", isinstance(todo["createdAt"], str) and todo["createdAt"].endswith("Z"), todo["createdAt"])
check("completedAt null", todo["completedAt"] is None)

_, listed = call("/list", {"filter": "pending", "sortBy": "createdAt", "direction": "asc"})
found = [t for t in listed["value"]["todos"] if t["id"] == todo["id"]]
check("listed with utf-8 title", found and found[0]["title"] == TITLE, listed["value"]["todos"])
check("timeFormat returned", listed["value"].get("timeFormat") == "YYYY-MM-DD HH:mm:ss", listed["value"].get("timeFormat"))

status, completed = call("/complete", {"id": todo["id"]})
check("complete 200", status == 200 and completed["value"]["todo"]["completedAt"] is not None, completed)
status, duplicate = call("/complete", {"id": todo["id"]})
check("duplicate complete 409", status == 409, status)
check(
    "duplicate message is localized",
    "已完成" in duplicate["error"]["message"] and "T" not in duplicate["error"]["message"].split("完成时间 ")[1][:10],
    duplicate["error"]["message"],
)

_, reopened = call("/uncomplete", {"id": todo["id"]})
check("uncomplete clears completedAt", reopened["value"]["todo"]["completedAt"] is None, reopened)
check("uncomplete notice", any("已取消完成" in n for n in reopened["value"]["notices"]), reopened["value"]["notices"])

_, removed = call("/delete", {"id": todo["id"]})
check("delete ok", removed["value"]["deleted"] == todo["id"], removed)

_, final = call("/list", {})
check("no test rows left", final["value"]["stats"]["total"] == 0, final["value"]["stats"])

status, health = call("/health", method="GET")
check("health 200", status == 200 and health["value"]["count"] == 0, health)

if failures:
    print(f"\n{len(failures)} failure(s)")
    sys.exit(1)
print("\nUTF-8 live round-trip: all checks passed")
