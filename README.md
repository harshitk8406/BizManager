# BizManager — Business Management Software

A full-stack GST-compliant business management system for managing stock, purchases, sales, and reports.

## Tech Stack

- **Frontend**: React 18 + Vite (port 5173)
- **Backend**: Node.js + Express (port 5000)
- **Database**: MongoDB (local, port 27017)

## Project Structure

```
Proj1/
├── backend/          # Express REST API
└── frontend/         # React Vite SPA
```

## Setup & Running

### Prerequisites
- Node.js (v18+)
- MongoDB running locally on port 27017

### 1. Start Backend
```bash
cd backend
npm install          # first time only
npm run dev          # starts with nodemon on port 5000
```

### 2. Start Frontend
```bash
cd frontend
npm install          # first time only
npm run dev          # starts Vite dev server on port 5173
```

### 3. Open in Browser
Navigate to: **http://localhost:5173**

---

## Features

### Master Data
- **Item Master** — Add/edit/delete items with auto-generated item codes (ITM-0001), HSN codes, packing sizes, GST%, purchase & sales prices
- **Suppliers** — GSTIN-linked supplier database with autofill on purchase forms
- **Customers** — GSTIN or "CASH" (retail) customer database with autofill on sale forms

### Transactions
- **Purchase Entry** — Multi-item purchase form with:
  - Supplier autofill by name or GSTIN
  - Item autofill with HSN, packing size, purchase price pre-filled
  - Intra-state (CGST+SGST) and Inter-state (IGST) support
  - Live GST calculation per line
  - Auto stock update on save
- **Sales Entry** — Same as purchase but for sales; autofills sales price

### Reports
- **Stock Summary** — Closing stock, latest purchase price, stock value per item
- **Stock Detail** — Date-wise purchase breakdown with date range and item code filters

### Stock Management
- Opening Qty set once at item creation
- Closing Qty = Opening Qty + Total Purchased − Total Sold (auto-recalculated)
- Latest Purchase Price updated on every purchase

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET/POST | /api/items | List/create items |
| GET/PUT/DELETE | /api/items/:code | Get/update/delete item |
| GET/POST | /api/suppliers | List/create suppliers |
| GET | /api/suppliers/gst/:gst | Lookup supplier by GSTIN |
| GET/POST | /api/customers | List/create customers |
| GET | /api/customers/gst/:gst | Lookup customer by GSTIN |
| GET/POST | /api/purchases | List/create purchases |
| GET/PUT/DELETE | /api/purchases/:id | Get/update/delete purchase |
| GET/POST | /api/sales | List/create sales |
| GET/PUT/DELETE | /api/sales/:id | Get/update/delete sale |
| GET | /api/reports/stock-summary | Stock summary report |
| GET | /api/reports/stock-detail | Date-wise stock detail |
| GET | /api/reports/dashboard | Dashboard statistics |
