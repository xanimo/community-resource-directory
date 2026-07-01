# Why this exists

This is a directory of survival resources — food, shelter, showers, medical
care, legal aid, and rapid-response networks — that anyone can stand up for
their own community in an afternoon, and that nobody can take away.

The idea is simple: care delivered directly, with no means test, no gatekeeping,
and no charity-model condescension. Meet people's needs now, and build the
capacity of communities to meet their own needs. It draws on a long tradition of
community survival programs — mutual-aid efforts that treat food, shelter, and
legal help as things people deserve, not favors to be earned. This tool is a
small piece of infrastructure in that spirit. Not a startup, not a service you
depend on us for. A blueprint you copy.

## What that means in the code

- **It runs anywhere, on almost nothing.** One Node file and a SQLite database.
  No framework, no build step, no cloud account. `docker compose up` and it's
  live with HTTPS. A single volunteer can host it.
- **It doesn't watch the people who use it.** No analytics. No trackers. No
  Google. The map is OpenStreetMap. The server keeps no logs of who searched
  for what, and the recommended deploy turns off web-server access logs too —
  because for someone at risk, a record of "who looked up the deportation-
  defense hotline, from what IP, at what time" is itself a danger. See
  `deploy/PRIVACY.md`.
- **It speaks more than one language.** English and Spanish out of the box; the
  translation table is a single object anyone can extend.
- **It's honest about its data.** Every bundled record is flagged for local
  verification. A wrong address on a survival directory sends someone to a
  locked door. Verification is a human act of care, not a scrape.
- **It's yours.** MIT licensed. Fork it, rename it, strip out what you don't
  need, add what you do. No attribution theater required (though it's kind).

## Fork me

If you organize in a community — a mutual-aid network, a rapid-response
coalition, a tenants' union, a church basement — this is meant for you to take
and run. Clone it, load your own local resources through the admin editor or an
HSDS import, deploy it on a $5 VM or a spare machine, and share the link. You
don't need our permission and you don't need to tell us.

If you want to make it better for everyone, contributions are welcome. Things
that would help most: more languages, more verified regional data, accessibility
improvements, and offline/low-bandwidth support for people on cheap phones and
weak connections.

## What this is not

This is not a surveillance tool and must not become one. It maps *help* — the
locations of services and the phone numbers of people who assist. It does not
and will not track the movements or locations of law enforcement or anyone else.
Keep it that way in your fork. The strength of survival infrastructure is that
it protects people; the moment a tool starts tracking people, it can be turned
against the very communities it was meant to serve.

Build the thing that helps. Give it away. That's the whole idea.
