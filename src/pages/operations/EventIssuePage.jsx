import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useAuth, useLabTrack, useToast } from '../../context/hooks';
import { requestService } from '../../services/requestService';
import { formatDate } from '../../utils/dateFormat';
import { Plus, Minus, Trash2, Send, CheckCircle2, XCircle } from 'lucide-react';

const errorMessage = error => {
  const detail = error.response?.data?.detail;
  return typeof detail === 'string' ? detail : Array.isArray(detail)
    ? detail.map(item => item.msg).join('; ') : error.message || 'Unable to complete this action';
};

export const EventIssuePage = () => {
  const { user } = useAuth();
  const { issueEventAction, refreshData, labsList, equipmentList } = useLabTrack();
  const { addToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const actionLock = useRef(false);
  const [eventName, setEventName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [returnDate, setReturnDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [labId, setLabId] = useState('');
  const [items, setItems] = useState([{ modelId: '', quantity: 1 }]);
  const [allocations, setAllocations] = useState({});
  const [reasons, setReasons] = useState({});
  const isFaculty = user?.role === 'faculty';
  const isAssistant = user?.role === 'assistant';
  const labEquipment = equipmentList.filter(equipment => String(equipment.labId) === labId);
  const updateItem = (index, patch) => setItems(previous => previous.map((item, position) => position === index ? { ...item, ...patch } : item));
  const allocationItems = request => request.requested_items?.length ? request.requested_items :
    Object.entries((request.unit_asset_ids || []).reduce((counts, assetId) => {
      const equipment = equipmentList.find(model => model.units?.some(unit => unit.assetId === assetId));
      if (equipment) counts[equipment.id] = (counts[equipment.id] || 0) + 1;
      return counts;
    }, {})).map(([modelId, quantity]) => ({ model_id: Number(modelId), quantity }));

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await requestService.getEventRequests());
      setError('');
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
    if (!labId || items.some(item => !item.modelId || !Number.isInteger(item.quantity) || item.quantity < 1 ||
      item.quantity > (labEquipment.find(model => String(model.id) === item.modelId)?.availableQuantity || 0)) ||
      new Set(items.map(item => item.modelId)).size !== items.length || items.reduce((sum, item) => sum + item.quantity, 0) > 1000) {
      setError('Select a lab and unique equipment types with valid available quantities (up to 1000 units total).');
      return;
    }
    actionLock.current = true;
    setWorking(true);
    setError('');
    try {
      await issueEventAction({ eventName: eventName.trim(), purpose: purpose.trim(),
        coordinatorId: user.id, returnDate, labId, items, totalQty: items.reduce((sum, item) => sum + item.quantity, 0) });
      setEventName('');
      setPurpose('');
      setLabId('');
      setItems([{ modelId: '', quantity: 1 }]);
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
    const assets = request.requested_items?.length ? (allocations[request.id] || []) : request.unit_asset_ids;
    if (approve && allocationItems(request).some(item => {
      const model = equipmentList.find(equipment => equipment.id === item.model_id);
      return assets.filter(asset => model?.units?.some(unit => unit.assetId === asset)).length !== item.quantity;
    })) {
      setError('Select the requested number of available units for each equipment type.');
      return;
    }
    actionLock.current = true;
    setWorking(true);
    setError('');
    try {
      if (approve) await requestService.approveEventRequest(request.id, assets);
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
      subtitle={isFaculty ? 'Choose a lab, equipment types and quantities. The lab assistant allocates the specific units.' : 'Allocate available units and issue them to the faculty coordinator for the club or event.'} />
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
      <div className="form-group"><label className="form-label" htmlFor="event-lab">Lab to borrow from</label>
        <select id="event-lab" className="form-control" value={labId} required disabled={working}
          onChange={event => { setLabId(event.target.value); setItems([{ modelId: '', quantity: 1 }]); }}>
          <option value="">Select a lab</option>
          {labsList.map(lab => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
        </select></div>
      <p>Availability is checked again when the assistant allocates the units.</p>
      {items.map((item, index) => {
        const model = labEquipment.find(equipment => String(equipment.id) === item.modelId);
        return <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'end', marginBottom: '1rem' }}>
          <div style={{ flex: '1 1 240px' }}><label className="form-label" htmlFor={`event-equipment-${index}`}>Equipment to borrow</label>
            <select id={`event-equipment-${index}`} className="form-control" value={item.modelId} required disabled={!labId || working}
              onChange={event => updateItem(index, { modelId: event.target.value, quantity: 1 })}>
              <option value="">Select equipment</option>
              {labEquipment.map(equipment => <option key={equipment.id} value={equipment.id}
                disabled={!equipment.availableQuantity || items.some((other, position) => position !== index && other.modelId === String(equipment.id))}>
                {equipment.name} ({equipment.availableQuantity} available)</option>)}
            </select></div>
          <div><label className="form-label" htmlFor={`event-quantity-${index}`}>Quantity</label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button type="button" className="btn btn-secondary" aria-label={`Decrease quantity ${index + 1}`} disabled={working || item.quantity <= 1}
                onClick={() => updateItem(index, { quantity: item.quantity - 1 })}><Minus size={16} /></button>
              <input id={`event-quantity-${index}`} type="number" className="form-control" style={{ width: '80px' }} min="1" max={Math.min(model?.availableQuantity || 1, 1000)}
                value={item.quantity} disabled={!model || working} required onChange={event => updateItem(index, { quantity: Number(event.target.value) })} />
              <button type="button" className="btn btn-secondary" aria-label={`Increase quantity ${index + 1}`} disabled={!model || working || item.quantity >= Math.min(model.availableQuantity, 1000)}
                onClick={() => updateItem(index, { quantity: item.quantity + 1 })}><Plus size={16} /></button>
            </div></div>
          <button type="button" className="btn btn-secondary" aria-label={`Remove equipment ${index + 1}`} disabled={working || items.length === 1}
            onClick={() => setItems(previous => previous.filter((_, position) => position !== index))}><Trash2 size={16} /></button>
        </div>;
      })}
      {labId && !labEquipment.length && <p>No equipment is registered in this lab.</p>}
      <button type="button" className="btn btn-secondary" disabled={working || !labId || items.length >= labEquipment.filter(model => model.availableQuantity > 0).length}
        onClick={() => setItems(previous => [...previous, { modelId: '', quantity: 1 }])}><Plus size={16} /> Add Equipment</button>
      <button className="btn btn-primary" type="submit" disabled={working} style={{ marginLeft: '0.5rem' }}><Send size={16} /> {working ? 'Submitting…' : 'Submit for Assistant Approval'}</button>
    </form>}
    <div className="portal-card">
      <h3>{isFaculty ? 'My Event Requests' : 'Event Requests'}</h3>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => Promise.all([loadRequests(), refreshData()]).catch(failure => setError(errorMessage(failure)))} disabled={working || loading}>Refresh</button>
      {loading ? <p>Loading requests…</p> : !requests.length ? <p>No event requests yet.</p> : requests.map(request => <article key={request.id} style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 0' }}>
        <strong>#{request.id} — {request.event_name}</strong><p>{request.coordinator_name || user.name} · {labsList.find(lab => lab.id === request.lab_id)?.name || `Lab ${request.lab_id}`} · {request.status}</p>
        <p>{request.purpose}</p><p>Requested: {formatDate(request.created_at)} · Return: {formatDate(request.due_date)}</p>
        <p>Equipment: {allocationItems(request).map(item => `${equipmentList.find(model => model.id === item.model_id)?.name || `Equipment ${item.model_id}`} × ${item.quantity}`).join(', ') || 'See allocated assets'}</p>
        {!!request.unit_asset_ids?.length && <p>Assets: {request.unit_asset_ids.join(', ')}</p>}
        {request.rejection_reason && <p>Reason: {request.rejection_reason}</p>}
        {isAssistant && request.status === 'PENDING' && <div>
          {!!request.requested_items?.length && allocationItems(request).map(item => {
            const model = equipmentList.find(equipment => equipment.id === item.model_id);
            const availableUnits = model?.units?.filter(unit => unit.status === 'Available' && unit.labId === request.lab_id) || [];
            const selected = allocations[request.id] || [];
            const selectedCount = selected.filter(asset => model?.units?.some(unit => unit.assetId === asset)).length;
            return <fieldset key={item.model_id} style={{ margin: '0.75rem 0', border: '1px solid #e2e8f0', padding: '0.75rem' }}>
              <legend>{model?.name || `Equipment ${item.model_id}`} — select {item.quantity} units ({selectedCount} selected)</legend>
              {availableUnits.length < item.quantity && <p role="status">Only {availableUnits.length} available. Refresh or wait for returned equipment before issuing.</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>{availableUnits.map(unit => <label key={unit.assetId}>
                <input type="checkbox" checked={selected.includes(unit.assetId)} disabled={working || (!selected.includes(unit.assetId) && selectedCount >= item.quantity)}
                  onChange={event => setAllocations(previous => ({ ...previous, [request.id]: event.target.checked
                    ? [...(previous[request.id] || []), unit.assetId] : (previous[request.id] || []).filter(asset => asset !== unit.assetId) }))} /> {unit.assetId} ({unit.condition})
              </label>)}</div>
            </fieldset>;
          })}
          <button className="btn btn-primary" disabled={working} onClick={() => decide(request, true)}><CheckCircle2 size={16} /> Approve &amp; Issue</button>
          <input className="form-control" aria-label={`Rejection reason for request ${request.id}`} placeholder="Reason if rejecting" value={reasons[request.id] || ''}
            onChange={event => setReasons(previous => ({ ...previous, [request.id]: event.target.value }))} style={{ margin: '0.5rem 0' }} />
          <button className="btn btn-danger" disabled={working} onClick={() => decide(request, false)}><XCircle size={16} /> Reject</button>
        </div>}
      </article>)}
    </div>
  </div>;
};
