# ELEC API SOLO — Genshin Codex (genshin.jmp.blue)

A single-page web app that lets users browse **Genshin Impact** data (Characters, Weapons, Artifacts) using the **genshin.jmp.blue** API.  
Includes a **search bar**, **filters (scope + match mode)**, **sorting (A–Z / Z–A)**, **pagination (Load More)**, a **Random** picker, **detail modal**, **API Docs modal**, **error handling**, **loading spinner**, and a **light/dark theme toggle**.

---

## Live Features (What the app can do)

- Browse by category:
  - **Characters**
  - **Weapons**
  - **Artifacts**
  - **All**
- Search with:
  - **Scope** (All / Characters / Weapons / Artifacts)
  - **Match mode** (Contains / Starts)
- Sorting:
  - **A–Z** and **Z–A**
- **Load More** pagination (performance-friendly)
- **Random** item button (opens detail modal)
- **Modal details view** with image + key info
- **API Docs modal** (rubric documentation inside the app)
- **Element Aura hover effect** for characters (based on `vision`)
- **Theme toggle** (Dark / Light) with persistence via `localStorage`

---

## Project Files (Required: exactly 3)

This project follows the required structure:

- `index.html`
- `style.css`
- `script.js`

No inline CSS or JS is used.

---

## How to Run (Website)

Because this uses `fetch()` to call a public API, you should run it using a local server.

### Option A: VS Code Live Server (recommended)
1. Open the folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server**.

### Option B: Any local server
- Use any local web server (examples: `http-server`, `python -m http.server`, etc.)
- Then open the local URL in your browser.

---

# API Rubric Requirements

## 1. Base URL
**Base URL:**  
`https://genshin.jmp.blue`

---

## 2. Endpoints Used (3+)

This project uses these endpoints:

### List endpoints (IDs)
- `GET /characters` → returns an array of character IDs  
- `GET /weapons` → returns an array of weapon IDs  
- `GET /artifacts` → returns an array of artifact IDs  

### Detail endpoints (data by ID)
- `GET /characters/{id}` → character detail JSON (used in modal + aura vision)
- `GET /weapons/{id}` → weapon detail JSON (used in modal)
- `GET /artifacts/{id}` → artifact detail JSON (used in modal)

### Image endpoints (UI images)
- `GET /characters/{id}/icon` → character icon used in cards
- `GET /characters/{id}/card` → character card art used in modal
- `GET /weapons/{id}/icon` → weapon icon used in cards + modal
- `GET /artifacts/{id}/flower-of-life` → artifact image used in cards + modal

---

## 3. Required Parameters
This API mainly uses **path parameters**:

- `{type}`: `characters` | `weapons` | `artifacts`
- `{id}`: specific resource ID (example: `nahida`, `aquila-favonia`, `gladiators-finale`)

Examples:
- `GET /characters/nahida`
- `GET /weapons/aquila-favonia`
- `GET /artifacts/gladiators-finale`

No required query parameters are used in this project.

---

## 4. Authentication
**Authentication:** None  
- No API key  
- No OAuth  
- No token required  

---

## 5. Sample JSON Response (fields used in the UI)

### Example: `GET /characters/nahida`
Only the fields used by the project are shown below:

```json
{
  "name": "Nahida",
  "title": "Physic of Purity",
  "vision": "Dendro",
  "weapon": "Catalyst",
  "nation": "Sumeru",
  "rarity": 5,
  "affiliation": "Sumeru Akademiya",
  "description": "..."
}
