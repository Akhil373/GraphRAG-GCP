FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

COPY . .

EXPOSE 8080 

CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 app:app