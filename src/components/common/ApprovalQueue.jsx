import React, { useId, useState } from 'react';
import { Check, CheckCircle2, Clock3, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import apiClient from '../../api/client';
import { useAuth, useLabTrack, useToast } from '../../context/hooks';
import { cartError } from '../../utils/cart';
import { approvalQueue } from '../../utils/approvalQueue';
import { formatDate } from '../../utils/dateFormat';
import './ApprovalQueue.css';

const localTime = value => new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
}).format(new Date(value));

export const ApprovalQueue = () => {
  const { user } = useAuth();
  const { requestsList, refreshData } = useLabTrack();
  const { addToast } = useToast();
  const headingId = useId();
  const [reasons, setReasons] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [errors, setErrors] = useState({});
  if (user?.role !== 'faculty') return null;
  const queue = approvalQueue(requestsList, user);

  const decide = async (request, approve) => {
    if (busyId !== null) return;
    const reason = reasons[request.id]?.trim();
    if (!approve && !reason) {
      setErrors(previous => ({ ...previous, [request.id]: 'Enter a reason before confirming rejection.' }));
      return;
    }
    setBusyId(request.id);
    setErrors(previous => ({ ...previous, [request.id]: '' }));
    try {
      await apiClient.post(`/borrowing/requests/${request.id}/review`, { approve, reason: approve ? null : reason });
      await refreshData();
      setRejectingId(null);
      setReasons(previous => ({ ...previous, [request.id]: '' }));
      addToast(approve ? 'Approval recorded.' : 'Request rejected and affected reservations released.', 'success');
    } catch (error) {
      setErrors(previous => ({ ...previous, [request.id]: cartError(error) }));
    } finally { setBusyId(null); }
  };

  return <section className="portal-card approval-queue" aria-labelledby={headingId}>
    <header className="approval-queue__header">
      <div className="approval-queue__heading">
        <span className="approval-queue__icon"><ShieldCheck size={20} aria-hidden="true" /></span>
        <div><h2 id={headingId}>{user.is_hod ? 'Department approvals' : 'Student approvals'}</h2>
          <p>{queue.length ? 'Review the items awaiting your decision.' : 'Requests that need your approval will appear here.'}</p>
        </div>
      </div>
      <div className="approval-queue__header-actions">
        <span className="approval-queue__count">{queue.length} pending</span>
      </div>
    </header>
    {!queue.length && <div className="approval-queue__empty">
      <CheckCircle2 size={23} aria-hidden="true" />
      <div><strong>You're all caught up</strong><p>No equipment requests are waiting for your approval.</p></div>
    </div>}
    <div className="approval-queue__requests">{queue.map(({ request, items }) => {
      const hasDeadline = Number.isFinite(Date.parse(request.approvalDeadline));
      const expired = hasDeadline && Date.parse(request.approvalDeadline) <= Date.now();
      const busy = busyId === request.id;
      const rejecting = rejectingId === request.id;
      const total = items.reduce((sum, item) => sum + item.quantity, 0);
      const reasonId = `${headingId}-reason-${request.id}`;
      const errorId = `${headingId}-error-${request.id}`;
      return <article key={request.id} className="approval-request" aria-label={`Request #${request.id} from ${request.requesterName}`} aria-busy={busy}>
        <div className="approval-request__header">
          <div><span className="approval-request__reference">REQUEST #{request.id}</span>
            <h3>{request.requesterName}</h3>
            <p>{request.requesterRole === 'faculty' ? 'Faculty equipment request' : 'Student equipment request'} · {total} {total === 1 ? 'unit' : 'units'} for review</p>
          </div>
          <span className={`approval-request__stage${expired ? ' approval-request__stage--expired' : ''}`}>
            <Clock3 size={13} aria-hidden="true" />{expired ? 'Approval window ended' : items[0].approval_stage === 'HOD' ? 'HOD review' : 'Faculty review'}
          </span>
        </div>
        <dl className="approval-request__details">
          <div><dt>Borrowing period</dt><dd>{formatDate(request.requiredFrom)} <span aria-hidden="true">→</span> {formatDate(request.requiredUntil)}</dd></div>
          <div><dt>Approve by</dt><dd>{formatDate(request.approvalDeadline)}{hasDeadline && <span className="approval-request__time">{localTime(request.approvalDeadline)} IST</span>}</dd></div>
        </dl>
        <div className="approval-request__equipment" aria-label="Equipment awaiting your approval">
          {items.map(item => <div className="approval-request__item" key={item.id}>
            <div><strong>{item.equipment_name}</strong><span>{item.lab_name}{item.requires_hod_approval ? ' · Requires HOD approval' : ''}</span></div>
            <span className="approval-request__quantity">Qty {item.quantity}</span>
          </div>)}
        </div>
        <div className="approval-request__purpose"><span>Purpose</span><p>{request.purpose || 'No purpose provided.'}</p></div>
        {items[0].approval_stage === 'HOD' && <p className="approval-request__purpose">The whole request waits for your decision. Rejecting releases HOD-required equipment; the remaining items proceed to the lab assistant.</p>}
        {errors[request.id] && <p id={errorId} className="approval-request__error" role="alert">{errors[request.id]}</p>}
        {rejecting ? <form className="approval-request__rejection" onSubmit={event => { event.preventDefault(); decide(request, false); }}>
          <label htmlFor={reasonId}>Reason for rejecting request #{request.id}</label>
          <textarea id={reasonId} className="form-control" rows={3} maxLength={2000} required autoFocus
            placeholder="Explain why these items cannot be approved"
            value={reasons[request.id] || ''} disabled={busyId !== null} aria-describedby={errors[request.id] ? errorId : undefined}
            onChange={event => setReasons(previous => ({ ...previous, [request.id]: event.target.value }))} />
          <div className="approval-request__buttons">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busyId !== null} onClick={() => {
              setRejectingId(null); setErrors(previous => ({ ...previous, [request.id]: '' }));
            }}>Cancel</button>
            <button type="submit" className="btn btn-danger btn-sm" disabled={busyId !== null || expired}>
              {busy ? <LoaderCircle size={15} className="approval-queue__spinner" aria-hidden="true" /> : <X size={15} aria-hidden="true" />}Confirm rejection
            </button>
          </div>
        </form> : <footer className="approval-request__footer">
          <p>{expired ? 'The reservation will be released automatically.' : items[0].approval_stage === 'HOD'
            ? 'Next: lab assistant approval and issue.' : 'Next: HOD where required, then the lab assistant.'}</p>
          <div className="approval-request__buttons">
            <button type="button" className="btn btn-danger btn-sm" disabled={busyId !== null || expired}
              onClick={() => { setRejectingId(request.id); setErrors(previous => ({ ...previous, [request.id]: '' })); }}><X size={15} aria-hidden="true" />Reject</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busyId !== null || expired} onClick={() => decide(request, true)}>
              {busy ? <LoaderCircle size={15} className="approval-queue__spinner" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{busy ? 'Approving…' : 'Approve request'}
            </button>
          </div>
        </footer>}
      </article>;
    })}</div>
  </section>;
};
