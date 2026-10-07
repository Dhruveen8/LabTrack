import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useAuth, useLabTrack, useToast } from '../../context/hooks';
import { requestService } from '../../services/requestService';
import { formatDate } from '../../utils/dateFormat';
import { Plus, Trash2, Send, CheckCircle2, XCircle } from 'lucide-react';

const errorMessage = error => {
  const detail = error.response?.data?.detail;
  return typeof detail === 'string' ? detail : Array.isArray(detail)
    ? detail.map(item => item.msg).join('; ') : error.message || 'Unable to complete this action';
};

export const EventIssuePage = () => {
  const { user } = useAuth();
  const { issueEventAction, refreshData, labsList } = useLabTrack();
  const { addToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const actionLock = useRef(false);
  const [eventName, setEventName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [returnDate, setReturnDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [assetIds, setAssetIds] = useState(['']);
  const [reasons, setReasons] = useState({});
  const isFaculty = user?.role === 'faculty';
  const isAssistant = user?.role === 'assistant';

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await requestService.getEventRequests());
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  const submit = async event => {
    event.preventDefault();
    if (actionLock.current) return;
    const assets = assetIds.map(id => id.trim()).filter(Boolean);
    if (!assets.length || new Set(assets).size !== assets.length) {
      setError('Enter at least one asset ID, with no duplicate IDs.');
      return;
    }
    actionLock.current = true;
    setWorking(true);
    setError('');
    try {
      await issueEventAction({ eventName: eventName.trim(), purpose: purpose.trim(),
        coordinatorId: user.id, returnDate, unitAssetIds: assets, totalQty: assets.length });
      setEventName('');
      setPurpose('');
      setAssetIds(['']);
      await loadRequests();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      actionLock.current = false;
      setWorking(false);
    }
  };

  const decide = async (request, approve) => {
    if (actionLock.current) return;
    if (!approve && !reasons[request.id]?.trim()) {
      setError('Enter a reason before rejecting the request.');
      return;
    }
    actionLock.current = true;
    setWorking(true);
    setError('');
    try {
      if (approve) await requestService.approveEventRequest(request.id);
      else await requestService.rejectEventRequest(request.id, reasons[request.id]);
      addToast(approve ? 'Event request approved and equipment issued.' : 'Event request rejected.', 'success');
      await Promise.all([loadRequests(), refreshData()]);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      actionLock.current = false;
      setWorking(false);
    }
  };

  return <div>
    <PageHeader title="Event / Club Equipment Requests"
      subtitle={isFaculty ? 'Submit a batch request for approval by the owning lab’s assistant.' : 'Review event requests. Approval issues the selected equipment to the faculty coordinator.'} />
    {error && <div role="alert" className="portal-card" style={{ color: '#b91c1c' }}>{error}</div>}
    {isFaculty && <form className="portal-card" onSubmit={submit}>
      <div className="form-group"><label className="form-label" htmlFor="event-name">Club / Event Name</label>
        <input id="event-name" className="form-control" value={eventName} onChange={event => setEventName(event.target.value)} maxLength={200} required /></div>
      <div className="form-group"><label className="form-label">Faculty Coordinator</label>
        <p>{user.name} ({user.displayId || user.universityId})</p></div>
      <div className="form-group"><label className="form-label" htmlFor="event-purpose">Purpose / Objectives</label>
        <input id="event-purpose" className="form-control" value={purpose} onChange={event => setPurpose(event.target.value)} required /></div>
      <div className="form-group"><label className="form-label" htmlFor="event-return">Expected Return Date</label>
        <input id="event-return" type="date" className="form-control" value={returnDate} onChange={event => setReturnDate(event.target.value)} required /></div>
      <p>Enter equipment from one lab. Availability is checked again when the assistant approves.</p>
      {assetIds.map((asset, index) => <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <input className="form-control" aria-label={`Asset ID ${index+1}`} placeholder="e.g. LT-IOT-MC-00001" value={asset}
          onChange={event => setAssetIds(previous => previous.map((value, position) => position === index ? event.target.value : value))} />
        <button type="button" className="btn btn-secondary" aria-label={`Remove asset ${index+1}`} disabled={assetIds.length === 1}
          onClick={() => setAssetIds(previous => previous.filter((_, position) => position !== index))}><Trash2 size={16} /></button>
      </div>)}
      <button type="button" className="btn btn-secondary" onClick={() => setAssetIds(previous => [...previous, ''])}><Plus size={16} /> Add Asset</button>
      <button className="btn btn-primary" type="submit" disabled={working} style={{ marginLeft: '0.5rem' }}><Send size={16} /> {working ? 'Submitting…' : 'Submit for Assistant Approval'}</button>
    </form>}
    <div className="portal-card">
      <h3>{isFaculty ? 'My Event Requests' : 'Event Requests'}</h3>
      <button type="button" className="btn btn-secondary btn-sm" onClick={loadRequests} disabled={working || loading}>Refresh</button>
      {loading ? <p>Loading requests…</p> : !requests.length ? <p>No event requests yet.</p> : requests.map(request => <article key={request.id} style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 0' }}>
        <strong>#{request.id} — {request.event_name}</strong><p>{request.coordinator_name || user.name} · {labsList.find(lab => lab.id === request.lab_id)?.name || `Lab ${request.lab_id}`} · {request.status}</p>
        <p>{request.purpose}</p><p>Requested: {formatDate(request.created_at)} · Return: {formatDate(request.due_date)}</p>
        <p>Assets: {request.unit_asset_ids.join(', ')}</p>
        {request.rejection_reason && <p>Reason: {request.rejection_reason}</p>}
        {isAssistant && request.status === 'PENDING' && <div>
          <button className="btn btn-primary" disabled={working} onClick={() => decide(request, true)}><CheckCircle2 size={16} /> Approve &amp; Issue</button>
          <input className="form-control" aria-label={`Rejection reason for request ${request.id}`} placeholder="Reason if rejecting" value={reasons[request.id] || ''}
            onChange={event => setReasons(previous => ({ ...previous, [request.id]: event.target.value }))} style={{ margin: '0.5rem 0' }} />
          <button className="btn btn-danger" disabled={working} onClick={() => decide(request, false)}><XCircle size={16} /> Reject</button>
        </div>}
      </article>)}
    </div>
  </div>;
};
