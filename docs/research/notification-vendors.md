# Which notification vendors fit Cadence's Channels?

Research for [#4](https://github.com/QHolmes/cohort-005-project-fork/issues/4) (map [#3 Notifications](https://github.com/QHolmes/cohort-005-project-fork/issues/3)). Researched 2026-11-12. Pricing and docs change often, so re-check any number here before relying on it.

Terms follow `GLOSSARY.md` → Notifications: **Notification**, **Channel** (Inbox, Push, Email, SMS), **Inbox**, **Push**, **Notification Category**, **Required Channel**, **Notification Preference**.

This document does not pick a vendor. That decision belongs to the later grilling ticket. It ends with a shortlist and the reasons for it.

## Criteria (from map #3 Notes)

- Hosted SaaS (no self-hosting), with a free or low tier to start.
- Must provide **Push**, meaning web push that works on an iOS Home Screen web app, on Android and on desktop.
- Should ideally provide **SMS** and an **Inbox** component or API.
- Must work with React Router and Node.
- Each Channel must be a separate module whose provider can be swapped on its own.
- Every Channel must work in local dev and in tests without vendor credentials, the same way the mailer falls back to `.outbox/`.
- Notification Categories need Notification Preferences and Required Channels (for example, Email for Payments).
- Existing Postmark transactional email should keep working.

---

## 1. Hard platform facts about web push (these apply to every option)

### Standards and mechanics

- Web push is built from three W3C/IETF standards: the Push API, the Notifications API and Service Workers. The app server signs each request with a **VAPID** key pair (RFC 8292) and encrypts the payload with the keys from the subscription (RFC 8291). The browser vendor chooses the push service, and the developer can't change it. Source: [web.dev, Push notifications overview](https://web.dev/articles/push-notifications-overview) (undated); [RFC 8292](https://datatracker.ietf.org/doc/html/rfc8292).
- A site needs an active service worker to receive pushes. `PushManager.subscribe()` returns a `PushSubscription` containing an endpoint and encryption keys. The endpoint is a capability URL, so it has to be kept secret, and the subscribe flow needs CSRF protection. MDN lists the Push API as Baseline "widely available" across browsers since March 2023. Source: [MDN, Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) (last modified 2025-05-28).
- Browsers do not allow silent push. Each push has to show a user-visible notification. The permission prompt has to come from a user gesture. Source: web.dev, above.
- Pushes can arrive while the site is closed: the service worker wakes up for them. If the device is offline, the push service queues the message until its TTL expires. Source: web.dev, above.

### iOS / iPadOS (the binding constraint)

- **Versions.** Web push works for **Home Screen web apps on iOS/iPadOS 16.4+** and for Safari 16+ on macOS 13+. Source: [Apple, Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers); [WebKit blog, Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) (2023-02-16).
- **Install required.** On iOS, Push only works after the person adds Cadence to the Home Screen (Share → Add to Home Screen) and opens it from that icon. A normal Safari or Chrome tab cannot subscribe. On iOS 16.4–18 this also needs a web app manifest with `display: standalone` or `fullscreen`. Without one, the icon is just a bookmark. Sources: WebKit 2023 post; [OneSignal, Web push for iOS](https://documentation.onesignal.com/docs/web-push-for-ios).
- **iOS 26 change.** In Safari 26, every site added to the Home Screen opens as a web app by default. The person can switch off "Open as Web App" in the add dialog. Cadence should still ship a manifest for the name, icons and start URL. Source: [WebKit, WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). The exact wording of the toggle comes from OneSignal's iOS doc and secondary coverage, not from Apple.
- **No install prompt on iOS.** There is no `beforeinstallprompt` event, so Cadence has to teach people the Share-sheet steps itself. If a person taps "Don't Allow", iOS won't ask again for that install until they remove the icon and add the site again. Source: OneSignal iOS doc (vendor doc, not Apple). Bears on the open map question "Push permission: when and how Cadence asks".
- **Permission needs a gesture.** Call the subscribe method straight from a click or tap handler. Source: Apple doc above.
- **No invisible pushes.** "Safari doesn't support invisible push notifications… If you don't [show one], Safari revokes the push notification permission for your site." Source: Apple doc above.
- **Payload limit.** Apple rejects payloads over **4 KB** (`PayloadTooLarge`). Messages are stored for at most 30 days according to TTL. Don't refresh the VAPID JWT more often than once an hour. Allow outbound traffic to `https://*.push.apple.com`. Source: Apple doc above.
- **No Apple Developer Program membership** is needed for web push. Source: Apple doc and WebKit 2023 post.
- **Badging.** `navigator.setAppBadge()` and `clearAppBadge()` work for Home Screen web apps, which suits an Inbox unread count. Source: Apple doc and WebKit 2023 post.
- **Declarative Web Push.** Added in iOS/iPadOS 18.4 for Home Screen web apps, and in Safari 18.5 on macOS. A JSON payload containing `"web_push": 8030` is shown without running any service-worker JavaScript. It is backwards compatible with classic web push. WebKit has proposed it to the specs, but no other engine has shipped it yet. Source: [WebKit, Meet Declarative Web Push](https://webkit.org/?p=16535) (2025-03-27). This is optional. Classic service-worker push still works.
- **EU.** In February 2024, Apple removed Home Screen web apps in the EU in the iOS 17.4 betas, then reversed that on 2024-03-01, so they still work in the EU. I found no later Apple change. Source: Apple's developer news post as reported by [MacRumors 2024-03-01](https://www.macrumors.com/2024/03/01/apple-walks-back-decision-to-disable-eu-web-apps/). I didn't open Apple's original notice, so treat this as secondary.

### Android and desktop

- Chrome, Firefox and Edge on Android and desktop support standard web push from a normal browser tab, with no install needed. Chrome requires `userVisibleOnly: true`. Sources: MDN Push API compatibility and web.dev. I didn't fetch a separate Chrome-for-Android page, so this rests on MDN's Baseline status.
- On desktop, a notification can arrive even when no Cadence tab is open (web.dev). Whether it arrives when the browser is fully quit depends on the OS and browser, and I didn't verify that.

### What this means for every option

Push on iPhones only reaches people who have installed Cadence to their Home Screen. That's true whichever vendor is used, because vendors deliver through the same Apple push service. Cadence will need a manifest, a service worker, an install-instructions UX for iOS, and a permission prompt triggered by a gesture. A vendor can't remove any of that.

---

## 2. Option-by-option

### Knock (knock.app)

- **Push.** The docs say Knock has **no first-party web push channel**. Browser push goes through **FCM** (the Firebase JS SDK with its `firebase-messaging-sw.js` service worker and a VAPID key) or through **OneSignal**. The push providers listed are APNs, FCM ("Android"), Expo, OneSignal and Amazon SNS. Sources: [Knock push overview](https://docs.knock.app/integrations/push/overview); [Knock tutorial, Sending web push with FCM](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm). Not verified: whether FCM's web SDK works inside an iOS Home Screen web app. [Firebase's web client doc](https://firebase.google.com/docs/cloud-messaging/js/client) says nothing about Safari or iOS.
- **SMS.** Bring your own provider, for example Twilio or Telnyx. [Knock integrations overview](https://docs.knock.app/integrations/overview).
- **Inbox.** Strong. In-app feed, an Inbox, toasts and a Preferences component in `@knocklabs/react` (0.15.1, published 2026-11-06). [Knock React UI](https://docs.knock.app/in-app-ui/react/overview).
- **Email via Postmark.** Yes, as a first-class integration ([Knock Postmark](https://docs.knock.app/integrations/email/postmark.md)). Knock doesn't bill for provider sends. You pay Postmark directly.
- **Categories and Required Channels.** The PreferenceSet holds `categories`, `channel_types`, `channels` and `workflows`. Unset values default to `true`. Required Channels: a workflow can **"Override recipient preferences"**, but that applies to the whole workflow, not to a single channel. To make Email required for Payments while Push stays optional, Payments would probably need separate workflows or steps. Source: [Knock preferences overview](https://docs.knock.app/preferences/overview). Not verified: a per-step "ignore preferences" option.
- **Local dev and tests.** Separate development and production environments, a built-in "Knock test" email channel, and workflow testing tools. All of them need an API key. There's no offline mode.
- **Node SDK.** `@knocklabs/node` 1.41.1 (2026-11-10).
- **Pricing** ([knock.app/pricing](https://knock.app/pricing), checked 2026-11-12). Free: 10,000 messages a month, with no hard cap (Knock contacts you when you exceed it) and Knock branding. Starter: $250 a month including 50,000 messages, then $0.005 each.
- **Lock-in.** Medium. Email and SMS providers are yours, but templates, workflows, preferences and Inbox history live in Knock.

### Novu Cloud (novu.co)

- **Push.** Providers: FCM, Expo, APNs, OneSignal, **Push Webhook**, Pusher Beams and Pushpad. Novu doesn't send VAPID web push itself. Browser push goes through FCM (web), OneSignal or Pushpad. **Push Webhook** POSTs an HMAC-signed JSON payload to a URL you own, so Cadence could do its own VAPID sending behind it. The docs don't describe that pattern, so this is an inference. Sources: [Novu push integrations](https://docs.novu.co/platform/integrations/push); [Push Webhook](https://docs.novu.co/platform/integrations/push/push-webhook).
- **SMS.** Bring your own provider. SMS is listed as a channel on Free.
- **Inbox.** `<Inbox />` from `@novu/react` (3.19.2, 2026-09-07), with a built-in Preferences view, real-time updates and headless hooks. Needs React 18+ and supports React 19. Subscriber auth uses HMAC (`subscriberHash`). [Novu Inbox overview](https://docs.novu.co/platform/inbox/overview).
- **Email via Postmark.** Yes, Postmark is one of 19 email providers. [Novu email integrations](https://docs.novu.co/platform/integrations/email).
- **Categories and Required Channels.** Preferences resolve in layers: workflow defaults, then the subscriber's global choices, then the subscriber's per-workflow choices. **"Mark as critical"** makes a workflow ignore subscriber preferences and hides it from the preferences UI. Like Knock, that works on the whole workflow, not a single channel. A Required Channel would need its own critical workflow. Novu has no grouping of several workflows into a Category, so Categories would map to workflows or tags (inferred). [Novu preferences](https://docs.novu.co/platform/concepts/preferences).
- **Local dev and tests.** A Dev environment is included. Still needs credentials.
- **Node SDK.** `@novu/api` 3.19.1.
- **Pricing** ([novu.co/pricing](https://novu.co/pricing), checked 2026-11-12). Free: 10,000 workflow runs a month, **5 workflows**, **24-hour Inbox feed retention** and 3 team members. Pro: from $30 a month for 30,000 runs, 20 workflows and 7-day retention, then $1.20 per 1,000 runs. Five workflows and one day of retention are tight for a real Inbox.
- **Lock-in.** Medium. Novu is open source, but self-hosting is out of scope here.

### Courier (courier.com)

- **Push.** The push providers listed are APNs, FCM, Expo, OneSignal, Airship, Amazon SNS, Pusher Beams, Pusher, MagicBell, Pushbullet, Beamer and NowPush. I found **no native web push or VAPID channel**. Browser push would go through FCM, OneSignal, Pusher Beams (which has a web mode) or MagicBell. [Courier push intro](https://www.courier.com/docs/external-integrations/push/intro-to-push.md).
- **SMS.** Bring your own provider.
- **Inbox.** Courier Inbox, toasts and a preferences component in `@trycourier/courier-react` (9.3.5, 2026-11-09). Users authenticate with a JWT minted on the server. [Courier React SDK](https://www.courier.com/docs/sdk-libraries/courier-react-web.md).
- **Email via Postmark.** Yes, with support for overriding the MessageStream and using Postmark templates. [Courier Postmark](https://www.courier.com/docs/integrations/email/postmark.md).
- **Categories and Required Channels.** Courier has Subscription Topics grouped into sections. A topic's default can be **Required** ("users can't opt out"). If channel selection is turned on for a section, people pick channels per topic. I found no way to lock just one channel inside a topic, which is what a Required Channel means. [Courier preference center guide](https://www.courier.com/docs/guides/build-a-preference-center.md). Not verified: per-channel locking in the Preferences Editor.
- **Local dev and tests.** A Test environment and key that work without a provider connected. **Test sends count toward the quota.**
- **Node SDK.** `@trycourier/courier` 10.0.0 (2026-10-29).
- **Pricing** ([courier.com/pricing](https://www.courier.com/pricing), checked 2026-11-12). Developer (free): 10,000 sends a month. Business: $0.005 per send for every send, including the first 10,000, so 50,000 sends cost $250. A multi-channel template counts as one send.
- **Lock-in.** Medium. Same pattern as Knock.

### OneSignal (onesignal.com)

- **Push.** Best-in-class **native web push**, including iOS Home Screen web apps, with detailed iOS guidance (see §1). OneSignal's own service worker (`OneSignalSDKWorker.js`) has to handle `push`. Only one service worker can control a scope, so a Cadence service worker has to be merged with it. [OneSignal iOS web push](https://documentation.onesignal.com/docs/web-push-for-ios). React wrapper: `react-onesignal` 3.5.6.
- **SMS.** "Available" on paid plans, with pricing through sales.
- **Inbox.** **None for the web.** OneSignal's own guide says it "does not currently store the history of messages sent to each individual user". You build a feed from Event Streams and the REST API. [OneSignal, Create an activity feed](https://documentation.onesignal.com/docs/en/create-an-activity-feed.md). This may be out of date. Re-check.
- **Email via Postmark.** **No.** OneSignal sends email itself or through SendGrid, Mailgun or Mandrill. [OneSignal email setup](https://documentation.onesignal.com/docs/en/email-setup.md).
- **Categories and Required Channels.** I found no built-in model for per-category, per-channel Notification Preferences. It's built around tags, segments and subscriptions, so Cadence would build preferences itself.
- **Local dev and tests.** Needs a real app ID. Web push also needs an HTTPS origin, or localhost.
- **Node SDK.** `@onesignal/node-onesignal` 5.20.0.
- **Pricing** ([onesignal.com/pricing](https://onesignal.com/pricing), checked 2026-11-12). Free: 10,000 web push subscribers per send, 10,000 emails a month, and mobile push and in-app for up to 1,000 MAU. Growth: from $19 a month, then $0.004 per web push subscriber and $1.50 per 1,000 emails.
- **Lock-in and fit.** A strong **Push-only provider** behind Cadence's Push Channel, and a poor fit as the whole stack.

### MagicBell (magicbell.com)

- **Push.** **Native web push.** You configure a VAPID key pair on the Web Push channel and register the browser's `PushSubscription` endpoint and keys with `PUT /v2/channels/web_push/tokens`. That is standard web push, so it should reach iOS Home Screen web apps, but the docs don't say so. Mobile push uses APNs, FCM or Expo. [MagicBell Web Push](https://www.magicbell.com/docs/channels/web_push).
- **SMS.** Twilio only.
- **Inbox.** React, Preact, Svelte and Web Components inbox libraries. `@magicbell/react` 1.14.0 (2026-07-29).
- **Email via Postmark.** Not listed. MagicBell supports SES, Mailgun, SendGrid and **SMTP**. Postmark has an SMTP interface, so it could probably be used through SMTP. That's inferred, not verified.
- **Categories and Required Channels.** Categories have per-channel preferences (`/notification_preferences`). I couldn't confirm a way to force a channel. Details come partly from third-party mirrors of the API, so verify them.
- **Local dev and tests.** Needs credentials.
- **Node SDK.** `magicbell` 4.5.1.
- **Pricing** ([magicbell.com/pricing](https://www.magicbell.com/pricing), checked 2026-11-12). Builder (free): **1,000 deliveries a month**, and each channel counts as a separate delivery. Startup: $249 a month for 50,000 deliveries, then $0.0025 each. The free tier is the smallest of all the vendors.

### SuprSend (suprsend.com)

- **Push.** **Native web push.** `suprSendClient.webpush.registerPush()` with a VAPID key and a service worker that loads SuprSend's script from a CDN. I found no SuprSend-specific iOS guidance. [SuprSend JS web push](https://docs.suprsend.com/docs/js-webpush).
- **SMS.** Bring your own provider (Twilio, MessageBird, Gupshup and others).
- **Inbox.** An embeddable React inbox and a headless one (`@suprsend/react` 1.5.0). [SuprSend React inbox](https://docs.suprsend.com/docs/react-inbox-integration.md).
- **Email via Postmark.** Yes. A Postmark vendor guide exists ([docs.suprsend.com/docs/postmark](https://docs.suprsend.com/docs/postmark.md)).
- **Categories and Required Channels.** **The closest match to Cadence's domain model.** Notification Categories are grouped into sections, and per-category `opt_out_channels` lets a person drop individual Channels. A category can be **"Can't Unsubscribe"** with **"Mandatory Channels"** that users can't opt out of, which is exactly a Required Channel. Default preferences can be set per category. [SuprSend user preferences](https://docs.suprsend.com/docs/user-preferences).
- **Catch.** The pricing table shows Channel Preferences, Categories and the preference-centre UI only on **Business ($250 a month)**. Free and Essentials show "—" for them. Re-confirm, because the table didn't render cleanly as text.
- **Local dev and tests.** Staging and production workspaces. Needs credentials.
- **Node SDK.** `@suprsend/node-sdk` 1.15.1 (2026-05-19).
- **Pricing** ([suprsend.com/pricing](https://www.suprsend.com/pricing), checked 2026-11-12). Free: 10,000 notifications a month, and each channel counts separately. Essentials: $100 a month for 50,000. Business: $250 a month for 50,000. There's a startup discount programme.

### Build it ourselves (standard Web Push + own Inbox + Postmark + SMS provider)

- **Push.** The `web-push` npm package (4.0.0, published 2026-11-06, MPL-2.0, Node ≥ 16) handles VAPID signing and RFC 8291 encryption. Cadence stores one row per `PushSubscription` (endpoint, `p256dh`, `auth`) for each person and device. It deletes the row when a send gets **410** (expired) back. It keeps payloads under 4 KB and always shows a notification from the service worker. This works the same everywhere: Apple, Google (FCM) and Mozilla endpoints all speak the same protocol (Apple doc, §1). Cost: **$0**. No vendor.
- **Inbox.** A Drizzle/SQLite `notifications` table with read/unread state, rendered by Cadence's own React Router routes. Freshness, whether refresh-on-navigation or SSE, is the open map question. Cost: $0.
- **Email.** The existing Postmark mailer, with its `.outbox/` fallback, becomes the Email Channel as it is.
- **SMS.** Twilio direct: $0.0083 per US segment plus a carrier fee of $0.0035–0.005, and $1.15 a month for a long-code number. **US A2P 10DLC registration** is required, with onboarding fees not listed on the pricing page. [Twilio US SMS pricing](https://www.twilio.com/en-us/sms/pricing/us) ("current as of October 2026"). `twilio` 6.3.0.
- **Categories and Required Channels.** Modelled exactly as the glossary describes, because Cadence owns the code.
- **Local dev and tests.** Trivial. Each Channel gets an outbox-style adapter (`.outbox/push/`, `.outbox/sms/`). The Inbox is just the local DB.
- **Cost of ownership.** Cadence builds and maintains the service worker, subscription storage, expired-endpoint cleanup, retries, the preference UI and Inbox UI, and any batching or digesting. Digesting is listed as not yet specified on the map.
- **Lock-in.** None. Every Channel is swappable by construction.

---

## 3. Comparison table

| Criterion | Knock | Novu Cloud | Courier | OneSignal | MagicBell | SuprSend | Build ourselves |
|---|---|---|---|---|---|---|---|
| Native web push (VAPID) | No (FCM or OneSignal) | No (FCM, OneSignal, Pushpad, or Push Webhook to own sender) | No (FCM, OneSignal, Beams, MagicBell) | **Yes**, with iOS guidance | **Yes** (VAPID) | **Yes** (VAPID) | **Yes** (`web-push`) |
| iOS Home Screen web app Push | Via FCM or OneSignal (FCM on iOS unverified) | Via provider | Via provider | **Documented** | Implied by standard protocol, not documented | Implied, not documented | Yes (Apple doc) |
| SMS | BYO provider | BYO provider | BYO provider | Paid plans, through sales | Twilio | BYO provider | Twilio direct |
| Inbox: React component | **Yes** (feed, Inbox, preferences) | **Yes** (`<Inbox />` plus Preferences) | **Yes** | **No** (build your own) | Yes | Yes (embeddable and headless) | Build it |
| Email through Postmark | **Yes** | **Yes** | **Yes** | **No** | SMTP only (inferred) | **Yes** | **Yes** (existing) |
| Categories plus per-Channel Preferences | Yes | Workflow-level (no grouping) | Topics plus per-channel | No built-in model | Yes | **Yes** (Business plan) | Yes (own) |
| Required Channel (one Channel locked, others optional) | Whole-workflow override only | Whole-workflow "critical" only | Whole-topic "Required" only | No | Unverified | **"Mandatory Channels"** | Yes (own) |
| Local dev without credentials | No (dev env needs a key) | No | No (test sends count toward quota) | No | No | No | **Yes** |
| Node SDK | `@knocklabs/node` | `@novu/api` | `@trycourier/courier` | `@onesignal/node-onesignal` | `magicbell` | `@suprsend/node-sdk` | `web-push`, `postmark`, `twilio` |
| Free tier | 10,000 messages/mo | 10,000 runs/mo, 5 workflows, 24 h feed | 10,000 sends/mo | 10,000 web push subscribers per send, 10,000 emails | **1,000** deliveries/mo | 10,000 notifications/mo (no preferences) | $0 (plus SMS cost) |
| First paid tier | $250/mo | $30/mo | $0.005 per send | $19/mo plus usage | $249/mo | $100/mo, or **$250/mo for preferences** | n/a |
| Lock-in per Channel | Medium | Medium | Medium | Low if used for Push only | Medium | Medium | None |

"No" for local dev means the vendor has a sandbox or dev environment but every call still needs an API key. Whichever vendor is chosen, Cadence's own Channel seam needs a local adapter, like `.outbox/`, to meet the map's no-credentials rule.

---

## 4. Observations

1. **No hosted vendor meets the no-credentials rule.** Cadence needs a local adapter for every Channel in any case. Once it has a Channel seam, the extra cost of owning a Channel itself is mostly the UI and the bookkeeping.
2. **Push is the cheapest Channel to own and the one most often outsourced to a second vendor.** Knock, Novu and Courier don't send web push themselves, so pairing one of them with FCM or OneSignal adds a second dependency, a vendor service worker and, for FCM, a Google project. Standard VAPID push from Node is one small library, and the iOS install constraint is the same either way.
3. **Required Channel is the sharpest domain test.** Of the vendors, only SuprSend has it natively ("Mandatory Channels"), and only on its $250-a-month plan according to the pricing table. Knock, Novu and Courier force delivery for a whole workflow or topic, so a Required Channel would mean splitting workflows.
4. **Inbox is where a vendor saves the most work** (Knock, Novu, Courier, SuprSend). The free tiers have limits, such as Novu's 24-hour feed retention, and Cadence's Inbox data would then live with the vendor. That bears on the open "data model" question.
5. **OneSignal and MagicBell fit poorly as the whole stack.** OneSignal has no web Inbox and doesn't route email through Postmark. MagicBell has a 1,000-delivery free tier and no Postmark integration. OneSignal is still a credible **Push-only** provider behind the Push Channel.

## 5. Shortlist (for the grilling ticket; not a decision)

1. **Build it ourselves**, at least for Push and Inbox: Postmark for Email as today, `web-push` with VAPID for Push, an own Inbox table, and Twilio for SMS if SMS survives. This fits "separate, swappable Channels" and the local-dev rule most directly. It costs $0 apart from SMS, and models Required Channels exactly. The cost is building the Inbox and Notification Preferences UI.
2. **Knock** (or **Novu** as a cheaper alternative) as an orchestration and Inbox layer **behind Cadence's own Channel seam**. Push would still be self-sent or come from FCM or OneSignal. Choose this if the prebuilt Inbox and Preferences UI is worth vendor-held data and working around Required Channels. Knock is strong on React components and has a 10,000-message free tier, but the next step is $250 a month. Novu starts paid plans at $30 a month, but its free tier is weak (5 workflows, 24 h feed).
3. **SuprSend**, if native Required Channels and Notification Categories outweigh the $250-a-month Business plan that preferences seem to need.

OneSignal is worth keeping in mind only as a swap-in **Push** provider. Courier works but adds nothing here over Knock. MagicBell's free tier is too small.

## 6. Not verified / open

- Whether FCM's web SDK delivers to iOS Home Screen web apps. Firebase's doc is silent. This matters for the Knock, Novu and Courier push paths.
- Whether MagicBell and SuprSend web push has been tested on iOS Home Screen web apps. Their docs are silent, though the protocol is standard.
- SuprSend's plan gating for preferences, because the pricing table rendered ambiguously.
- Knock and Courier per-channel locking. Knock's per-step preference overrides and Courier's Preferences Editor may support it.
- The MagicBell preference API shape, which came partly from third-party mirrors.
- Desktop delivery when the browser is fully closed. This varies by OS and browser.
- Twilio A2P 10DLC fee amounts.
- The repo's `package.json` lists `react-router` 8.3.0 and React 19 (the brief said v7). All the React SDKs above say they support React 18+ or 19. None depend on React Router.
