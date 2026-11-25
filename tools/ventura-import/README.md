# Moving Ventura onto Orbique FMS

Ventura becomes an FMS subscriber company. Its data is copied from a **backup copy**, never from the live server.

1. **Restore a copy.** From a Ventura backup take `db-ventura-<STAMP>.sql.gz` and load it into a local MySQL/MariaDB:
   `zcat db-ventura-<STAMP>.sql.gz | mysql ventura_copy`. Unpack `media-<STAMP>.tar` into `media/` and
   `media-private-<STAMP>.tar` into `media_private/` next to each other.
2. **Export.** `python ventura_export.py --mysql mysql://user:pass@127.0.0.1:3306/ventura_copy --out out/ventura-fms.json`
   It only reads. It prints row counts and money totals for both sides and every row that needed a decision.
3. **Make the SQL.** `python fms_load.py out/ventura-fms.json --slug ventura --name "Ventura" --out out/sql`
4. **Load** the files in `out/sql/` in name order into the FMS database (psql, or the Supabase SQL tools).
   Every statement is an upsert, so loading again updates rows instead of making copies.
5. **Check.** Run `verify.sql` and compare with the export's report: same row counts, same money per payment kind,
   same expenses total, booking numbers unchanged (VEN-00001 stays VEN-00001).
6. **Files.** Upload the photos and documents listed in the export's `files` to the `company-files` bucket under
   `<company id>/<path>` (records point at them as `file:<path>`).

Rehearsal: the same steps run first on a copy of Ventura made from its own made-up demo data
(`seed_demo.py` in the Ventura reference), loaded as the company `ventura-rehearsal`.

Not moved: Ventura passwords (staff set new ones), the WhatsApp access token (connect again), GPS position history.
