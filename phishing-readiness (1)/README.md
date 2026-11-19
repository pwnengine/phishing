# Phishing readiness campaign

Self-hosted Node.js 22+ application, no npm dependencies. Microsoft-style sign-in simulation with a centered white card, four-color mark, Segoe UI type and blue sign-in button. Never proxies authentication, collects credentials, writes clipboard data, downloads files, or sends email. The simulation submits boolean field-presence indicators only; it does not authenticate with Microsoft.

## Start on Windows (PowerShell)

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:ADMIN_KEY = [Convert]::ToBase64String($bytes)
$env:ADMIN_KEY # Copy this to your password manager and the admin page.
$env:PUBLIC_BASE_URL = 'http://127.0.0.1:8080'
node server.mjs
```

Keep the generated ADMIN_KEY in your password manager before closing the shell. Open http://127.0.0.1:8080/admin and enter ADMIN_KEY. Add one email per line, generate links, and export CSV. Send each recipient only their own link through your approved campaign sender. The application sends nothing itself.

For persistent configuration, set ADMIN_KEY in your service manager's protected environment. Do not commit it. Restart with the same key; changing it invalidates previously issued visit receipts but preserves recipient links.

## How tracking works

Each enrolled email maps to an internal random 192-bit token. Public links now use ?email=employee%40nyecc.org. Only @nyecc.org recipients can be added; usernames entered in the dashboard get that suffix automatically. Add recipients before sending: unlisted addresses are rejected. Old token links still work. Email matching is case insensitive. Existing data/campaign.json and results are preserved when upgrading; keep your ADMIN_KEY and data directory. Shared NAT/public IP does not affect attribution. Initial page visits, form submissions, and boolean account/password presence are separate events. Fields are cleared before fetch; field values have no names, are never serialized, and are never read by the server. CSP blocks native form submission. The server accepts only an exact event schema and rejects extra fields. Password field uses autocomplete=new-password to discourage saved work-credential autofill; browser behavior can vary.

Presence flags are recorded on submission only, not on every keystroke. A filled field means it contained text; it does not establish that the text was a valid credential. Email parameters identify the address in the link, not verified people. Anyone can edit the email parameter to another enrolled address; use this for awareness trends, not verified attribution. URLs expose addresses in forwarded links, browser history and potential proxy logs. A forwarded link or sophisticated scanner may generate events. No IP addresses, user agents, analytics, external scripts, or request logs are collected by this app. Infrastructure in front of the app may have independent logs.

## Staff access / production

The default listener is localhost for testing. To serve staff, put it behind a maintained HTTPS reverse proxy and set PUBLIC_BASE_URL to the exact HTTPS origin. Set HOST=0.0.0.0 only inside a properly firewalled host/container. Restrict /admin and /api/admin/* to IT via VPN/proxy rules; the admin API also requires the secret. Do not expose Node's raw HTTP port to the internet. Do not add session replay, form analytics, request-body logging, or third-party scripts. Keep proxy body logging disabled.

This is a small single-process app: do not run multiple instances against the same JSON file. data/campaign.json holds recipient addresses and event metadata. Restrict filesystem permissions to IT/service account and back it up securely. No automatic retention deletion: after the agreed retention period, stop the app and remove the data directory (including backups); restarting creates a fresh empty campaign. Pause immediately from the admin dashboard when needed. Recipient links expire 30 days after creation; use a new data directory for a new campaign. Old links fail when the old database is no longer used.

Before rollout: verify approval and recipient scope, pilot with designated staff, confirm reporting instructions match your organization, and check mail scanners against the visit/submission distinction. No allowlisting or tenant security changes are made by this application.

## Verification

Run `npm test`. In-process HTTP-handler tests cover admin authorization, token mapping, visit/boolean submissions, rejection of credential-bearing payloads, campaign pause, and file persistence. Browser appearance, real network access and tenant scanner behavior require a pilot; these tests do not prove those.

## Presentation export

Click **Generate PowerPoint slide (PNG)** after loading the latest results. This downloads a 1920 x 1080 (16:9) aggregate chart. In PowerPoint select Insert > Pictures and insert the PNG. It is a slide-ready image, not an editable .pptx. Four bars show unique recipients with a visit, submission, account field filled on submission, and password field filled on submission. Repeated events do not inflate these counts. Percentages use all enrolled recipients as the denominator; enrollment is not confirmed delivery. Employee names are omitted from the slide. Export CSV retains individual details for authorized follow-up and includes personalized links for mail merge.

For a deadline presentation, clearly identify results as preliminary and state the campaign window. The app does not track reports of phishing, confirmed delivery or verified compromise. Scanners, forwarding and editable email URLs limit attribution.

## Selective GIF and music reveal

1. Copy skeleton-twerking.gif to public/media/reveal.gif.
2. Copy your supplied Subtronics MP3 to public/media/reveal.mp3.
3. Open /admin, enter the admin key, and Load results. Check that both media files are installed.
4. Set Music start (seconds) to the bass-drop timestamp and click Save cue time. Default 0 plays from the beginning; the application does not detect the drop automatically. A cue beyond the track length falls back to 0.
5. Check GIF + music beside only the intended employees. Changes save immediately. All employees default to the regular training message.

The GIF/music reveal runs only after a successful form submission. Opening a link never plays media. The final preference is checked on submission, so changes made after a page is opened still apply. If files are missing, the normal explanation appears. Fullscreen is requested from the submit gesture when the page already knows the recipient is selected; browser policy may refuse it. The GIF still fills the page. Sound may require Play music / fullscreen. Playback volume is 35%, is not looped, and stops after 15 seconds. Stop and view training or Escape stops the media and returns to the training message. Exiting fullscreen also stops playback. No keys or browser controls are trapped. HTTPS is needed for reliable Fullscreen API behavior.

Assets are not bundled: file transfer was unavailable in the build environment. Copy the two files above before launch. Alternatively MEDIA_DIR can point to a directory holding reveal.gif and reveal.mp3. The server tests cover recipient opt-in, missing-file fallback, cue settings, unauthorized changes and aggregate report generation. Actual browser fullscreen/audio playback has not been verified; pilot with a designated employee first.

Email URLs remain editable, so the preference follows the recipient address in the link, not an authenticated person. Reporting to IT is not tracked automatically; record those contacts separately if you want to measure reporting behavior. The app does not infer willingness to report from media playback.

Upgrade: keep your existing data folder and ADMIN_KEY; replace the app files and restart Node. Do not overwrite your data folder with a fresh database.
