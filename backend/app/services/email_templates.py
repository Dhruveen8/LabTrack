"""LabTrack multipart content. Escape all database text before embedding HTML."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from html import escape
import math

IST = timezone(timedelta(hours=5, minutes=30), name='IST')


@dataclass(frozen=True)
class EmailContent:
    subject: str
    text: str
    html: str


def date_time(value):
    if value is None:
        return 'Not available'
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(IST).strftime('%d %b %Y, %I:%M %p IST (UTC+05:30)')


def duration(delta):
    minutes = max(1, math.ceil(max(0, delta.total_seconds()) / 60))
    days, minutes = divmod(minutes, 1440)
    hours, minutes = divmod(minutes, 60)
    parts = []
    for count, unit in [(days, 'day'), (hours, 'hour'), (minutes, 'minute')]:
        if count:
            parts.append(f'{count} {unit}{"s" if count != 1 else ""}')
    return ', '.join(parts)


def branded_email(subject, name, intro, sections, notice, *, warning=False):
    greeting = f'Hello {name.strip() if name and name.strip() else "there"},'
    text_sections = []
    html_sections = []
    for heading, fields in sections:
        text_sections.append(heading + '\n' + '\n'.join(f'{label}: {value}' for label, value in fields))
        rows = ''.join(
            f'<tr><td class="label" style="padding:10px 14px;border-bottom:1px solid #e2e8f0;'
            f'color:#475569;width:38%;vertical-align:top;font-weight:600">{escape(label)}</td>'
            f'<td class="value" style="padding:10px 14px;border-bottom:1px solid #e2e8f0;'
            f'color:#0f172a;vertical-align:top;overflow-wrap:anywhere;word-break:break-word">{escape(str(value))}</td></tr>'
            for label, value in fields)
        html_sections.append(
            f'<h2 style="font-size:16px;line-height:24px;margin:24px 0 10px;color:#0f172a">{escape(heading)}</h2>'
            f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
            f'style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0">{rows}</table>')
    text = '\n\n'.join([greeting, intro, *text_sections, notice,
                         'LabTrack · Laboratory equipment management\nThis is an automated notification.'])
    accent = '#b45309' if warning else '#2563eb'
    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(subject)}</title><style>
@media only screen and (max-width:480px) {{
 .outer {{padding:12px 4px !important}} .content {{padding:24px 18px !important}}
 .label,.value {{display:block !important;width:auto !important}}
 .label {{padding-bottom:2px !important;border-bottom:0 !important}}
 h1 {{font-size:23px !important}}
}}
</style></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">{escape(intro)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f1f5f9">
<tr><td class="outer" align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:12px">
<tr><td style="padding:22px 28px;background:#0f172a;border-radius:12px 12px 0 0;color:#fff;font-size:24px;font-weight:700">LabTrack
<div style="font-size:12px;line-height:20px;font-weight:400;color:#cbd5e1">Laboratory equipment management</div></td></tr>
<tr><td class="content" style="padding:28px;line-height:1.6">
<h1 style="font-size:26px;line-height:1.3;margin:0 0 24px;color:#0f172a">{escape(subject)}</h1>
<p style="margin:0 0 16px;font-weight:600">{escape(greeting)}</p>
<p style="margin:0 0 16px;color:#334155">{escape(intro)}</p>
{''.join(html_sections)}
<div style="margin-top:24px;padding:16px;background:#f8fafc;border-left:4px solid {accent};color:#334155">{escape(notice)}</div>
</td></tr><tr><td style="padding:18px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:20px;color:#64748b">
LabTrack &middot; This is an automated notification.</td></tr></table>
</td></tr></table></body></html>'''
    return EmailContent(subject, text, html)


def render_login(name, logged_in_at):
    return branded_email('New Login to LabTrack', name,
                         'You have successfully logged in to your LabTrack account.',
                         [('Login details', [('Login date and time', date_time(logged_in_at))])],
                         'If you did not perform this login, contact your administrator immediately.')


def render_equipment(kind, name, loans, now=None):
    now = now or datetime.now(timezone.utc)
    subjects = {
        'issued': 'Equipment Issued Successfully – LabTrack',
        'due_soon': 'Reminder: Equipment Return Due Soon – LabTrack',
        'overdue': 'Overdue Equipment Return – LabTrack',
    }
    intros = {
        'issued': 'The following equipment has been successfully issued to you.',
        'due_soon': 'Your issued equipment is due within 24 hours.',
        'overdue': 'The return deadline for your issued equipment has passed.',
    }
    notices = {
        'issued': 'Return the equipment by the due date and maintain it in good condition.',
        'due_soon': 'Please return the equipment to the appropriate lab assistant before the deadline.',
        'overdue': 'Please return the equipment as soon as possible or contact the lab assistant.',
    }
    sections = []
    for loan, model, lab, issuer in loans:
        fields = [('Equipment name', model.name or 'Not available'),
                  ('Asset ID / barcode', loan.unit_asset_id),
                  ('Lab name', lab.name if lab and lab.name else 'Not available')]
        if kind == 'issued':
            fields.insert(2, ('Equipment category', model.category or 'Not available'))
            fields += [('Issued date and time', date_time(loan.issue_date)),
                       ('Due date and time', date_time(loan.due_date)),
                       ('Issued by', issuer.name if issuer and issuer.name else 'Not recorded')]
        elif kind == 'due_soon':
            fields += [('Issued date', date_time(loan.issue_date)),
                       ('Exact due date and time', date_time(loan.due_date)),
                       ('Remaining time', duration(loan.due_date - now))]
        else:
            fields += [('Original due date and time', date_time(loan.due_date)),
                       ('Overdue duration', duration(now - loan.due_date))]
        sections.append(('Equipment details', fields))
    return branded_email(subjects[kind], name, intros[kind], sections, notices[kind], warning=kind == 'overdue')
