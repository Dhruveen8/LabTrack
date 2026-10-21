# Department approval workflow

Initial departments are CE (Computer Engineering), CSE (Computer Science Engineering), and IT (Information Technology). There is no department enable/disable setting. Admin can add departments and labs; registration reads existing departments.

HODs use faculty authentication and faculty capabilities, with an additional `is_hod` assignment. A database constraint permits one HOD per department. Admin assigns/removes HOD status in Users. Initial HODs are Dr. Nikita Bhatt (CE), Dr. Amit Thakkar (CSE), and Purvi Prajapati (IT).

## Routing

| Borrower / kind | Academic approval before lab assistant |
| --- | --- |
| Student standard, small equipment | Selected faculty from student's department |
| Student standard, flagged equipment | Selected faculty, then student's department HOD |
| Student walk-in | Selected faculty; flagged equipment is prohibited |
| Faculty standard, small equipment | None |
| Faculty standard, flagged equipment | Faculty's department HOD |
| Faculty event/club | Faculty's department HOD, regardless of item classification |
| Faculty quick borrow | None; flagged equipment is prohibited |
| HOD personal / event | None; assigned lab assistant approves and issues |
| Extensions | Assigned assistant; no additional academic approval |

Each lab assistant can manage multiple labs in their department. Admin assigns labs in Labs. Cross-department equipment requests still route to the borrower's department HOD, then to assistants responsible for the equipment's labs.

Assistants set `Requires HOD approval for new requests` on the equipment detail page. The requirement is copied into request items on submission, so changing it does not silently alter already submitted approvals.

## Reservations and mixed carts

Draft carts do not reserve stock. Submission locks and reserves exact units for every item atomically. If any quantity is unavailable, nothing is submitted and the cart is retained. Competing submissions cannot reserve the same unit. Submission keys prevent duplicate reservations after a lost response.

Faculty approves/rejects the whole request. If any item requires HOD approval, every unissued item waits for the HOD decision before reaching assistants. HOD approval sends all surviving items to assistants. HOD rejection rejects and releases only HOD-required items; the remaining items proceed to assistants. Assistants decide their own ready items and scan the exact reserved assets for checkout. Student walk-ins are submitted using the cart's walk-in option and fulfilled by reserved checkout after faculty approval; the direct counter endpoint cannot bypass this requirement.

Academic approvals share seven days from submission, without restarting when faculty approves. Requests containing HOD-required equipment start the surviving items' seven-day collection clock only after the HOD decision, including when rejected HOD-required items are removed. Requests without an HOD requirement start collection after faculty approval, or at submission when no academic approvals apply. Assistant approval does not restart that deadline. Both deadlines are capped by the return date. Quick borrow still ends at 23:59:59 India time on its selected day.

The Requests status column shows a summary and a Track request button. Tracking opens a keyboard-accessible dialog showing recorded decisions, approver names, timestamps, pending stages and collection progress. Dashboards contain counts only.

The minute-based worker releases expired unissued reservations, including events, and notifies the borrower. Issued units remain on loan. Borrowers can cancel unissued request items from Requests; issued equipment must be returned. Keep the backend running for automatic expiry. Decisions are enforced again on approval and checkout even if the expiry worker has not run yet.

## Local setup and backups

Migration: `j4e9f1a8b6c7` (after `i3d8e0f7a5b6`). Use `venv/Scripts/python.exe -m alembic upgrade head` from `backend`.

`backup_database.py` writes an ignored archive and SHA-256 manifest under `output/private-backups`, restores the archive into a disposable database, and removes the disposable database after verification. It currently locates PostgreSQL tools at `C:\Program Files\PostgreSQL\18\bin`.

`initialize_departments.py --backup <archive.dump> --reset-local-data` requires that verified manifest. It resets development data transactionally, retains administrators, and creates three HODs, six fictional faculty, three fictional assistants, six labs and 42 sample equipment units. It creates no students. It does not reset ID sequences. Sample inventory consists of USB cables, development boards, and HOD-required digital oscilloscopes in each lab.

Generated passwords are unique and stored only in ignored `output/private-setup/initial-accounts-*.json`. Test emails use `example.com` and have explicit domain exemptions; public registration retains university email restrictions. Local SMTP is disabled. Rotate the session signing key when resetting data; existing users must sign in again. Do not commit backup archives, private credentials or environment files.

## Verification

From backend, set `LABTRACK_CART_DB_TEST=1`, `LABTRACK_EVENT_DB_TEST=1`, `LABTRACK_EMAIL_DB_TEST=1`, then run `venv/Scripts/python.exe -m pytest tests -q`. API fixtures roll back; concurrent reservation tests clean up their own committed UUID-scoped fixtures. Workers do not send email during tests.

From the root: `npm run lint`, `npm run build`, `node --test tests/*.test.js`.
