import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Trash2, RefreshCw, CheckCircle } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { useCart, useLabTrack, useToast, useAuth } from '../../context/hooks';
import { cartService } from '../../services/cartService';
import { cartError, cartFingerprint } from '../../utils/cart';
import './CartPage.css';

const localDateTime = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export const CartPage = () => {
  const { cart, error, busy, changed, refreshCart, add, update, remove, clearAfterSubmit } = useCart();
  const { equipmentList, systemSettings, refreshData } = useLabTrack();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [modelId, setModelId] = useState(() => searchParams.get('id') || '');
  const [addQty, setAddQty] = useState(1);
  const [start, setStart] = useState(() => localDateTime(new Date()));
  const [due, setDue] = useState(() => localDateTime(new Date(Date.now() + 7 * 86400000)));
  const [purpose, setPurpose] = useState('');
  const [message, setMessage] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const submission = useRef(null);
  const fingerprint = cartFingerprint(cart);

  useEffect(() => { setReviewed(false); }, [fingerprint, start, due, purpose]);
  useEffect(() => {
    let active = true;
    refreshCart().catch(() => {}).finally(() => { if (active) setChecking(false); });
    const timer = setInterval(() => refreshCart().catch(() => {}), 15000);
    return () => { active = false; clearInterval(timer); };
  }, [refreshCart]);

  const run = async (operation) => {
    setMessage('');
    try { await operation(); } catch (error) { setMessage(cartError(error)); }
  };
  const validDates = new Date(due) > new Date(start) && new Date(due) > new Date();
  const canReview = cart.can_submit && !error && !busy && !checking && !submitting && validDates && purpose.trim();
  const review = async () => {
    setChecking(true);
    setMessage('');
    try {
      const latest = await refreshCart();
      if (latest?.can_submit) {
        setReviewed(true);
        submission.current = { items: latest.items.map(({ model_id, lab_id, quantity }) => ({ model_id, lab_id, quantity })),
          required_from: new Date(start).toISOString(), required_until: new Date(due).toISOString(),
          purpose: purpose.trim(), submission_key: crypto.randomUUID() };
      } else setMessage('Availability changed. Revise the highlighted items before submitting.');
    } catch (error) { setMessage(cartError(error)); }
    finally { setChecking(false); }
  };
  const submit = async () => {
    if (submitting || !submission.current) return;
    setSubmitting(true);
    setMessage('');
    const storageKey = `labtrack-cart-submission-${user.id}`;
    try {
      // Retain the idempotency key after a lost response; repeated clicks cannot allocate twice.
      const pending = sessionStorage.getItem(storageKey);
      const body = pending ? JSON.parse(pending) : submission.current;
      sessionStorage.setItem(storageKey, JSON.stringify(body));
      const result = await cartService.submit(body);
      sessionStorage.removeItem(storageKey);
      clearAfterSubmit();
      await refreshData();
      addToast(`Request #${result.id} submitted with ${result.quantity} units for lab assistant review`, 'success');
      navigate('/requests');
    } catch (error) {
      if (error.response) sessionStorage.removeItem(storageKey);
      setMessage(cartError(error));
      setReviewed(false);
      await refreshCart().catch(() => {});
    } finally { setSubmitting(false); }
  };
  const pending = sessionStorage.getItem(`labtrack-cart-submission-${user.id}`);

  return <div className="cart-page">
    <PageHeader title="Equipment Cart" subtitle="Build one request with multiple equipment types. Your cart does not hold stock."
      actions={<Link className="btn btn-secondary" to="/browse-equipment">Browse equipment</Link>} />
    <div className="portal-card cart-toolbar">
      <strong><ShoppingCart size={18} /> {cart.items.length} equipment types · {cart.count} units</strong>
      <button className="btn btn-secondary btn-sm" disabled={busy || checking || submitting} onClick={() => run(refreshCart)}><RefreshCw size={14} /> Refresh stock</button>
    </div>
    {(message || error) && <div className="cart-warning" role="alert">{message || error}</div>}
    {changed && <div className="cart-warning" role="status">Stock availability has changed. Review each quantity; your items have been kept in the cart.</div>}
    {pending && <div className="cart-warning">A previous submission did not return a confirmation. Check it before making another request.
      <button className="btn btn-secondary btn-sm" disabled={submitting} onClick={() => { submission.current = JSON.parse(pending); submit(); }}>Check previous submission</button>
    </div>}
    <div className="portal-card cart-add">
      <label>Equipment type<select className="form-control" value={modelId} disabled={busy || submitting} onChange={event => setModelId(event.target.value)}>
        <option value="">Choose equipment</option>{equipmentList.map(item => <option key={item.id} value={item.id}>{item.name} — {item.labName}</option>)}
      </select></label>
      <label>Quantity<input className="form-control" type="number" min="1" max="500" value={addQty} disabled={busy || submitting} onChange={event => setAddQty(Number(event.target.value))} /></label>
      <button className="btn btn-primary" disabled={!modelId || !Number.isInteger(addQty) || addQty < 1 || addQty > 500 || busy || submitting || !!pending}
        onClick={() => run(() => { const model = equipmentList.find(item => item.id === Number(modelId)); return add(model.id, model.labId, addQty); })}>Add to cart</button>
    </div>
    {checking && !cart.items.length && <p role="status">Loading current inventory…</p>}
    {!checking && !cart.items.length && <div className="portal-card">Your cart is empty. Add equipment above or browse the catalog.</div>}
    {cart.items.map(item => <div className={`portal-card cart-item ${item.insufficient ? 'cart-item-warning' : ''}`} key={`${item.model_id}-${item.lab_id}`}>
      <div><h3>{item.equipment_name}</h3><p>{item.lab_name}</p><strong>Available stock: {item.available_quantity}</strong>
        <p className={item.insufficient ? 'cart-danger' : 'cart-ok'}>{item.unavailable ? 'Unavailable' : item.insufficient ? `Only ${item.available_quantity} available — revise your quantity` : 'Available for submission'}</p>
      </div>
      <div className="cart-item-controls"><label>Requested quantity<input aria-label={`Quantity for ${item.equipment_name}`} className="form-control" type="number" min="1" max="500"
        value={item.quantity} disabled={busy || submitting || !!pending} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && value <= 500) run(() => update(item, value)); }} /></label>
        <button className="btn btn-danger btn-sm" aria-label={`Remove ${item.equipment_name}`} disabled={busy || submitting || !!pending} onClick={() => run(() => remove(item))}><Trash2 size={14} /> Remove</button>
      </div>
    </div>)}
    {!!cart.items.length && <div className="portal-card">
      <h3>Borrowing details</h3><p>Student policy: up to {systemSettings.studentBorrowLimitDays || 14} days. Existing item limits still apply.</p>
      <div className="cart-dates"><label>Required from<input className="form-control" type="datetime-local" value={start} disabled={submitting || !!pending} onChange={event => setStart(event.target.value)} /></label>
        <label>Return by<input className="form-control" type="datetime-local" value={due} disabled={submitting || !!pending} onChange={event => setDue(event.target.value)} /></label></div>
      <label>Purpose<textarea className="form-control" value={purpose} maxLength="2000" disabled={submitting || !!pending} onChange={event => setPurpose(event.target.value)} placeholder="Describe your coursework or project" /></label>
      {!validDates && <p className="cart-danger">Choose a future return deadline after the start time.</p>}
      {reviewed ? <div className="cart-review"><h3>Final review</h3>
        <ul>{cart.items.map(item => <li key={`${item.model_id}-${item.lab_id}`}>{item.equipment_name} × {item.quantity} — {item.lab_name}</li>)}</ul>
        <p>{new Date(start).toLocaleString()} → {new Date(due).toLocaleString()}</p><p>Purpose: {purpose}</p>
        <p>All items will be checked together against current stock. Nothing is submitted if any item cannot be allocated.</p>
        <button className="btn btn-primary" disabled={!canReview || submitting || !!pending} onClick={submit}><CheckCircle size={16} /> {submitting ? 'Submitting…' : 'Submit combined request'}</button>
        <button className="btn btn-secondary" disabled={submitting} onClick={() => setReviewed(false)}>Back to cart</button>
      </div> : <button className="btn btn-primary" disabled={!canReview || !!pending} onClick={review}>Review combined request</button>}
    </div>}
  </div>;
};
