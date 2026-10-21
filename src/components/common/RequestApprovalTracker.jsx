import React from 'react';
import { Check, Circle, Clock3, Minus, X } from 'lucide-react';
import { requestTracking } from '../../utils/requestTracking';
import { formatDate } from '../../utils/dateFormat';
import './RequestApprovalTracker.css';

const labels = { done: 'Approved', active: 'Awaiting approval', upcoming: 'Not reached yet', rejected: 'Rejected', stopped: 'Stopped', skipped: 'Not required' };
const dateTime = value => {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(new Date(value));
  return `${formatDate(value)} · ${time} IST`;
};

export const RequestApprovalTracker = ({ request }) => {
  const { summary, steps, hasRejection } = requestTracking(request);
  return <div className="request-tracking" aria-label={`Approval progress for request #${request.id}`}>
    <div className="request-tracking__summary">{summary}</div>
    {hasRejection && !['Rejected', 'Cancelled'].includes(request.status) && <p className="request-tracking__notice">Some items were rejected. See the stages below.</p>}
    <ol className="request-tracking__steps">
      {steps.map(step => {
        const Icon = step.state === 'done' ? Check : step.state === 'active' ? Clock3 : step.state === 'rejected' ? X
          : ['stopped', 'skipped'].includes(step.state) ? Minus : Circle;
        const stateLabel = step.id === 'submitted' ? 'Submitted' : step.id === 'pickup'
          ? step.state === 'done' ? 'Issued' : step.state === 'active' ? 'Ready for pickup' : step.state === 'stopped' ? 'Not issued' : 'Waiting for approval'
          : step.id === 'returned' ? step.state === 'done' ? 'Returned' : 'Partially returned' : labels[step.state];
        return <li key={step.id} className={`request-tracking__step request-tracking__step--${step.state}`} aria-current={step.state === 'active' ? 'step' : undefined}>
          <span className="request-tracking__dot"><Icon size={12} aria-hidden="true" /></span>
          <div className="request-tracking__body"><div className="request-tracking__stage"><strong>{step.label}</strong><span>{stateLabel}</span></div>
            {step.state !== 'skipped' && <>
              {step.person && <p className="request-tracking__person">{step.person}{step.lab ? ` · ${step.lab}` : ''}</p>}
              {!step.person && step.lab && <p>{step.lab} · {['done', 'rejected'].includes(step.state) ? 'Approver not recorded' : 'No assistant assigned'}</p>}
              {!!step.equipment?.length && <p>{step.equipment.join(', ')}</p>}
              {step.detail && <p>{step.detail}</p>}
              {dateTime(step.at) && <time dateTime={step.at}>{dateTime(step.at)}</time>}
              {step.deadline && <p>Collect by {formatDate(step.deadline)}</p>}
              {step.reason && <p className="request-tracking__reason">Reason: {step.reason}</p>}
            </>}
          </div>
        </li>;
      })}
    </ol>
  </div>;
};
