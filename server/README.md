# Translation Validator FastAPI Backend

This is the FastAPI backend for the French-to-Wolof Translation Validator application.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
```bash
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the server:
```bash
python run.py
```

The server will run on port 5000 by default.

## API Endpoints

- `GET /api/translations` - Get all translations
- `GET /api/translations/random` - Get a random pending translation
- `PUT /api/translations/{id}` - Update a translation
- `POST /api/translations/import` - Import translations from CSV
- `GET /api/translations/count` - Check if database is empty
- `GET /api/translations/validated` - Get all validated translations
- `GET /api/translations/export` - Export validated translations as CSV
- `GET /api/users` - Get all users