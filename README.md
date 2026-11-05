# BizManager — GST Business Accounting & Inventory Management

BizManager is a full-stack, GST-compliant business management system built for small and medium enterprises (SMEs). It offers complete lifecycle management for inventory, sales, purchases, delivery challans, customer/supplier ledgers, statutory GST reporting, AI business insights, and verified enterprise security.

Deployable as a **Web Application (Render)**, a **Desktop App (Windows / macOS via Electron)**, or an **Offline-capable Mobile App (React Native)**.

---

## 🚀 Key Features

### 🏢 Multi-Firm & Owner Management
* Manage multiple business entities/firms under a single user account.
* Quick firm switching with isolated ledgers, inventory, and transaction sequences.
* State code detection and automatic GST prefix mapping (e.g., `08` for Rajasthan, `27` for Maharashtra).

### 🛡️ Enterprise Email Verification & Account Recovery
* **5-Layer Email Existence Engine**: Checks RFC 5322 syntax, detects domain typos (e.g. `gmai.com` &rarr; `gmail.com`), blocks disposable/throwaway email providers, and queries live DNS for active Mail Exchanger (MX) records.
* **Mandatory Business Email**: Enforced on registration and profile updates to eliminate fake/unreachable accounts.
* **Forgot Password with 6-Digit Email OTP**: Automated password reset workflow dispatching time-limited (10 min) verification codes via Nodemailer/SMTP, protected by SHA-256 hashing and brute-force attempt limits.

### 📦 Inventory & Item Master
* Automatic item code generation (`ITM-0001`).
* Dynamic stock recalculation: $\text{Closing Stock} = \text{Opening Qty} + \text{Total Purchases} - \text{Total Sales}$.
* Auto-updated latest purchase prices and stock valuations.
* Fast search by item name, item code, or HSN code with prefix matching.

### 📑 Transactions (Purchases & Sales)
* **Intra-State (CGST + SGST)** and **Inter-State (IGST)** automatic tax calculations.
* Standard GST slabs: `0%`, `5%`, `12%`, `18%`, `28%`.
* Auto round-off for invoice grand totals.
* Keyboard-optimized entry (press <kbd>Tab</kbd> on tax field to add new rows seamlessly).
* Thermal and A4 printable GST tax invoices and delivery challans.

### 📊 Statutory GST Returns & Business Reports
* **Dashboard**: Key metrics (total stock valuation, monthly sales, monthly purchases, low stock alerts, recent transactions).
* **Stock Summary & Stock Detail**: Date-range breakdowns by invoice and item.
* **GSTR-1**: B2B and B2C supply breakdowns with HSN-wise tax summaries.
* **GSTR-3B**: 3.1 Outward supplies, Section 4 Input Tax Credit (ITC), and net tax payable calculation.

### ✦ AI-Powered Analytics (Groq / Qwen)
* **Dashboard Summary**: Generates plain-English narrative summaries of monthly business performance.
* **Transaction Anomaly Detector**: Warns if sale or purchase rates deviate significantly from historic averages.
* **HSN Code Smart Suggester**: Recommends HSN codes based on item descriptions.

---

## 🛠️ Tech Stack

* **Frontend**: React 19, Vite, React Router 7, Chart.js
* **Backend**: Node.js, Express, NeDB (embedded JSON datastore — zero external database setup required), Nodemailer, JWT, bcryptjs
* **Desktop App**: Electron 31 + electron-builder
* **AI Engine**: Groq SDK (`qwen/qwen3.8-27b`)
* **Deployment**: Render (Web Service serving static SPA + API)

---

## 📂 Project Structure

```text
Proj1/
├── backend/                  # Express REST API & Database Models
│   ├── src/
│   │   ├── config/           # Local NeDB datastores & query wrappers
│   │   ├── controllers/      # Route controllers (Auth, Items, Sales, Reports, AI, etc.)
│   │   ├── middleware/       # JWT auth, firm selector, error handlers
│   │   ├── models/           # Collection models (User, Firm, Item, Sale, Purchase, etc.)
│   │   ├── routes/           # REST endpoints
│   │   └── utils/            # Email verifier, Nodemailer transporter, GST math, AI cache
│   ├── app.js                # Express app configuration & static SPA fallback
│   ├── server.js             # Server entry point
│   └── package.json
│
├── frontend/                 # React 19 Single Page Application
│   ├── src/
│   │   ├── api/              # Axios API clients
│   │   ├── components/       # Layout, Navbar, Autocomplete, EmailVerifier, Modals
│   │   ├── context/          # Auth & Firm context
│   │   ├── pages/            # Dashboard, Sales, Purchases, Reports, Auth
│   │   └── utils/            # Print invoice/challan formatters, GST utilities
│   ├── vite.config.js        # Multi-mode Vite configuration (web / Electron)
│   └── package.json
│
├── mobile/                   # React Native mobile client
├── main.js                   # Electron desktop application main process
├── package.json              # Monorepo root scripts & Electron build configuration
└── README.md
```

---

## 💻 Local Development Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* npm (v9 or higher)

### 1. Clone the Repository
```bash
git clone https://github.com/harshitk8406/BizManager.git
cd BizManager
```

### 2. Configure Environment Variables
Create a file named `.env` inside the `backend/` directory:
```ini
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_123

# Groq AI Key (Optional - for AI business insights)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=qwen/qwen3.8-27b

# SMTP Credentials (Optional - if omitted, OTPs log to server console)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourbusiness@gmail.com
SMTP_PASS=your_16_letter_app_password
SMTP_FROM="BizManager Security" <yourbusiness@gmail.com>
```

### 3. Install Dependencies & Run Development Servers

**Option A: Run Web Full-Stack Locally**
```bash
# Terminal 1: Backend API
cd backend
npm install
npm run dev           # Runs on http://localhost:5000

# Terminal 2: Frontend Client
cd frontend
npm install
npm run dev           # Runs on http://localhost:5173
```
Visit **http://localhost:5173** in your browser.

**Option B: Run as Electron Desktop Application**
```bash
npm install
npm run build-frontend-electron
npm run electron-dev
```

---

## ☁️ Production Deployment on Render

The repository is configured as a unified monorepo. Render automatically builds the React frontend into static assets and serves both the client SPA and the Express API under a single domain.

### Render Service Settings

1. Create a new **Web Service** on [dashboard.render.com](https://dashboard.render.com/) linked to your repository.
2. Configure the **Build & Deploy** settings:

| Setting | Value | Explanation |
| :--- | :--- | :--- |
| **Runtime** | `Node` | Node.js environment |
| **Root Directory** | *(Leave blank)* | Runs from the monorepo root |
| **Build Command** | `npm run render-build` | Compiles `frontend/dist` and installs backend dependencies |
| **Start Command** | `npm run render-start` | Runs `node backend/server.js` |

### Render Environment Variables

Add the following under the **Environment** tab:

| Variable | Value | Description |
| :--- | :--- | :--- |
| **`NODE_ENV`** | `production` | Enables production mode |
| **`JWT_SECRET`** | *(random strong string)* | Encrypts user authentication tokens |
| **`GROQ_API_KEY`** | *(your Groq API key)* | Powers AI summaries & anomaly checks |
| **`GROQ_MODEL`** | `qwen/qwen3.8-27b` | AI model version |
| **`SMTP_HOST`** | `smtp.gmail.com` | Mail server host for OTPs |
| **`SMTP_PORT`** | `587` | TLS port |
| **`SMTP_USER`** | `yourbusiness@gmail.com` | Sender email |
| **`SMTP_PASS`** | `xxxx xxxx xxxx xxxx` | Google App Password (or Brevo SMTP Key) |
| **`SMTP_FROM`** | `"BizManager Security" <yourbusiness@gmail.com>` | Sender header |

---

## 📡 Core API Reference

### Authentication & Account Security
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register admin account & initial firm (mandatory email) |
| `POST` | `/api/auth/login` | Sign in & receive JWT token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile & accessible firms |
| `PUT` | `/api/auth/profile` | Update user name, username, or password |
| `GET` | `/api/auth/check-username` | Real-time username availability check |
| `POST` | `/api/auth/verify-email` | 5-layer email existence verification (DNS MX + syntax) |
| `POST` | `/api/auth/forgot-password` | Generate & send 6-digit OTP to firm owner's email |
| `POST` | `/api/auth/verify-reset-otp`| Validate 6-digit OTP code |
| `POST` | `/api/auth/reset-password` | Set new password and confirm |

### Firms & Masters
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/firms` | List firms owned by user |
| `POST` | `/api/firms` | Create a new business firm |
| `PUT` | `/api/firms/:id` | Update business firm profile & settings |
| `GET/POST`| `/api/items` | List or create stock items |
| `GET/POST`| `/api/suppliers` | List or create suppliers |
| `GET/POST`| `/api/customers` | List or create customers |

### Transactions & Reports
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET/POST`| `/api/purchases` | List or record purchase invoices |
| `GET/POST`| `/api/sales` | List or record sales invoices |
| `GET/POST`| `/api/challans` | List or issue delivery challans |
| `GET` | `/api/reports/dashboard` | High-level dashboard counters & recent transactions |
| `GET` | `/api/reports/stock-summary` | Summary of stock quantities & valuation |
| `GET` | `/api/reports/gstr1` | GSTR-1 outward supply summaries (B2B/B2C/HSN) |
| `GET` | `/api/reports/gstr3b` | GSTR-3B tax liability and ITC summaries |

---

## ⌨️ Productivity Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | Purchase / Sale Forms | Save and commit transaction |
| <kbd>Tab</kbd> | GST % selector in table | Instantly adds a new row and focuses the item search |
| <kbd>Esc</kbd> | Modals / Forms | Close modal or cancel current operation |

---

## 📄 License

This project is licensed under the MIT License — see the [license.txt](file:///d:/EBACKUP/New%20Projects/Proj1/license.txt) file for details.
