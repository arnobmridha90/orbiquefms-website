# Ventura → FMS sync (one way, every 5 minutes)

`ventura_sync.py` runs on Ventura's server from cron. It reads Ventura's database with a login that can only SELECT,
maps it with `../ventura-import/ventura_export.py` (the same mapping as the first import), and sends only what changed to
the FMS company (Supabase REST, service key). Photos and documents go up a few hundred MB per run until all are there.
Ventura's app, database and files are never changed. In FMS the company is view-only (`identity.mirror`, status `paused`).

Test without a server: `python3 fake_fms.py &` (port 8799), then run the script against a local MySQL copy with a config
whose `FMS_URL=http://127.0.0.1:8799` and `FMS_SERVICE_KEY=svc`; `curl 127.0.0.1:8799/dump` shows what arrived.

Install, switch off and undo steps are in INSTALL.md (given to the owner one step at a time; needs his go-ahead).
