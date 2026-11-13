import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, Bot, Boxes, CheckCircle2, ChevronDown, Circle,
  Code2, Cpu, Gamepad2, Github, LayoutDashboard, Loader2, MessageSquare,
  Monitor, Plus, RefreshCw, Rocket, Settings2, ShieldCheck, Sparkles,
  Terminal, Wrench, XCircle
} from "lucide-react";

const roles = [
  ["Manager / Coordinator", "Coordinates work and keeps shared project context.", "manager"],
  ["Planner", "Turns the idea into requirements and milestones.", "planner"],
  ["App & Game Architect", "Chooses a realistic platform and architecture.", "architect"],
  ["UI/UX Designer", "Plans mobile-first screens and interaction states.", "designer"],
  ["Frontend Developer", "Builds the user interface and client behavior.", "frontend"],
  ["Backend Developer", "Plans APIs, services and integrations.", "backend"],
  ["Database Specialist", "Designs data structures and persistence.", "database"],
  ["Game Developer", "Plans gameplay systems when the project is a game.", "game"],
  ["Tester & Debugger", "Creates test cases and identifies likely risks.", "tester"],
  ["Build & Release Agent", "Checks build requirements and release readiness.", "release"]
];

export default function App() {
  const [idea, setIdea] = useState("");
  const [kind, setKind] = useState("app");
  const [mode, setMode] = useState("api");
  const [model, setModel] = useState("");
  const [models, setModels] = useState([]);
  const [connection, setConnection] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [completed, setCompleted] = useState([]);\n  const [proposal, setProposal] = useState(null);\n  const [appliedProject, setAppliedProject] = useState(null);\n  const [fileBusy, setFileBusy] = useState(false);

  async function loadModels() {
    setConnection("checking");
    try {
      const r = await fetch("/api/models");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "FreeLLMAPI connection not configured.");
      const list = data.models || [];
      setModels(list);
      if (!model && list.length) setModel(list[0].id);
      setConnection("connected");
      setError("");
    } catch (e) {
      setConnection("not-configured");
      setError(e.message);
    }
  }

  useEffect(() => { loadModels(); }, []);

  async function createPlan(e) {
    e.preventDefault();
    if (!idea.trim()) return;
    if (mode === "api" && connection !== "connected") {
      setError("Configure FREELLMAPI_BASE_URL and FREELLMAPI_API_KEY on the server first. No key is needed in the browser.");
      return;
    }
    setBusy(true);
    setError("");
    setPlan("");
    setCompleted([]);
    setActiveTab("workspace");
    try {
      const r = await fetch("/api/agents/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, kind, mode, model })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Agent planning failed.");
      setPlan(data.plan);
      setCompleted(data.completed || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateFiles() {\n    if (idea.trim().length < 8 || !model || connection !== "connected") return;\n    setFileBusy(true); setError(""); setProposal(null); setAppliedProject(null);\n    try {\n      const r = await fetch("/api/projects/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea, kind, model }) });\n      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Project generation failed.");\n      setProposal(data); setActiveTab("workspace");\n    } catch (e) { setError(e.message); } finally { setFileBusy(false); }\n  }\n\n  async function approveFiles() {\n    if (!proposal?.proposalId) return;\n    setFileBusy(true); setError("");\n    try {\n      const r = await fetch(`/api/projects/${proposal.proposalId}/apply`, { method: "POST" });\n      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not apply project files.");\n      setAppliedProject(data); setProposal(null);\n    } catch (e) { setError(e.message); } finally { setFileBusy(false); }\n  }\n\n  const statusLabel = connection === "connected" ? "FreeLLMAPI connected" : connection === "checking" ? "Checking gateway…" : "Gateway not configured";
  const progress = Math.round((completed.length / roles.length) * 100);

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Bot size={22}/></div><div><b>BUILDER<span>AGENT</span></b><small>AI DEVELOPMENT WORKSPACE</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <button className={activeTab === "overview" ? "nav active" : "nav"} onClick={() => setActiveTab("overview")}><LayoutDashboard size={17}/> Overview</button>
      <button className={activeTab === "workspace" ? "nav active" : "nav"} onClick={() => setActiveTab("workspace")}><Boxes size={17}/> Project workspace</button>
      <button className="nav" onClick={() => setActiveTab("agents")}><Bot size={17}/> Agent team <span className="nav-count">10</span></button>
      <div className="side-label">SYSTEM</div>
      <button className="nav" onClick={() => setActiveTab("settings")}><Settings2 size={17}/> AI connection</button>
      <div className="sidebar-bottom">
        <div className="connection-card">
          <div className="connection-head"><span className={connection === "connected" ? "dot good" : "dot warn"}/>{statusLabel}</div>
          <small>Provider keys stay on the server.</small>
          <button onClick={loadModels} className="text-button"><RefreshCw size={13}/> Check connection</button>
        </div>
        <div className="repo-link"><Github size={15}/> <span>GitHub project</span><a href="https://github.com/ayyannukadam001-commits/AI-App-Game-Builder-Agent" target="_blank" rel="noreferrer">Open ↗</a></div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> {activeTab === "overview" ? "Overview" : activeTab === "workspace" ? "Project workspace" : activeTab === "agents" ? "Agent team" : "AI connection"}</div><div className="top-right"><span className="build-tag">EARLY ACCESS · 0.1.0</span><div className="avatar">BA</div></div></header>

      {activeTab === "overview" && <section className="content">
        <div className="hero"><div className="eyebrow"><Sparkles size={14}/> YOUR AI DEVELOPMENT TEAM</div><h1>Turn an idea into<br/><em>a buildable project.</em></h1><p>Describe the app or game you want. The agent team will break it down into a practical plan, architecture and next steps.</p>
          <div className="hero-stats"><div><strong>10</strong><small>Specialist roles</small></div><div><strong>2</strong><small>Project types</small></div><div><strong>1</strong><small>Shared workflow</small></div></div>
        </div>
        <div className="section-title"><div><span className="eyebrow">START HERE</span><h2>New project</h2></div><span className="step-label">01 / PROJECT BRIEF</span></div>
        <form className="create-card" onSubmit={createPlan}>
          <label className="field-label">What do you want to build?</label>
          <textarea value={idea} onChange={e => setIdea(e.target.value)} placeholder="Example: A 2D cricket game with quick match, tournament mode, player progression and offline play…" rows={4}/>
          <div className="form-grid">
            <div><label className="field-label">Project type</label><div className="choice-row">
              <button type="button" className={kind === "app" ? "choice selected" : "choice"} onClick={() => setKind("app")}><Monitor size={17}/> App</button>
              <button type="button" className={kind === "game" ? "choice selected" : "choice"} onClick={() => setKind("game")}><Gamepad2 size={17}/> Game</button>
            </div></div>
            <div><label className="field-label">AI mode</label><div className="choice-row">
              <button type="button" className={mode === "api" ? "choice selected" : "choice"} onClick={() => setMode("api")}><Activity size={17}/> API / Cloud</button>
              <button type="button" className={mode === "local" ? "choice selected" : "choice"} onClick={() => setMode("local")}><Cpu size={17}/> Local / Offline</button>
            </div></div>
          </div>
          {mode === "api" && <div className="model-row"><label className="field-label">FreeLLMAPI model</label><select value={model} onChange={e => setModel(e.target.value)} disabled={!models.length}><option value="">{models.length ? "Choose a model" : "Configure gateway to load models"}</option>{models.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}</select><span className={connection === "connected" ? "mini-status ok" : "mini-status"}>{connection === "connected" ? "READY" : "NOT CONNECTED"}</span></div>}
          {mode === "local" && <div className="notice"><Cpu size={16}/> Local mode is a planned adapter. No offline model runtime is bundled yet; this mode will not pretend to run offline.</div>}
          {error && <div className="error"><XCircle size={16}/>{error}</div>}
          <div className="action-row"><button className="primary" disabled={busy || !idea.trim() || (mode === "local")} type="submit">{busy ? <><Loader2 className="spin" size={17}/> Agents working…</> : <>Generate project plan <ArrowRight size={17}/></>}</button><button className="secondary" type="button" disabled={fileBusy || idea.trim().length < 8 || !model || connection !== "connected"} onClick={generateFiles}>{fileBusy ? <Loader2 className="spin" size={16}/> : <Code2 size={16}/>} Generate starter files</button></div>
          <p className="privacy-note"><ShieldCheck size={14}/> API keys are never entered into this page or committed to Git.</p>
        </form>
        <div className="lower-grid"><div className="panel"><div className="panel-head"><h3>Agent team</h3><button className="text-button" onClick={() => setActiveTab("agents")}>View roles <ArrowRight size={13}/></button></div><div className="role-preview">{roles.slice(0,4).map(([name,desc],i)=><div className="role-line" key={name}><span className="role-num">0{i+1}</span><div><b>{name}</b><small>{desc}</small></div><Circle size={9} className="role-idle"/></div>)}</div></div>
          <div className="panel status-panel"><div className="panel-head"><h3>System status</h3><Activity size={16}/></div><div className="status-line"><span>Web workspace</span><b className="good-text">Ready</b></div><div className="status-line"><span>FreeLLMAPI</span><b>{connection === "connected" ? <span className="good-text">Connected</span> : <span className="warn-text">Needs setup</span>}</b></div><div className="status-line"><span>Native APK builder</span><b className="warn-text">Not configured</b></div><small className="muted">APK delivery will only be enabled after a real Android build pipeline is verified.</small></div></div>
      </section>}

      {activeTab === "workspace" && <section className="content"><div className="section-title"><div><span className="eyebrow">ACTIVE WORK</span><h2>Project workspace</h2></div><span className="step-label">AGENT PIPELINE</span></div>
        <div className="panel pipeline"><div className="pipeline-head"><div><h3>Planning workflow</h3><small>{busy ? "Agents are processing the brief…" : plan ? "Plan generated" : "Waiting for a project brief"}</small></div><div className="progress">{progress}%</div></div><div className="progress-track"><span style={{width: progress + "%"}}/></div>
        {roles.map(([name,desc],i)=><div className="pipeline-row" key={name}><span className="pipeline-icon">{completed.includes(name) ? <CheckCircle2 size={18}/> : <span>{String(i+1).padStart(2,"0")}</span>}</span><div><b>{name}</b><small>{desc}</small></div><span className={completed.includes(name) ? "task-state done" : "task-state"}>{completed.includes(name) ? "DONE" : busy ? "QUEUED" : "IDLE"}</span></div>)}</div>
        {proposal && <div className="panel output"><div className="panel-head"><h3><Code2 size={16}/> Generated file proposal</h3><span className="task-state">APPROVAL REQUIRED</span></div><p>{proposal.summary}</p>{proposal.files.map(file => <details className="file-preview" key={file.path}><summary>{file.path}{file.truncated ? " · preview truncated" : ""}</summary><pre>{file.preview}</pre></details>)}<div className="notice"><ShieldCheck size={16}/> Review the generated text before applying. Files are not executed or built.</div><button className="primary" disabled={fileBusy} onClick={approveFiles}>{fileBusy ? <Loader2 className="spin" size={16}/> : <CheckCircle2 size={16}/>} Approve and save files</button></div>}\n        {appliedProject && <div className="panel output"><div className="panel-head"><h3><CheckCircle2 size={16}/> Files saved</h3><span className="task-state done">SAVED</span></div><p>{appliedProject.summary}</p><ul>{appliedProject.files.map(file => <li key={file}>{file}</li>)}</ul><small>{appliedProject.note}</small></div>}\n        {plan && <div className="panel output"><div className="panel-head"><h3><Sparkles size={16}/> Project plan</h3><button className="text-button" onClick={() => navigator.clipboard?.writeText(plan)}>Copy plan</button></div><pre>{plan}</pre></div>}
        {!plan && !busy && <div className="empty-state"><Rocket size={28}/><b>No project plan yet</b><span>Go to Overview and submit your app or game idea.</span><button className="text-button" onClick={() => setActiveTab("overview")}>Create a project <ArrowRight size={14}/></button></div>}
      </section>}

      {activeTab === "agents" && <section className="content"><div className="section-title"><div><span className="eyebrow">SPECIALIST CREW</span><h2>Agent team</h2></div><span className="step-label">10 ROLES</span></div><div className="agent-grid">{roles.map(([name,desc,id],i)=><div className="panel agent-card" key={id}><div className="agent-top"><span className="agent-icon"><Bot size={18}/></span><span className="role-num">AGENT {String(i+1).padStart(2,"0")}</span></div><h3>{name}</h3><p>{desc}</p><span className="task-state">ORCHESTRATED BY MANAGER</span></div>)}</div></section>}

      {activeTab === "settings" && <section className="content"><div className="section-title"><div><span className="eyebrow">PROVIDER SETTINGS</span><h2>AI connection</h2></div></div><div className="panel settings-panel"><div className="settings-icon"><Terminal size={22}/></div><h3>FreeLLMAPI gateway</h3><p>Connect your own FreeLLMAPI server. The app talks to its OpenAI-compatible <code>/v1</code> API. Provider keys remain inside FreeLLMAPI; only the unified gateway key is stored as a server secret.</p><div className="config-list"><div><span>Gateway base URL</span><code>FREELLMAPI_BASE_URL</code></div><div><span>Unified API key</span><code>FREELLMAPI_API_KEY</code></div><div><span>Optional default model</span><code>FREELLMAPI_MODEL</code></div></div><div className="notice"><ShieldCheck size={16}/> Add these values to your deployment environment or local .env file. Never paste secrets into GitHub source files.</div><button className="secondary" onClick={loadModels}><RefreshCw size={15}/> Test connection</button></div></section>}
      <footer>BUILDER AGENT <span>·</span> Honest progress. Real builds. No fake features.</footer>
    </main>
  </div>;
}