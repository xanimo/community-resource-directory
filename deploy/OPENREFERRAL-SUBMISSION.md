# Getting listed with Open Referral

There's no automated submission form. Open Referral's "Technology Overview" page
(the catalog of ecosystem tools) is curated by hand, and the way onto it is a
human introduction. Their docs repeatedly say the same thing: *"If you're
interested in deploying or helping to develop such tools, we want to hear from
you."* So "registering" = introducing the project to the right people.

## Where to send it (pick one or more)

- **Email:** info@openreferral.org (general) and/or bloom@openreferral.org
  (Greg Bloom, founder/lead organizer — he curates the site).
- **Community Forum:** https://forum.openreferral.org — post in the tools/
  "Show and Tell" area. Public, so it also reaches implementers directly.
- **Slack:** the Open Referral Slack (invite link is on openreferral.org).

The forum post is the highest-leverage single action: it's public, searchable,
and the people who'd actually deploy this read it. Email Greg in addition if you
want to be added to the Technology Overview page specifically.

## What they'll want to know (and why this project fits)

Open Referral prioritizes tools that are open source, HSDS-native, and reusable
by anyone. This project checks all three, plus fills a real gap: nothing in
their current catalog is "clone, `docker compose up`, HTTPS in 15 minutes." The
closest tool (ORServices) needs a LAMP stack and was last updated in 2024.

## Ready-to-send intro (email or forum post)

> **Subject: New open-source, HSDS-native resource directory — deploy in minutes**
>
> Hi Open Referral team,
>
> I've built an open-source community resource directory and I'd love to have it
> considered for your Technology Overview / ecosystem catalog.
>
> **Community Resource Directory** — https://github.com/xanimo/community-resource-directory
>
> It's a self-hostable "find help near you" app in the lineage of Link-SF and
> Ohana Web Search, built HSDS-native from the ground up:
>
> - **Imports** real HSDS/OpenReferral data (both the 3.x JSON and the tabular
>   CSV datapackage serializations).
> - **Exports** back out as valid HSDS (round-trip verified), with categories
>   mapped to the **Open Eligibility** taxonomy — so it's a full data citizen,
>   not a silo.
> - **Deploys in ~15 minutes**: one Node file + SQLite, no framework, no build
>   step. `docker compose up` gives you automatic HTTPS via Caddy/Let's Encrypt,
>   or there's a bare-VM installer.
> - Mobile-first UI (distance-sorted cards + map, no Google dependency — uses
>   OpenStreetMap), with a password-gated admin editor for verifying records.
>
> The design goal was radical deployment simplicity — something a small
> community or a single volunteer can stand up and maintain without a devops
> team. It currently ships with a Bay Area seed (flagged for local
> verification).
>
> Everything's MIT/open source. I'd welcome feedback, and I'm happy to adapt it
> to fit however you catalog tools. Thanks for stewarding HSDS — building on it
> was the easy part precisely because the spec and tooling are so solid.
>
> [your name]
> [optional: your GitHub @xanimo, your Bandcamp/site, or just leave contact as the repo]

## Before you send — a 3-minute checklist

These make the project look as credible as it is. Worth doing first:

- [ ] **Add a LICENSE file** if there isn't one. Open Referral specifically
      wants open-source tools; they favor CC-BY-SA for content and standard
      OSI licenses (MIT/Apache) for code. Without a license file, others legally
      can't reuse it — which undercuts the whole pitch. `MIT` is the simplest.
- [ ] **Make sure the README's first screen** says what it is in one line and
      shows the `docker compose` quickstart. (It does.)
- [ ] Optional but strong: a **live demo URL** (your VM deploy) so they can
      click it, and a screenshot in the README.
- [ ] Optional: mention it's **HSDS 3.x** specifically (they're on 3.2 now).

## After you're listed

Being in the Technology Overview is free, durable distribution to exactly the
2-1-1s, counties, and civic-tech volunteers who need this. Expect it to be slow
and human — a reply from Greg or a forum thread, not an instant listing. If a
pilot community bites, Open Referral actively supports deployment; that's the
path from "a tool" to "a tool someone's actually running."
