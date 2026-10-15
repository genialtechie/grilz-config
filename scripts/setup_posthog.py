"""Create the "Jeweler Builder" PostHog project + "Jeweler sprint" dashboard via the REST API.

Usage: python3 setup_posthog.py <key_file> [--host https://us.posthog.com] [--project-id N]
  key_file holds a PostHog *personal* API key (phx_...) with scopes:
  organization:read, project:write, insight:write, dashboard:write.
  --project-id reuses an existing project instead of creating one (idempotent re-runs).
Prints the new project's id and its public project token (for VITE_POSTHOG_PROJECT_TOKEN).
"""
import json, sys, urllib.request, urllib.error
from pathlib import Path

args = sys.argv[1:]
KEY = Path(args[0]).read_text().strip().split()[-1].split("=")[-1]
HOST = args[args.index("--host") + 1] if "--host" in args else "https://us.posthog.com"
PROJECT_ID = int(args[args.index("--project-id") + 1]) if "--project-id" in args else None


def api(method, path, body=None):
    req = urllib.request.Request(
        f"{HOST}{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path} -> {e.code}: {e.read()[:400]!r}")


org = api("GET", "/api/organizations/@current/")
if PROJECT_ID is None:
    existing = [p for p in org.get("teams", org.get("projects", [])) if p.get("name") == "Jeweler Builder"]
    if existing:
        PROJECT_ID = existing[0]["id"]
    else:
        PROJECT_ID = api("POST", f"/api/organizations/{org['id']}/projects/", {"name": "Jeweler Builder"})["id"]
project = api("GET", f"/api/projects/{PROJECT_ID}/")
token = project.get("api_token")

dashboards = api("GET", f"/api/projects/{PROJECT_ID}/dashboards/?limit=200")["results"]
dash = next((d for d in dashboards if d["name"] == "Jeweler sprint" and not d.get("deleted")), None)
if not dash:
    dash = api("POST", f"/api/projects/{PROJECT_ID}/dashboards/", {
        "name": "Jeweler sprint", "description": "15-day jeweler sprint (Oct 15–29). Builder funnel, traffic sources, renders, leads."})

RANGE = {"date_from": "-30d"}
ev = lambda name, label=None: {"kind": "EventsNode", "event": name, "name": label or name}
viz = lambda source: {"kind": "InsightVizNode", "source": source}

INSIGHTS = [
    ("Builder funnel", "Open → design → review → lead → deposit (14-day window).", viz({
        "kind": "FunnelsQuery", "dateRange": RANGE,
        "series": [ev("sample_configurator_opened", "Opened builder"), ev("sample_design_started", "Started design"),
                   ev("sample_design_reviewed", "Reached photo step"), ev("sample_lead_submitted", "Submitted lead"),
                   ev("sample_deposit_clicked", "Clicked deposit")],
        "funnelsFilter": {"funnelWindowInterval": 14, "funnelWindowIntervalUnit": "day"}})),
    ("Builder opens by source", "Which channel drives visits (utm_medium: dm / bio / post / story).", viz({
        "kind": "TrendsQuery", "dateRange": RANGE, "interval": "day",
        "series": [ev("sample_configurator_opened", "Opened builder")],
        "breakdownFilter": {"breakdown": "campaign_medium", "breakdown_type": "event"}})),
    ("Builder opens by DM / post", "utm_content: which shop DM or which post drove the visit.", viz({
        "kind": "TrendsQuery", "dateRange": RANGE, "interval": "day",
        "series": [ev("sample_configurator_opened", "Opened builder")],
        "breakdownFilter": {"breakdown": "campaign_content", "breakdown_type": "event"},
        "trendsFilter": {"display": "ActionsBarValue"}})),
    ("Where people drop off", "Step views inside the builder.", viz({
        "kind": "TrendsQuery", "dateRange": RANGE,
        "series": [ev("sample_step_viewed", "Step viewed")],
        "breakdownFilter": {"breakdown": "step", "breakdown_type": "event"},
        "trendsFilter": {"display": "ActionsBarValue"}})),
    ("AI photo renders", "Completed vs failed renders per day.", viz({
        "kind": "TrendsQuery", "dateRange": RANGE, "interval": "day",
        "series": [ev("sample_render_completed", "Completed"), ev("sample_render_failed", "Failed")]})),
    ("Leads", "Every lead from the demo (they come to Magpollo).", {
        "kind": "DataTableNode", "source": {"kind": "HogQLQuery", "query": (
            "SELECT timestamp, properties.lead_name AS name, properties.lead_contact AS contact, "
            "properties.lead_note AS note, properties.selected_teeth AS teeth, properties.metal AS metal, "
            "properties.estimated_total AS estimate, properties.campaign_medium AS medium, "
            "properties.campaign_content AS content FROM events WHERE event = 'sample_lead_submitted' "
            "ORDER BY timestamp DESC LIMIT 200")}}),
]

existing = {i["name"]: i for i in api("GET", f"/api/projects/{PROJECT_ID}/insights/?limit=200")["results"] if not i.get("deleted")}
for name, description, query in INSIGHTS:
    body = {"name": name, "description": description, "query": query, "dashboards": [dash["id"]]}
    if name in existing:
        api("PATCH", f"/api/projects/{PROJECT_ID}/insights/{existing[name]['id']}/", body)
    else:
        api("POST", f"/api/projects/{PROJECT_ID}/insights/", body)
    print("insight ok:", name)

print(json.dumps({"project_id": PROJECT_ID, "project_token": token,
                  "dashboard_url": f"{HOST}/project/{PROJECT_ID}/dashboard/{dash['id']}"}, indent=1))
