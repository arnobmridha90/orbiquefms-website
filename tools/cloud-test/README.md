# Testing the real app's data layer without a server

`fake-supabase.js` stands in for supabase-js in memory. Build `fixture.js` from an import JSON
(`window.FIX = {rows, blobs, identity, next}`), make a copy of `app/s/index.html` that loads `fixture.js` and
`fake-supabase.js` instead of `config.js` and the real client, serve `app/` on port 8811, then run
`node t_cloud.js` (signs in, opens every screen, reports page errors) and `node t_write.js` (edits, photo upload,
deletes, booking-number clash).
