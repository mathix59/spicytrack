FROM python:3.13-alpine
WORKDIR /fixture
RUN pip install --no-cache-dir sentry-sdk==2.66.1
COPY main.py ./
CMD ["python", "main.py"]
