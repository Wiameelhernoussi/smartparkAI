🚗 SmartParkAI — Intelligent Parking Monitoring & Prediction

**SmartParkAI** is an intelligent parking management project that combines computer vision, machine learning, time-series forecasting, and web technologies to support parking-space monitoring and occupancy prediction.

The project brings together a Python backend, an interactive web frontend, and AI components designed to analyze parking-related data and provide predictive insights.


 🎯 Project Objectives

SmartParkAI explores how artificial intelligence can improve parking management by addressing several challenges:

- **Parking monitoring:** analyze parking scenes using computer vision techniques.
- **Occupancy forecasting:** use time-series models to estimate future parking occupancy.
- **Uncertainty estimation:** investigate prediction uncertainty to better interpret model outputs.
- **Interactive web application:** provide a user interface for accessing the system's features.
- **Web push notifications:** support notifications through browser push subscriptions.
- **Natural-language interaction:** integrate natural-language search using a locally hosted language model.

 ✨ Key Features

### Computer Vision

The project includes computer-vision components for parking-scene analysis, using technologies such as OpenCV and YOLOv8.

### Time-Series Forecasting

LSTM-based models are used to study temporal patterns in parking occupancy. The project also explores **Monte Carlo Dropout** to estimate uncertainty in model predictions.

The planned forecasting horizons include 15, 30, and 60 minutes.

### Interactive Web Interface

The frontend is built with React and Vite, providing a web interface for interacting with the application.

### Natural-Language Search

The project integrates a natural-language search component based on Ollama and the `llama3.2:1b` model.

### Web Push Notifications

The backend includes functionality for managing Web Push subscriptions, including subscription registration, unsubscription, and VAPID configuration.

 🧠 Technology Stack

| Component | Technologies |
|---|---|
| Backend API | Python, FastAPI |
| Frontend | React, Vite, JavaScript |
| Computer Vision | OpenCV, YOLOv8 |
| Deep Learning | LSTM, PyTorch |
| Prediction Uncertainty | Monte Carlo Dropout |
| Language Model | Ollama, Llama 3.2 1B |
| Database | PostgreSQL, depending on configuration |
| Notifications | Web Push, VAPID |
| Containerization | Docker, Docker Compose |
| Version Control | Git, GitHub |

🏗️ Project Architecture

```text
SmartParkAI/
├── backend/
│   ├── main.py
│   ├── models/
│   ├── tests/
│   └── ...
├── frontend/
│   ├── public/
│   ├── src/
│   └── ...
├── dataset_parking/
├── apply_lstm.py
├── check_dataset.py
├── smartpark-train.py
├── pipline.py
├── Dockerfile
├── docker-compose.yml
├── README_DOCKER.md
└── .gitignore
```

The backend exposes the application API and coordinates the relevant services. The frontend provides the user interface, while the machine-learning scripts and datasets support data preparation, model training, and experimentation.

Getting Started

Prerequisites

Before running the project, ensure that you have:

- Python and a compatible virtual environment.
- Node.js and npm.
- Git.
- Docker and Docker Compose, if using the containerized setup.
- The required model weights and datasets.
- Any additional services required by the application, such as a database or a local language-model runtime.

 1. Clone the Repository

```bash
git clone https://github.com/Wiameelhernoussi/smartparkAI.git
cd smartparkAI
```

 2. Configure Environment Variables

Create a local environment file containing the configuration required by the backend.

The Web Push functionality requires the following VAPID variables:

```dotenv
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
```

Add any additional environment variables required by the application's database and services.

**Security:** Never commit `.env` files, private keys, credentials, certificates, or personal configuration files. Use placeholder values in documentation and provide a sanitized `.env.example` once the complete configuration has been verified.

 3. Set Up the Backend

Create and activate a Python virtual environment:

```bash
cd backend
python -m venv venv
```

On Windows PowerShell, activate it with:

```powershell
.\venv\Scripts\Activate.ps1
```

Install the backend dependencies:

```bash
pip install -r requirements.txt
```

Return to the project root and start the FastAPI application using the entry point and command configured in the repository.

The API documentation is expected to be available at:

```text
http://localhost:8000/docs
```

The exact startup command, required model files, and environment configuration should be verified against the current backend and Docker configuration.

 4. Set Up the Frontend

Open a terminal in the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Ensure that the frontend API configuration points to the running backend.

 5. Run with Docker

The repository includes a Dockerfile and a Docker Compose configuration for a containerized setup.

From the project root, run:

```bash
docker compose up --build
```

To run the services in the background:

```bash
docker compose up -d --build
```

Make sure the required environment variables, datasets, model weights, and external services are configured before starting the application.

For additional deployment instructions, see [`README_DOCKER.md`](README_DOCKER.md).

🧪 Testing and Code Quality

The repository includes backend test files and frontend testing tools.

During development, the frontend production build, a targeted ESLint check for the service worker, and the available frontend test suite were reported to pass. However, the entire repository has not yet been confirmed free of linting issues.

Use the test commands and dependencies defined in the relevant project configuration files to validate changes.

🔐 Security Considerations

- Keep secrets and private keys outside version control.
- Load VAPID credentials through environment variables.
- Exclude private configuration files, local databases, backups, and sensitive generated artifacts from Git.
- Review tracked files and repository history before publishing changes.
- Use HTTPS when deploying browser push notifications or other features that require secure browser contexts.
- Rotate credentials that may previously have been exposed.

🚀 Potential Future Improvements

- Evaluate forecasting accuracy across different prediction horizons.
- Compare alternative time-series forecasting models.
- Improve the visualization and calibration of uncertainty estimates.
- Expand automated testing and continuous integration.
- Document dataset provenance and make model experiments reproducible.
- Improve deployment configuration, monitoring, and operational reliability.

👩‍💻 Author

**Wiame El Hernoussi**

AI & Data Engineering student interested in machine learning, computer vision, predictive analytics, and intelligent applications.



SmartParkAI — Exploring the intersection of artificial intelligence, predictive analytics, and intelligent parking management.
