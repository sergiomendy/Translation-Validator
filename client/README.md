# French-to-Wolof Translation Validator

This application helps validate translations from French to Wolof. It includes a FastAPI backend with SQLite database for centralized storage and a React frontend.

## Project Structure

- `/server` - FastAPI Python backend with SQLite database
- `/src` - React frontend application

## Setup Instructions

### Server Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Create and activate a virtual environment:
```bash
# Create virtual environment
python -m venv venv

# Activate on Windows
venv\Scripts\activate
# OR activate on macOS/Linux
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the server:
```bash
python run.py
```

The server will run on port 5000 by default.

### Frontend Setup

1. From the project root, install dependencies:
```bash
pnpm install
```

2. Start the development server:
```bash
pnpm run dev
```

The frontend will run on port 5173 by default.

## Database Architecture

The application uses a SQLite database with the following tables:

1. `translations` - Stores all translation pairs with validation status
2. `users` - Stores user information for validators

All database operations are performed through the API, ensuring a consistent database state for all users.

## API Endpoints

- `GET /api/translations` - Get all translations
- `GET /api/translations/random` - Get a random pending translation
- `PUT /api/translations/{id}` - Update a translation
- `POST /api/translations/import` - Import translations from CSV
- `GET /api/translations/count` - Check if database is empty
- `GET /api/translations/validated` - Get all validated translations
- `GET /api/translations/export` - Export validated translations as CSV
- `GET /api/users` - Get all users

## Features

- User authentication
- Translation validation
- Translation correction
- CSV import and export
- Centralized database shared among all users