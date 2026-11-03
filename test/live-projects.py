#!/usr/bin/env python3
"""Live project-category (v2) round-trip against the running DSH Web API."""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("DSH_WEB_URL", "http://127.0.0.1:52283").rstrip("/") + "/api/dsh-todo-time-log"

failures = []


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


def check(name, condition, detail=None):
    if not condition:
        failures.append((name, detail))
        print("FAIL", name, detail if detail is not None else "")


created_ids = []
try:
    _, health = call("/health", method="GET")
    check("health 200", health.get("ok") is True, health)

    _, work = call("/create", {"title": "工作待办", "project": "工作"})
    check("create with project", work.get("value", {}).get("todo", {}).get("project") == "工作", work)
    created_ids.append(work["value"]["todo"]["id"])

    _, study = call("/create", {"title": "学习待办", "project": " 学习  "})
    check("project trimmed", study.get("value", {}).get("todo", {}).get("project") == "学习", study)
    created_ids.append(study["value"]["todo"]["id"])

    _, plain = call("/create", {"title": "无分类待办"})
    check("project defaults empty", plain.get("value", {}).get("todo", {}).get("project") == "", plain)
    created_ids.append(plain["value"]["todo"]["id"])

    status, too_long = call("/create", {"title": "x", "project": "a" * 41})
    check("project too long 400", status == 400 and too_long["error"]["code"] == "PROJECT_TOO_LONG", too_long)

    status, wrong_type = call("/create", {"title": "x", "project": ["a"]})
    check("project wrong type 400", status == 400 and wrong_type["error"]["code"] == "PROJECT_INVALID", wrong_type)

    _, scoped = call("/list", {"project": "工作"})
    names = {t["id"] for t in scoped["value"]["todos"]}
    check("list project filter", names == {created_ids[0]}, scoped["value"]["todos"])
    projects = {p["name"]: p for p in scoped["value"]["projects"]}
    check("projects summary has groups", set(projects) >= {"工作", "学习", ""}, scoped["value"]["projects"])
    check("uncategorized counted", projects[""]["count"] >= 1, projects.get(""))
    check("project echo", scoped["value"]["project"] == "工作", scoped["value"].get("project"))

    _, uncategorized = call("/list", {"project": ""})
    check(
        "filter uncategorized",
        all(t["project"] == "" for t in uncategorized["value"]["todos"]),
        uncategorized["value"]["todos"],
    )

    _, all_projects = call("/list", {})
    check("project echo null when unfiltered", all_projects["value"].get("project") is None, all_projects["value"].get("project"))

    _, sorted_by_project = call("/list", {"sortBy": "project", "direction": "asc"})
    check(
        "project sort keeps uncategorized last",
        sorted_by_project["value"]["todos"][-1]["project"] == "",
        [t["project"] for t in sorted_by_project["value"]["todos"]],
    )

    _, only_project = call("/update", {"id": created_ids[2], "project": "杂事"})
    updated = only_project["value"]["todo"]
    check(
        "update project only keeps title",
        updated["project"] == "杂事" and updated["title"] == "无分类待办",
        updated,
    )

    _, noop = call("/update", {"id": created_ids[2], "project": "杂事"})
    check("no-op update", noop.get("value", {}).get("unchanged") is True, noop)

    _, renamed = call("/update", {"id": created_ids[1], "title": "学习待办（改）", "project": "读书"})
    check("update title+project", renamed["value"]["todo"]["title"] == "学习待办（改）" and renamed["value"]["todo"]["project"] == "读书", renamed)
finally:
    for todo_id in created_ids:
        call("/delete", {"id": todo_id})
    _, final = call("/list", {})
    check("cleanup leaves no test rows", final["value"]["stats"]["total"] == 0, final["value"]["stats"])

if failures:
    print(f"\n{len(failures)} failure(s)")
    sys.exit(1)
print("\nLive project-category round-trip: all checks passed")
