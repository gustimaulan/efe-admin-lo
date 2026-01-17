# EFE Admin LO

A robust automation and management dashboard for [Loops.id](https://app.loops.id/), designed to streamline administrative tasks through automated browser interactions and real-time monitoring.

## 🚀 Overview

`efe-admin-lo` is a Node.js-based automation engine that uses **Playwright** to interact with the Loops.id administrative interface. It features a rule-based engine to determine which administrators can process specific campaigns and provides real-time feedback via **Socket.io**.

## ✨ Key Features

-   **Browser Automation**: Automated login and campaign processing using Playwright.
-   **Rule Engine**: Sophisticated logic to handle admin-campaign assignments based on priorities, exclusions, and exemptions.
-   **Real-time Monitoring**: Live console logs and job status updates streamed to the dashboard via Socket.io.
-   **Job Management**: Ability to start, monitor, and cancel automation jobs.
-   **Multi-environment Support**: Configurations for development, staging, and production.
-   **Security**: Rate limiting, helmet protection, and request sanitization.

## 🛠 Tech Stack

-   **Backend**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
-   **Real-time**: [Socket.io](https://socket.io/)
-   **Automation**: [Playwright](https://playwright.dev/)
-   **Process Management**: [PM2](https://pm2.keymetrics.io/)
-   **Logging**: [Winston](https://github.com/winstonjs/winston) & [Morgan](https://github.com/expressjs/morgan)
-   **Testing**: [Jest](https://jestjs.io/)

## 📂 Project Structure

```text
├── src/
│   ├── config/             # Environment-specific configurations
│   ├── controllers/        # Request handling logic
│   ├── middleware/         # Security and validation middleware
│   ├── public/             # Frontend assets (HTML, JS, CSS)
│   ├── routes/             # API route definitions
│   ├── services/           # Core business logic (Automation, Campaign, Logger)
│   ├── utils/              # Helper functions and constants
│   ├── app.js              # Express app configuration
│   └── server.js           # Entry point
├── ecosystem.config.js     # PM2 configuration
└── package.json            # Dependencies and scripts
```

## 🚀 Getting Started

### Prerequisites

-   Node.js (LTS version recommended)
-   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd efe-admin-lo
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables:
    Create a `.env` file in the root directory and add the necessary variables (refer to `src/config/index.js` for expected variables like `ALLOWED_ORIGINS`, `WEBHOOK_URL`, etc.).

### Running the Application

-   **Development**:
    ```bash
    npm run dev
    ```
-   **Staging**:
    ```bash
    npm run staging
    ```
-   **Production**:
    ```bash
    npm start
    ```

### 📦 PM2 Deployment

The project includes an `ecosystem.config.js` for process management with PM2.

-   **Start Production**:
    ```bash
    pm2 start ecosystem.config.js --env production
    ```
-   **Start Staging**:
    ```bash
    pm2 start ecosystem.config.js --env staging
    ```
-   **Manage Processes**:
    ```bash
    pm2 list          # View running processes
    pm2 logs loops    # View logs
    pm2 restart loops # Restart application
    pm2 stop loops    # Stop application
    ```

## 🔌 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Check service health |
| `GET` | `/api/jobs` | Get all active automation jobs |
| `POST` | `/api/run` | Start a new automation job |
| `POST` | `/api/check-plan` | Preview processing plan without execution |
| `DELETE` | `/api/jobs/:id` | Cancel a specific job |

## ⚖️ Rule Engine

The core logic resides in `src/services/automationService.js` and `src/config/index.js`. It evaluates rules based on:
-   **Time of Day**: Different campaigns for morning, afternoon, and night.
-   **Admin Restrictions**: Hardcoded or dynamic rules allowing/denying admins from processing certain campaigns.
-   **Exemptions**: Special overrides for specific administrators.

## 📝 License

This project is private and intended for internal use.
