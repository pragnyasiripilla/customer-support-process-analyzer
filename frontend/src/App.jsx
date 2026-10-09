import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  CheckCircle,
  Clock,
  RefreshCw,
  Upload,
  Headphones,
  Search,
  GitBranch,
  ArrowDown,
  AlertTriangle,
  Download,
  Users,
  Inbox,
  CircleCheck,
  X,
} from "lucide-react";
import "./App.css";

const API = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [teamFilter, setTeamFilter] = useState("All");
  const [activeView, setActiveView] = useState("Overview");

  async function loadSample() {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(`${API}/api/sample`);
      setData(response.data);
      setSearch("");
      setStatusFilter("All");
      setTeamFilter("All");
    } catch {
      setError("Cannot connect to the backend. Check that FastAPI is running.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a CSV file.");
      event.target.value = "";
      return;
    }

    const form = new FormData();
    form.append("file", file);

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API}/api/upload`, form);
      setData(response.data);
      setSearch("");
      setStatusFilter("All");
      setTeamFilter("All");
      setActiveView("Overview");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Upload failed. Check the CSV format and required columns."
      );
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  useEffect(() => {
    loadSample();
  }, []);

  const metrics = data?.metrics;
  const tickets = data?.tickets || [];
  const activityCounts = data?.activity_counts || [];
  const teamActivity = data?.team_activity || [];

  const teams = useMemo(
    () => [...new Set(tickets.map((ticket) => ticket.last_team).filter(Boolean))],
    [tickets]
  );

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch = String(ticket.ticket_id)
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      const matchesStatus =
        statusFilter === "All" || ticket.status === statusFilter;

      const matchesTeam =
        teamFilter === "All" || ticket.last_team === teamFilter;

      return matchesSearch && matchesStatus && matchesTeam;
    });
  }, [tickets, search, statusFilter, teamFilter]);

  const insights = useMemo(() => {
    if (!tickets.length) return [];

    const resolved = tickets.filter(
      (ticket) => ticket.resolution_hours != null
    );

    const slowest = [...resolved].sort(
      (a, b) => b.resolution_hours - a.resolution_hours
    )[0];

    const reassigned = tickets.filter(
      (ticket) => Number(ticket.reassignments) > 0
    );

    const results = [];

    if (slowest) {
      results.push({
        icon: Clock,
        title: "Longest resolution",
        description: `${slowest.ticket_id} took ${slowest.resolution_hours} hours to resolve.`,
      });
    }

    if (reassigned.length) {
      results.push({
        icon: RefreshCw,
        title: "Handoff review",
        description: `${reassigned.length} tickets have recorded reassignment events. Review their timelines for avoidable transfers.`,
      });
    }

    if (metrics?.open_tickets > 0) {
      results.push({
        icon: AlertTriangle,
        title: "Open tickets",
        description: `${metrics.open_tickets} tickets remain unresolved and may need follow-up.`,
      });
    }

    if (!results.length) {
      results.push({
        icon: CheckCircle,
        title: "No immediate flags",
        description: "No open tickets or reassignment events were detected in this dataset.",
      });
    }

    return results;
  }, [tickets, metrics]);

  function downloadReport() {
    if (!data) return;

    const rows = [
      [
        "Ticket ID",
        "Status",
        "Resolution Hours",
        "Reassignments",
        "Last Activity",
        "Last Team",
      ],
      ...filteredTickets.map((ticket) => [
        ticket.ticket_id,
        ticket.status,
        ticket.resolution_hours ?? "",
        ticket.reassignments,
        ticket.last_activity,
        ticket.last_team,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "support-ticket-report.csv";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Activity size={23} />
          </div>
          <div>
            <strong>ProcessIQ</strong>
            <span>SUPPORT ANALYTICS</span>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>

        {[
          { name: "Overview", icon: Activity },
          { name: "Ticket analysis", icon: Headphones },
          { name: "Process insights", icon: GitBranch },
        ].map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={`nav-item ${activeView === name ? "active" : ""}`}
            onClick={() => setActiveView(name)}
          >
            <Icon size={18} />
            {name}
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <span>Analytics API</span>
          <strong>Local</strong>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">PROCESS INTELLIGENCE / SUPPORT</span>
            <h1>Customer Support Analytics</h1>
            <p>Discover bottlenecks. Improve resolution times.</p>
          </div>

          <div className="actions">
            <button
              className="button secondary"
              onClick={loadSample}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Sample data
            </button>

            <label className={`button primary ${loading ? "disabled" : ""}`}>
              <Upload size={16} />
              Upload CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={uploadFile}
                disabled={loading}
                hidden
              />
            </label>
          </div>
        </header>

        {error && (
          <div className="error" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {loading && <div className="notice">Loading analytics…</div>}

        {!metrics && !error ? (
          <div className="panel">Loading dashboard data…</div>
        ) : metrics ? (
          <>
            {activeView === "Overview" && (
              <>
                <section className="welcome">
                  <div>
                    <span className="pill">LIVE ANALYSIS</span>
                    <h2>Your support process, at a glance.</h2>
                    <p>
                      Understand workload, resolution performance and
                      reassignments.
                    </p>
                  </div>
                  <div className="welcome-icon">
                    <Activity size={38} />
                  </div>
                </section>

                <section className="metric-grid">
                  <Metric
                    title="Total tickets"
                    value={metrics.total_tickets}
                    icon={<Headphones />}
                    color="blue"
                  />
                  <Metric
                    title="Resolved tickets"
                    value={metrics.resolved_tickets}
                    icon={<CheckCircle />}
                    color="green"
                  />
                  <Metric
                    title="Average resolution"
                    value={`${metrics.avg_resolution_hours} h`}
                    icon={<Clock />}
                    color="purple"
                  />
                  <Metric
                    title="Reassigned tickets"
                    value={metrics.tickets_with_reassignments}
                    icon={<RefreshCw />}
                    color="orange"
                  />
                </section>

                <section className="content-grid">
                  <div className="panel chart-panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Activity distribution</h3>
                        <p>Events recorded in the process log</p>
                      </div>
                    </div>

                    <div className="chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={activityCounts}
                          margin={{
                            top: 10,
                            right: 12,
                            left: -18,
                            bottom: 4,
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e8edf4"
                          />
                          <XAxis
                            dataKey="activity"
                            tick={{ fill: "#68758b", fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: "#68758b", fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="count"
                            name="Events"
                            fill="#6259e8"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Process health</h3>
                        <p>Current dataset overview</p>
                      </div>
                    </div>

                    <div className="health-stat">
                      <span>Resolution rate</span>
                      <strong>{metrics.resolution_rate}%</strong>
                    </div>

                    <div
                      className="progress-track"
                      aria-label={`Resolution rate ${metrics.resolution_rate}%`}
                    >
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, metrics.resolution_rate))}%`,
                        }}
                      />
                    </div>

                    <div className="health-stat">
                      <span>Open tickets</span>
                      <strong>{metrics.open_tickets}</strong>
                    </div>

                    <div className="health-stat">
                      <span>Tickets with reassignments</span>
                      <strong>{metrics.tickets_with_reassignments}</strong>
                    </div>

                    <div className="insight">
                      <Activity size={18} />
                      <div>
                        <strong>Process insight</strong>
                        <p>
                          {metrics.tickets_with_reassignments
                            ? "Review reassigned tickets to identify potential handoff delays."
                            : "No ticket reassignments were detected in this dataset."}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <ProcessFlow activityCounts={activityCounts} />

                <section className="panel recommendations-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Process improvement opportunities</h3>
                      <p>
                        Rule-based observations calculated from the current
                        dataset
                      </p>
                    </div>
                  </div>

                  <div className="recommendation-grid">
                    {insights.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div className="recommendation" key={item.title}>
                          <div className="recommendation-icon">
                            <Icon size={19} />
                          </div>
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

            {activeView === "Ticket analysis" && (
              <section className="panel page-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Ticket analysis</h3>
                    <p>Search and inspect individual ticket outcomes.</p>
                  </div>
                  <button className="button secondary" onClick={downloadReport}>
                    <Download size={16} /> Export filtered CSV
                  </button>
                </div>
                <TicketFilters
                  search={search}
                  setSearch={setSearch}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  teamFilter={teamFilter}
                  setTeamFilter={setTeamFilter}
                  teams={teams}
                />
                <TicketTable tickets={filteredTickets} />
                <p className="table-footer">
                  Showing {filteredTickets.length} of {tickets.length} tickets
                </p>
              </section>
            )}

            {activeView === "Process insights" && (
              <>
                <section className="panel page-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Process insights</h3>
                      <p>
                        Workflow overview and rule-based improvement
                        opportunities.
                      </p>
                    </div>
                  </div>
                  <ProcessFlow activityCounts={activityCounts} />
                </section>

                <section className="panel recommendations-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Findings from this dataset</h3>
                      <p>Based on observed ticket records, not generated text.</p>
                    </div>
                  </div>
                  <div className="recommendation-grid">
                    {insights.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div className="recommendation" key={item.title}>
                          <div className="recommendation-icon">
                            <Icon size={19} />
                          </div>
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Events by team</h3>
                      <p>Number of logged events attributed to each team</p>
                    </div>
                  </div>
                  <div className="team-list">
                    {teamActivity.map((team) => (
                      <div className="team-row" key={team.team}>
                        <span><Users size={16} /> {team.team}</span>
                        <strong>{team.event_count}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {activeView !== "Overview" && activeView !== "Ticket analysis" &&
              activeView !== "Process insights" && null}

            {activeView === "Overview" && (
              <section className="panel tickets-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Ticket explorer</h3>
                    <p>
                      Individual ticket outcomes and process history summary
                    </p>
                  </div>
                  <button className="button secondary" onClick={downloadReport}>
                    <Download size={16} /> Export CSV
                  </button>
                </div>

                <TicketFilters
                  search={search}
                  setSearch={setSearch}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  teamFilter={teamFilter}
                  setTeamFilter={setTeamFilter}
                  teams={teams}
                />

                <TicketTable tickets={filteredTickets} />

                <p className="table-footer">
                  Showing {filteredTickets.length} of {tickets.length} tickets
                  · Data calculated from event logs
                </p>
              </section>
            )}
          </>
        ) : null}

        <footer className="app-footer">
          ProcessIQ · Customer Support Process Analyzer
        </footer>
      </main>
    </div>
  );
}

function Metric({ title, value, icon, color }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${color}`}>{icon}</div>
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  );
}

function TicketFilters({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  teamFilter,
  setTeamFilter,
  teams,
}) {
  return (
    <div className="ticket-controls">
      <label className="search-control">
        <Search size={17} />
        <input
          type="search"
          placeholder="Search ticket ID..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search ticket ID"
        />
        {search && (
          <button
            className="clear-search"
            onClick={() => setSearch("")}
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </label>

      <select
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
        aria-label="Filter by status"
      >
        <option value="All">All statuses</option>
        <option value="Resolved">Resolved</option>
        <option value="Open">Open</option>
      </select>

      <select
        value={teamFilter}
        onChange={(event) => setTeamFilter(event.target.value)}
        aria-label="Filter by team"
      >
        <option value="All">All teams</option>
        {teams.map((team) => (
          <option value={team} key={team}>{team}</option>
        ))}
      </select>
    </div>
  );
}

function TicketTable({ tickets }) {
  if (!tickets.length) {
    return (
      <div className="empty-state">
        <Inbox size={30} />
        <strong>No matching tickets</strong>
        <p>Try a different ticket ID, status, or team filter.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ticket ID</th>
            <th>Status</th>
            <th>Resolution time</th>
            <th>Reassignments</th>
            <th>Last team</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.ticket_id}>
              <td className="ticket-id">{ticket.ticket_id}</td>
              <td>
                <span className={`status ${ticket.status.toLowerCase()}`}>
                  {ticket.status}
                </span>
              </td>
              <td>
                {ticket.resolution_hours == null
                  ? "—"
                  : `${ticket.resolution_hours} h`}
              </td>
              <td>
                <span
                  className={
                    Number(ticket.reassignments) > 0
                      ? "reassignment-count flagged"
                      : "reassignment-count"
                  }
                >
                  {ticket.reassignments}
                </span>
              </td>
              <td>{ticket.last_team}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProcessFlow({ activityCounts }) {
  const counts = Object.fromEntries(
    activityCounts.map((item) => [
      String(item.activity).toLowerCase(),
      item.count,
    ])
  );

  const stages = [
    {
      name: "Ticket created",
      icon: Inbox,
      count: counts.created ?? null,
      description: "Initial ticket registration",
    },
    {
      name: "Ticket assigned",
      icon: Users,
      count: counts.assigned ?? null,
      description: "Assigned to a support team",
    },
    {
      name: "Reassignment",
      icon: RefreshCw,
      count: counts.reassigned ?? counts.transferred ?? null,
      description: "Handoff between teams",
    },
    {
      name: "Ticket resolved",
      icon: CircleCheck,
      count: counts.resolved ?? counts.closed ?? null,
      description: "Ticket reaches a terminal state",
    },
  ];

  return (
    <section className="panel process-panel">
      <div className="panel-heading">
        <div>
          <h3><GitBranch size={17} /> Support process flow</h3>
          <p>Observed activity counts from the event log</p>
        </div>
        <span className="pill light-pill">EVENT LOG</span>
      </div>

      <div className="process-flow">
        {stages.map((stage, index) => {
          const Icon = stage.icon;

          return (
            <div className="flow-fragment" key={stage.name}>
              <div className={`flow-stage flow-stage-${index + 1}`}>
                <div className="flow-icon"><Icon size={21} /></div>
                <strong>{stage.name}</strong>
                <span>{stage.description}</span>
                <div className="flow-count">
                  {stage.count == null
                    ? "No matching event"
                    : `${stage.count} events`}
                </div>
              </div>
              {index < stages.length - 1 && (
                <div className="flow-connector">
                  <ArrowDown size={19} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="flow-note">
        This is a simplified activity overview, not a reconstructed sequence
        for every individual ticket. A ticket may skip stages or be reassigned
        more than once.
      </p>
    </section>
  );
}
