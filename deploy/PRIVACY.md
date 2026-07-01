# Privacy

This directory is built to be used by people who may be at risk — including
undocumented people, people fleeing violence, and people experiencing
homelessness. For them, a record of what they searched for can be dangerous. The
project is designed to keep as little as possible, and this document is honest
about what that means and where the limits are.

## What the app does NOT collect

- **No accounts.** There is no sign-up, no login for people looking for help.
- **No analytics or trackers.** No Google Analytics, no third-party scripts, no
  tracking pixels, no cookies for visitors.
- **No search logging.** The server does not write a log of API requests, so it
  does not record who looked up what, or from which IP.
- **No third-party map calls that identify the user to Google.** Maps use
  OpenStreetMap tiles, not Google Maps.
- **Location stays on the device.** Your browser's geolocation is used in the
  page to sort services by distance. It is sent to this server only as
  coordinates in a request to find nearby services — not stored — and you can
  decline the location prompt and still use the app.

## What the recommended deploy hardens

- The Caddy TLS config (`deploy/Caddyfile`) sets `log { output discard }`, which
  turns off the web server's access logs. By default Caddy writes a line per
  request (with IP and path) to stdout, which Docker captures — this disables
  that.
- `Referrer-Policy: no-referrer` is set both as an HTTP header and an HTML meta
  tag, so when someone taps "Directions" or an organization's website, the
  destination site is not told they came from this directory.

## Honest limits (things a deployer still controls)

- **Your hosting provider can see traffic.** Even with app and Caddy logs off,
  your VM provider and network can observe connections at the infrastructure
  level. Choose a provider you trust, and consider that metadata (that *someone*
  connected) can exist even when content and content-logs do not.
- **TLS protects data in transit, not the fact of the connection.** HTTPS hides
  *what* is requested from a network observer, but not *that* a connection to
  your domain happened. A domain name like `help-<yourtown>.org` is itself
  information; some deployers may prefer a neutral name.
- **The admin editor authenticates with a password.** Admin actions are gated;
  keep `ADMIN_PASSWORD` strong and only share it with trusted verifiers.
- **This is not anonymity software.** For threat models requiring strong
  anonymity, people should also use Tor Browser; this project protects the
  service's own footprint, it can't protect the whole network path for them.

## For deployers serving at-risk communities

- Keep the defaults (logs off, no-referrer). Don't add analytics.
- Don't put a CDN or proxy in front that logs requests unless you trust it and
  configure it not to.
- Verify data with providers, and take down or flag records that could lure
  people to a place that is no longer safe.
- If you collect anything at all (e.g. an email list), say so plainly and keep
  it minimal and separate.

The goal is simple: a person should be able to find help here without leaving a
trail that could be used against them.
