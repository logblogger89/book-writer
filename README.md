# Nova Writer

An AI-powered collaborative sci-fi novel writing app. Multiple specialized expert agents — Logline Creator, World Builder, Scientific Advisor, Persona Creator, Chapter Beats, Scene Outliner, Dialogue Specialist, Prose Writer, Continuity Editor, and Literary Editor — work together to produce high-quality novels.

## Features

- **Interactive Co-Pilot mode**: At each phase, choose from 3 creative options (with AI recommendation), or write your own direction
- **Auto-Pilot mode**: Let the AI make all decisions and run the full pipeline unattended
- **Real-time streaming**: Watch each expert write in real time with live text streaming
- **Expert graph**: Visual DAG showing agent relationships and live status
- **Phase rollback**: Roll back to any completed phase, inject new context, and re-run the entire downstream pipeline
- **User interrupts**: Inject your thoughts to any running phase mid-execution
- **Artifact viewer**: Formatted views of all produced artifacts (logline, world doc, characters, beats, prose)
- **Light/dark mode**

## Setup

### 1. Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. Navigate to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)

> Note: The Anthropic API is separate from Claude.ai Pro. You'll need to add billing at console.anthropic.com.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Usage

1. Open `http://localhost:5173`
2. Click **New Novel**, enter a title and premise
3. Click **Start** in the app header
4. In **Co-Pilot mode** (default): choose from 3 options at each phase, or type your own direction
5. Switch to **Auto-Pilot** to let the AI run the full pipeline unattended
6. **Inject** thoughts at any time using the bar at the bottom of the center panel
7. Use **rollback buttons** (↩) in the Phase Timeline to revisit any completed phase

## Architecture

```
backend/   Python FastAPI + async SQLite + Anthropic SDK
frontend/  React 18 + TypeScript + Vite + Tailwind + React Flow + Zustand
```

Real-time communication via WebSockets. All expert outputs are streamed token-by-token to the UI. Phase state is persisted in SQLite with full snapshot support for rollback.
