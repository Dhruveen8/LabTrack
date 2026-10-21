import React, { useId, useRef } from 'react';
import { Route, X } from 'lucide-react';
import { requestTracking } from '../../utils/requestTracking';
import { RequestApprovalTracker } from './RequestApprovalTracker';
import './RequestTrackingButton.css';

export const RequestTrackingButton = ({ request }) => {
  const dialog = useRef(null);
  const headingId = useId();
  return <div className="request-tracking-action">
    <p>{requestTracking(request).summary}</p>
    <button type="button" className="btn btn-primary request-tracking-action__button" aria-haspopup="dialog" onClick={() => dialog.current.showModal()}>
      <Route size={16} aria-hidden="true" />Track request
    </button>
    <dialog ref={dialog} className="request-tracking-dialog" aria-labelledby={headingId}>
      <header className="request-tracking-dialog__header">
        <div><h2 id={headingId}>Track request #{request.id}</h2><p>{request.requesterName}</p></div>
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Close request tracking" onClick={() => dialog.current.close()}><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="request-tracking-dialog__content"><RequestApprovalTracker request={request} /></div>
    </dialog>
  </div>;
};
