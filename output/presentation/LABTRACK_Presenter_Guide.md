# LABTRACK presenter guide

Faculty presentation: 9 October 2026. Use the PowerPoint speaker notes or this script while rehearsing.

## Slide 1: LABTRACK

Opening: Good morning. LABTRACK is a laboratory inventory and equipment borrowing platform. It connects the people who borrow equipment with the assistants who issue it and the administrators who manage inventory. The central idea is simple: every physical unit should have an identity, and every loan should have a traceable record.

## Slide 2: The laboratory management problem

Frame these as the problems the project addresses, not findings from a measured campus survey. When inventory and borrowing records are separate, an assistant has to answer several questions manually. Is this unit available? Who took it? When is it due? A count of equipment alone cannot answer those questions.

## Slide 3: The LABTRACK solution

Pitch the value without promising measured savings. LABTRACK brings inventory and the borrowing lifecycle into one application. Students and faculty can see equipment and request it. Assistants manage handover and returns. Administrators manage labs, users and reports. The intended benefit is less repeated record keeping and clearer responsibility.

## Slide 4: Four roles, distinct responsibilities

Explain why four portals matter. Each role has different work to do, so the application shows different pages and the backend also checks permissions. Assistants work within assigned labs. Student and faculty history is scoped to their own activity. Faculty and assistant self-registration requires approval.

## Slide 5: Equipment models and individual units

Use an example: Arduino Uno is an equipment model. Three Arduino Uno boards are three units, each with its own asset ID, condition, status and current lab. The example is illustrative and is not a claim about actual stock. This distinction lets the system record which board a person borrowed rather than just reducing a generic count.

## Slide 6: Inventory import and QR labels

The application supports adding inventory and importing equipment spreadsheets. Every unit receives a unique asset ID and a QR label. The import batch records a content hash per lab so replaying a completed upload does not add the same stock again. The screenshot is existing browser verification evidence with synthetic data, not live inventory.

## Slide 7: Standard borrowing workflow

Walk through the normal student or faculty reservation. First the borrower chooses a model, quantity and dates. The request enters pending review. An authorized assistant or administrator reviews it for that lab. Approval does not itself mean the item has been physically handed over. At checkout, the assistant identifies the borrower and specific asset. The system creates an active loan. On return, the loan closes and the unit status changes.

## Slide 8: Counter issue and borrower identification

The assistant can scan or enter an institutional ID. Exact lookup resolves the registered borrower, including IDs such as 24CE555. The assistant then uses an approved request or the walk-in issue flow. Manual entry provides a fallback if camera scanning is unavailable. QR scanning helps identify an asset, but the backend still checks that it matches the requested model, lab and availability. Physical camera scanning still needs device validation.

## Slide 9: Returns and equipment condition

Returns preserve accountability. The assistant finds the active loan using the asset ID and records remarks. A normal return makes the unit available. In the current implementation, remarks containing damage-related words send the unit to maintenance. This is a simple keyword rule, not automated inspection. A multi-unit request reaches returned status when no active loans remain. Overdue is calculated from an active loan whose due date is in the past.

## Slide 10: Faculty event and club requests

Describe the current source implementation, which now accepts equipment types and quantities. Faculty select a lab, event details, return date and the required equipment quantities. The assigned active assistant reviews the request and chooses exact asset units. Allocation must match the requested models and quantities. Approval locks the request and units, rechecks stock and issues the batch in one transaction. A pending event request does not reserve stock. Rejection records a reason and leaves units available.

## Slide 11: Other equipment circulation flows

These workflows address different situations. Walk-in issue lets an assistant issue available equipment without a prior online reservation. Quick borrow serves short faculty loans with a due time at the end of the day. Inter-lab transfers use a pending and approved workflow, marking units in transit until the receiving assistant completes the transfer. The backend supports transfers, but the current frontend ownership/status display still needs reconciliation.

## Slide 12: System architecture

Describe the request path in plain terms. A user interacts with React pages. The shared Axios client calls FastAPI endpoints. FastAPI validates the request, checks the current user and runs workflow rules. SQLAlchemy queries PostgreSQL and commits changes. The API returns data to update the interface. Alembic manages schema changes. Email uses an optional persistent outbox rather than being required for a loan to succeed.

## Slide 13: Core database relationships

Explain the relational design. A department contains labs. An equipment model has many units. A request links a borrower to a model and quantity. A transaction links that borrower and request to one physical unit. Event requests and event issues connect batch loans to their faculty coordinator. Foreign keys maintain those relationships. Supporting records hold transfers, lab assignments, policies and notifications.

## Slide 14: Permissions and data integrity

Avoid calling the entire application production-secure. Describe concrete controls: passwords are hashed with bcrypt, JWT tokens carry identity and expiry, and the backend resolves the current active user. Endpoint permissions and assigned-lab checks limit operations. Asset counters allocate unique ranges. A database partial unique index prevents multiple active loans for one asset. Event approval uses row locks and a single database transaction. These controls reduce specific risks, while remaining bugs and deployment checks still need work.

## Slide 15: Transaction history and notifications

The transaction history is the traceability layer. A loan records the physical asset, borrower, lab and relevant dates. Portal notifications communicate workflow outcomes. Optional Gmail API or SMTP delivery uses a database queue with retries. Live email remains disabled until authorization and provider configuration are completed. The screenshot is test evidence and uses synthetic accounts.

## Slide 16: Reports and procurement suggestions

The reporting endpoints derive counts and trends from stored records. They report stock status, active and overdue loans, monthly borrowing and lab utilization. Procurement suggestions are rule-based. The current code suggests initial stock for an empty model, more units when utilization exceeds 80 percent, or additional stock when the count of pending requests exceeds available units. The pending metric counts requests, not total requested quantity. These are planning prompts, not machine-learning forecasts or automatic purchases.

## Slide 17: Current progress and remaining work

Be candid in the faculty evaluation. The current source contains inventory, borrowing, event approvals, reports and portal notifications. Repository verification reports document regression checks on disposable databases and successful builds. Those reports do not prove the latest working tree, every user journey or public deployment is complete. Known remaining work includes extension review integration, transfer display consistency, placeholder account/procurement actions and automatic overdue scheduling. Real email and physical camera scanning require external validation.

## Slide 18: Demonstration sequence

Use a prepared development database and accounts, not real users. First show inventory and an available unit. Switch to a student or faculty account and submit a standard request. Switch to the assigned assistant to approve and issue the unit. Show that the loan is active. Return the item and show its available status and transaction history. If time allows, show the faculty event request and assistant allocation. If a live screen fails, the verification screenshots in this deck provide a fallback. This is a proposed presentation sequence, not a claim that a fresh end-to-end rehearsal has run.

## Slide 19: The project’s contribution

Closing: LABTRACK demonstrates how a laboratory can connect inventory to the people and processes that use it. Its main contribution is traceability at the physical-unit level, with responsibilities separated across roles. The next step is to complete the remaining workflows and validate a small pilot with one lab. Do not claim that the pilot has already happened. Thank the faculty and invite questions.

## Likely faculty questions

**Is smart procurement AI?** The current implementation uses rules on stock, utilization and pending request counts. It does not train a prediction model.

**Why distinguish models from units?** A model describes an equipment type. A unit represents a physical item with its own tag, condition and current lab.

**Does approval hand over equipment?** Standard approval allows later counter checkout. Event approval also creates the batch issue and loans.

**Can the same asset have two active loans?** A database uniqueness constraint protects the active-loan relationship. Backend checks also validate availability.

**How does QR scanning help?** It identifies the unit or borrower. Backend checks still validate the operation. Manual input provides a fallback.

**What remains incomplete?** Extension review integration, transfer display and some placeholder actions need work. Email authorization, physical scanning and deployment require validation.

**What would you measure in a pilot?** Issue/return handling time, inventory mismatches, overdue rate and stock availability. These are proposed measures, not observed results.

## Before presenting

Open the deck in PowerPoint and use Presenter View for notes. Rehearse with prepared development accounts. Confirm PostgreSQL and both application servers are running if showing the live demo. Keep the deck open as the fallback. Do not display credentials or environment files.
