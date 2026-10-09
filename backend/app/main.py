
from datetime import datetime
from io import BytesIO

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Customer Support Process Analyzer",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://customer-support-process-analyzer.vercel.app",
        "https://customer-support-process-analyzer-px6qp7pd6.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory MVP storage; uploaded data resets on restart.
ticket_data = None


@app.get("/")
def home():
    return {"message": "Customer Support Process Analyzer API is running"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.get("/api/sample")
def sample():
    """Generate sample data so the dashboard can be tested immediately."""
    global ticket_data

    rows = []
    base = pd.Timestamp("2026-10-01 09:00:00")

    for i in range(1, 31):
        ticket = f"TKT-{i:03d}"
        team = "Technical Support" if i % 3 == 0 else "General Support"
        start = base + pd.Timedelta(hours=i * 2)

        events = [
            ("Created", start, "Intake"),
            ("Assigned", start + pd.Timedelta(minutes=10), team),
        ]

        if i % 4 == 0:
            events.append(
                ("Reassigned", start + pd.Timedelta(hours=5), "Technical Support")
            )

        events.append(
            (
                "Resolved",
                start + pd.Timedelta(hours=(2 if i % 3 else 12)),
                team,
            )
        )

        for activity, timestamp, assigned_team in events:
            rows.append({
                "ticket_id": ticket,
                "activity": activity,
                "timestamp": timestamp,
                "team": assigned_team,
            })

    ticket_data = pd.DataFrame(rows)
    return analyze(ticket_data)


def analyze(df):
    required = {"ticket_id", "activity", "timestamp", "team"}

    if not required.issubset(df.columns):
        raise HTTPException(
            status_code=400,
            detail=f"Required columns: {sorted(required)}",
        )

    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["ticket_id", "activity", "timestamp"])
    df["ticket_id"] = df["ticket_id"].astype(str)
    df["activity"] = df["activity"].astype(str)
    df["team"] = df["team"].fillna("Unassigned").astype(str)
    df = df.sort_values("timestamp")

    if df.empty:
        raise HTTPException(status_code=400, detail="No valid event records found.")

    summary = []
    for ticket_id, events in df.groupby("ticket_id"):
        events = events.sort_values("timestamp")
        start = events["timestamp"].min()
        resolved = events[
            events["activity"].str.lower().isin(["resolved", "closed"])
        ]
        end = resolved["timestamp"].max() if not resolved.empty else pd.NaT

        transfers = int(
            events["activity"].str.lower().isin(
                ["reassigned", "transfer", "transferred"]
            ).sum()
        )

        summary.append({
            "ticket_id": ticket_id,
            "status": "Resolved" if pd.notna(end) else "Open",
            "resolution_hours": (
                round((end - start).total_seconds() / 3600, 2)
                if pd.notna(end) else None
            ),
            "reassignments": transfers,
            "last_activity": str(events.iloc[-1]["activity"]),
            "last_team": str(events.iloc[-1]["team"]),
        })

    tickets = pd.DataFrame(summary)
    resolved_tickets = tickets[tickets["status"] == "Resolved"]
    durations = resolved_tickets["resolution_hours"].dropna()

    team_stats = (
        df.groupby("team")
        .size()
        .reset_index(name="event_count")
        .sort_values("event_count", ascending=False)
    )

    activity_stats = (
        df.groupby("activity")
        .size()
        .reset_index(name="count")
        .sort_values("count", ascending=False)
    )

    return {
        "metrics": {
            "total_tickets": int(len(tickets)),
            "resolved_tickets": int(len(resolved_tickets)),
            "open_tickets": int((tickets["status"] == "Open").sum()),
            "resolution_rate": round(
                len(resolved_tickets) / len(tickets) * 100, 1
            ),
            "avg_resolution_hours": round(float(durations.mean()), 2)
            if not durations.empty else 0,
            "tickets_with_reassignments": int(
                (tickets["reassignments"] > 0).sum()
            ),
        },
        "tickets": tickets.astype(object).where(
            pd.notna(tickets), None
        ).to_dict(orient="records"),
        "team_activity": team_stats.to_dict(orient="records"),
        "activity_counts": activity_stats.to_dict(orient="records"),
    }


@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    global ticket_data

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    content = await file.read()

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Maximum file size is 10 MB.")

    try:
        df = pd.read_csv(BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this CSV file.")

    # Normalize common column-name variations.
    aliases = {
        "case id": "ticket_id",
        "case_id": "ticket_id",
        "ticket id": "ticket_id",
        "case": "ticket_id",
        "concept:name": "ticket_id",
        "event": "activity",
        "task": "activity",
        "activity name": "activity",
        "time:timestamp": "timestamp",
        "date": "timestamp",
        "event time": "timestamp",
        "assigned team": "team",
        "support team": "team",
    }

    df.columns = [
        aliases.get(str(c).strip().lower(), str(c).strip().lower())
        for c in df.columns
    ]

    result = analyze(df)
    ticket_data = df
    return result


@app.get("/api/analytics")
def analytics():
    if ticket_data is None:
        raise HTTPException(
            status_code=404,
            detail="No dataset loaded. Upload a CSV or call /api/sample first.",
        )
    return analyze(ticket_data)
