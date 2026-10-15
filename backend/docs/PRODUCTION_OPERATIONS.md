# Production operations

- Redis is mandatory in production and backs BullMQ, distributed locks, and the Socket.IO Redis adapter.
- `/metrics` exposes Prometheus metrics and requires `Authorization: Bearer $METRICS_TOKEN` when configured.
- Logs are structured JSON through Pino. `ALERT_WEBHOOK_URL` receives unhandled-error alerts.
- Local object storage is MinIO from `docker-compose.yml`; production can use any S3-compatible service with lifecycle/versioning enabled.
- `backup-mysql.ps1` creates a consistent logical backup. `restore-mysql.ps1` requires the explicit `-ConfirmRestore` switch. Test restores regularly in a non-production database.
- Production startup refuses public OSRM/Photon/VietQR image defaults and requires payment reconciliation credentials. Configure SLA-backed endpoints/tokens in the environment.
- The operations worker uses BullMQ for retryable document-expiry scans. Monitor failed jobs and Redis memory/latency; do not run Redis without persistence in production.
