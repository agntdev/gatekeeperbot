# GroupGuard — Bot specification

**Archetype:** community

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot that automates community moderation by welcoming new members, verifying humans, preventing spam, and providing admins with simple controls and logs. The bot explains every action, supports customizable welcome messages and rules, and tracks moderation activity over time.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Telegram group admins
- Community moderators

## Success criteria

- Automated verification of new members with configurable timeout
- Effective spam detection based on simple heuristics
- Admins can issue warnings, mutes, kicks, and bans via simple commands
- Audit log of all moderation actions is maintained and accessible
- All automated actions are explained with clear messages

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu for admins or show welcome message for new members
- **I'm human** (button, actor: user, callback: verify:confirm) — Confirm verification for new members
- **/warn** (command, actor: admin, command: /warn) — Issue a warning to a user with a reason
- **/mute** (command, actor: admin, command: /mute) — Mute a user for a specified duration with a reason
- **/kick** (command, actor: admin, command: /kick) — Remove a user from the group with a reason
- **/ban** (command, actor: admin, command: /ban) — Ban a user from the group with a reason
- **/trust** (command, actor: admin, command: /trust) — Mark a user as trusted (exempt from verification)
- **/untrust** (command, actor: admin, command: /untrust) — Remove trusted status from a user
- **/setwelcome** (command, actor: admin, command: /setwelcome) — Edit the welcome message and rules via a guided flow
- **/setauto** (command, actor: admin, command: /setauto) — Configure automatic actions and thresholds via guided prompts
- **/log** (command, actor: admin, command: /log) — Show the last n moderation actions
- **/stats** (command, actor: admin, command: /stats) — Show overview of joins, verifications, and removals over a selected period

## Flows

### New member verification
_Trigger:_ user joins group

1. Post welcome message with verification button
2. Wait for verification button tap or timeout
3. If verified: mark as verified and allow posting
4. If timeout: remove user and post explanation

_Data touched:_ Member, Pending verification

### Spam detection and moderation
_Trigger:_ user sends message

1. Check for spam signals (new account links, repeated messages, rapid bursts)
2. If threshold crossed: apply configured automatic action (warn, mute, kick)
3. Post explanation message for the action

_Data touched:_ Infraction, Admin settings

### Admin command execution
_Trigger:_ /warn, /mute, /kick, /ban, /trust, /untrust, /setwelcome, /setauto, /log, /stats

1. Parse command and parameters
2. Validate admin permissions
3. Execute action (warn, mute, kick, ban, trust, untrust, set welcome, set auto, show log, show stats)
4. Log action in audit log
5. Post confirmation or result message

_Data touched:_ Infraction, Admin settings, Audit log

### Audit log and stats
_Trigger:_ /log or /stats

1. Retrieve relevant log entries or stats
2. Format and display to admin

_Data touched:_ Audit log

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Member** _(retention: persistent)_ — A group participant with verification status and trust flag
  - fields: user id, username, join time, verification status, trust flag
- **Pending verification** _(retention: ephemeral)_ — Temporary record for new joins awaiting verification
  - fields: user id, join time, timeout
- **Infraction** _(retention: persistent)_ — Record of automated or manual moderation actions
  - fields: actor, target, reason, timestamp, expiry
- **Admin settings** _(retention: persistent)_ — Configurable thresholds and toggles for automatic actions
  - fields: verification timeout, spam thresholds, automatic action sequence, notification settings
- **Audit log** _(retention: persistent)_ — Chronological list of moderation actions
  - fields: action, actor, target, reason, timestamp

## Integrations

- **Telegram** (required) — Bot API messaging and group management
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure verification timeout
- Set spam thresholds
- Define automatic action sequence
- Edit welcome message and rules
- Adjust notification settings
- Manage trusted users
- View audit log and stats

## Notifications

- Summary of critical events posted to group
- Private daily summary sent to owner
- Explanation messages for automated actions

## Permissions & privacy

- Only admins can execute moderation commands
- Audit log is accessible only to admins
- User data is stored securely and retained according to configured policies

## Edge cases

- User joins and leaves before verification timeout
- Multiple spam triggers in a single message
- Admin attempts to modify settings without proper permissions
- Verification timeout changes mid-verification
- Audit log exceeds retention period

## Required tests

- Verify new member verification flow with timeout
- Test spam detection with various message patterns
- Validate admin command execution and logging
- Ensure audit log and stats display correctly
- Confirm notification behavior for critical events

## Assumptions

- Admins will configure spam thresholds appropriately for their community
- Trusted users will be marked intentionally by admins
- Audit log retention period is sufficient for most use cases
- Explanation messages are clear and helpful to users
