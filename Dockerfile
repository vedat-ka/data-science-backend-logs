FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

ENV ML_LOG_ANALYZER_PORT=5050
ENV ML_LOG_ANALYZER_MODEL_DIR=/app/models

EXPOSE 5050

CMD ["python", "app.py"]
