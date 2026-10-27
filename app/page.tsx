'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Enquiry, BusinessStatus, Category } from '@/lib/types';
import { validateEnquiryInput } from '@/lib/validation';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'form' | 'dashboard'>('form');

  // Customer Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Dashboard State
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});
  const [updatingStatusIds, setUpdatingStatusIds] = useState<Record<string, boolean>>({});
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Helper to show transient toast feedback
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch enquiries for dashboard
  const fetchEnquiries = useCallback(async (filter: string = statusFilter) => {
    setDashboardLoading(true);
    try {
      const url = filter && filter !== 'All' 
        ? `/api/enquiries?status=${encodeURIComponent(filter)}` 
        : '/api/enquiries';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load enquiries');
      const data: Enquiry[] = await res.json();
      setEnquiries(data);
    } catch (err: unknown) {
      console.error(err);
      showToast('Could not fetch enquiries', 'error');
    } finally {
      setDashboardLoading(false);
    }
  }, [statusFilter]);

  // Load enquiries whenever dashboard tab is selected or filter changes
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchEnquiries(statusFilter);
    }
  }, [activeTab, statusFilter, fetchEnquiries]);

  // Form Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess(null);
    setFormError(null);

    // Client-side validation
    const validation = validateEnquiryInput({
      name: formName,
      email: formEmail,
      message: formMessage,
    });

    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors({});
    setFormLoading(true);

    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          message: formMessage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Failed to submit enquiry. Please check your inputs.');
        return;
      }

      setFormSuccess(`Your enquiry has been submitted successfully! (Reference ID: ${data.id.slice(0, 8)})`);
      setTimeout(() => setFormSuccess(null), 5000);
      setFormName('');
      setFormEmail('');
      setFormMessage('');
    } catch {
      setFormError('Network error. Unable to reach server. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  // Update Business Status
  const handleStatusChange = async (id: string, newStatus: BusinessStatus) => {
    setUpdatingStatusIds(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Status update failed');
      }

      const updated: Enquiry = await res.json();
      setEnquiries(prev => prev.map(item => item.id === id ? updated : item));
      if (selectedEnquiry?.id === id) setSelectedEnquiry(updated);
      showToast(`Status updated to "${newStatus}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      showToast(msg, 'error');
    } finally {
      setUpdatingStatusIds(prev => ({ ...prev, [id]: false }));
    }
  };

  // Retry AI Categorization
  const handleRetryAI = async (id: string) => {
    setRetryingIds(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/enquiries/${id}/retry`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Retry failed');
      }

      const updated: Enquiry = await res.json();
      setEnquiries(prev => prev.map(item => item.id === id ? updated : item));
      if (selectedEnquiry?.id === id) setSelectedEnquiry(updated);

      if (updated.categorizationState === 'Completed') {
        showToast(`AI categorized as "${updated.category}"!`, 'success');
      } else {
        showToast('Categorization failed again. You can retry later.', 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Retry request failed';
      showToast(msg, 'error');
    } finally {
      setRetryingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  // Delete Enquiry
  const handleDeleteEnquiry = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this enquiry?')) return;
    try {
      const res = await fetch(`/api/enquiries/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setEnquiries(prev => prev.filter(item => item.id !== id));
      if (selectedEnquiry?.id === id) setSelectedEnquiry(null);
      showToast('Enquiry deleted successfully', 'success');
    } catch {
      showToast('Could not delete enquiry', 'error');
    }
  };

  // Category Badge Colors
  const getCategoryBadge = (category: Category | null, state: string) => {
    if (state === 'Failed') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
          Failed
        </span>
      );
    }
    if (state === 'Pending') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
          Pending
        </span>
      );
    }
    switch (category) {
      case 'Sales':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">Sales</span>;
      case 'Support':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">Support</span>;
      case 'Billing':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">Billing</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">Other</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                I
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Customer Enquiry Tracker</h1>
                <p className="text-xs text-slate-500">Intevoris AI Assessment</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('form')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'form'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Customer Portal (Form)
              </button>
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setFormSuccess(null);
                  setFormError(null);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Staff Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center space-x-2 border ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* ================= VIEW 1: CUSTOMER ENQUIRY FORM ================= */}
        {activeTab === 'form' && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Submit an Enquiry</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Have a question or request? Fill out the form below and our team will get back to you shortly.
                </p>
              </div>

              {/* Success Alert */}
              {formSuccess && (
                <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                  <div className="font-semibold">Success!</div>
                  <p className="mt-1">{formSuccess}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('dashboard');
                      setFormSuccess(null);
                      setFormError(null);
                    }}
                    className="mt-3 text-xs font-semibold text-emerald-900 underline hover:text-emerald-700 cursor-pointer"
                  >
                    View in Staff Dashboard &rarr;
                  </button>
                </div>
              )}

              {/* Error Alert */}
              {formError && (
                <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                  <div className="font-semibold">Submission Error</div>
                  <p className="mt-1">{formError}</p>
                </div>
              )}

              <form onSubmit={handleFormSubmit} noValidate className="space-y-5">
                {/* Full Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. John Doe"
                    disabled={formLoading}
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.name ? 'border-red-500 bg-red-50/30' : 'border-slate-300 bg-white'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. john@example.com"
                    disabled={formLoading}
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.email ? 'border-red-500 bg-red-50/30' : 'border-slate-300 bg-white'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    placeholder="Describe your enquiry in detail..."
                    disabled={formLoading}
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.message ? 'border-red-500 bg-red-50/30' : 'border-slate-300 bg-white'
                    }`}
                  />
                  {formErrors.message && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.message}</p>
                  )}
                </div>

                {/* Test Helper Suggestions */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-700">Quick Test Templates (from assignment):</div>
                  <button
                    type="button"
                    onClick={() => setFormMessage('Please send pricing for your automation service.')}
                    className="block text-indigo-600 hover:underline cursor-pointer text-left"
                  >
                    &bull; Success test: &ldquo;Please send pricing for your automation service.&rdquo;
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMessage('[FAIL_ONCE] I have an invoice question.')}
                    className="block text-amber-700 hover:underline cursor-pointer text-left"
                  >
                    &bull; Fail test: &ldquo;[FAIL_ONCE] I have an invoice question.&rdquo;
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMessage('[INVALID_ONCE] My login is broken.')}
                    className="block text-purple-700 hover:underline cursor-pointer text-left"
                  >
                    &bull; Invalid test: &ldquo;[INVALID_ONCE] My login is broken.&rdquo;
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center space-x-2"
                >
                  {formLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      <span>Submitting Enquiry...</span>
                    </>
                  ) : (
                    <span>Submit Enquiry</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= VIEW 2: BUSINESS DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Dashboard Header & Controls */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Enquiries Dashboard</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Track and manage customer follow-ups and automated AI categories.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                {/* Status Filter */}
                <div className="flex items-center space-x-2">
                  <label htmlFor="filterStatus" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Filter:
                  </label>
                  <select
                    id="filterStatus"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-sm bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="All">All Enquiries</option>
                    <option value="New">New</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>

                {/* Refresh Button */}
                <button
                  onClick={() => fetchEnquiries(statusFilter)}
                  disabled={dashboardLoading}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <span className={dashboardLoading ? 'animate-spin' : ''}>&#8635;</span>
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Enquiries Table */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
              {dashboardLoading && enquiries.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                  <p className="text-sm">Loading enquiries from database...</p>
                </div>
              ) : enquiries.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-xl mb-3">
                    &#9993;
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">No enquiries found</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {statusFilter !== 'All' 
                      ? `There are no enquiries with status "${statusFilter}". Try changing the filter.`
                      : 'No enquiries have been submitted yet. Switch to the Customer Portal to submit one!'}
                  </p>
                  {statusFilter === 'All' && (
                    <button
                      onClick={() => setActiveTab('form')}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer"
                    >
                      Go to Customer Form
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Message Preview</th>
                        <th className="py-3 px-4">AI Category</th>
                        <th className="py-3 px-4">Business Status</th>
                        <th className="py-3 px-4">Created</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {enquiries.map((enquiry) => (
                        <tr
                          key={enquiry.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          {/* Customer Name & Email */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{enquiry.name}</div>
                            <div className="text-xs text-slate-500">{enquiry.email}</div>
                          </td>

                          {/* Message snippet */}
                          <td className="py-3 px-4 max-w-xs">
                            <button
                              onClick={() => setSelectedEnquiry(enquiry)}
                              className="text-left text-slate-800 hover:text-indigo-600 font-medium line-clamp-2 cursor-pointer group"
                              title="Click to read full message"
                            >
                              <span>{enquiry.message}</span>
                              <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 ml-1">
                                (view)
                              </span>
                            </button>
                          </td>

                          {/* AI Category & State */}
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {getCategoryBadge(enquiry.category, enquiry.categorizationState)}
                            </div>
                          </td>

                          {/* Business Status Dropdown */}
                          <td className="py-3 px-4">
                            <select
                              value={enquiry.status}
                              disabled={updatingStatusIds[enquiry.id]}
                              onChange={(e) => handleStatusChange(enquiry.id, e.target.value as BusinessStatus)}
                              className={`text-xs font-semibold rounded-md px-2.5 py-1 border transition-colors cursor-pointer ${
                                enquiry.status === 'New'
                                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                                  : enquiry.status === 'In Progress'
                                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              }`}
                            >
                              <option value="New">New</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                            </select>
                          </td>

                          {/* Created Timestamp */}
                          <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                            {new Date(enquiry.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* Action: Retry AI or View */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-2">
                              {/* Retry button shown only for Failed records */}
                              {enquiry.categorizationState === 'Failed' && (
                                <button
                                  onClick={() => handleRetryAI(enquiry.id)}
                                  disabled={retryingIds[enquiry.id]}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-md shadow-2xs transition-colors disabled:opacity-50 cursor-pointer flex items-center space-x-1"
                                >
                                  {retryingIds[enquiry.id] ? (
                                    <>
                                      <span className="animate-spin">&#8635;</span>
                                      <span>Retrying...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>&#8635;</span>
                                      <span>Retry AI</span>
                                    </>
                                  )}
                                </button>
                              )}

                              <button
                                onClick={() => setSelectedEnquiry(enquiry)}
                                className="px-2.5 py-1 text-xs text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              >
                                View
                              </button>

                              <button
                                onClick={() => handleDeleteEnquiry(enquiry.id)}
                                className="px-2.5 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                title="Delete enquiry"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL: FULL MESSAGE VIEWER ================= */}
      {selectedEnquiry && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Enquiry Details</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {selectedEnquiry.id}</p>
              </div>
              <button
                onClick={() => setSelectedEnquiry(null)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer p-1"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-slate-500 uppercase font-semibold">Customer:</span>
                <p className="font-medium text-slate-900">{selectedEnquiry.name} ({selectedEnquiry.email})</p>
              </div>

              <div className="flex gap-4">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Category:</span>
                  <div className="mt-1">{getCategoryBadge(selectedEnquiry.category, selectedEnquiry.categorizationState)}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Status:</span>
                  <div className="mt-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                      {selectedEnquiry.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Submitted:</span>
                  <p className="text-xs text-slate-700 mt-1">{new Date(selectedEnquiry.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-500 uppercase font-semibold">Full Message:</span>
                <div className="mt-1 p-3 bg-slate-50 rounded-lg text-slate-800 whitespace-pre-wrap border border-slate-200 text-sm">
                  {selectedEnquiry.message}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              {selectedEnquiry.categorizationState === 'Failed' && (
                <button
                  onClick={() => handleRetryAI(selectedEnquiry.id)}
                  disabled={retryingIds[selectedEnquiry.id]}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {retryingIds[selectedEnquiry.id] ? 'Retrying...' : 'Retry AI Categorization'}
                </button>
              )}
              <button
                onClick={() => handleDeleteEnquiry(selectedEnquiry.id)}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer mr-auto"
              >
                Delete Enquiry
              </button>
              <button
                onClick={() => setSelectedEnquiry(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        Customer Enquiry Tracker &bull; Prepared for Intevoris AI Assessment &bull; Round 3
      </footer>
    </div>
  );
}
