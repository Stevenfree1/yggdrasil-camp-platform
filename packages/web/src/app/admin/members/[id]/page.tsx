'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  User,
  Calendar,
  CreditCard,
  Shield,
  Save,
  Loader2,
  AlertCircle,
  UserX,
  Plus,
  CheckCircle,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  Lock,
} from 'lucide-react';
import { StatusBadge } from '../../../../components/shared/StatusBadge';
import { AdminScopesCard } from '../../../../components/admin/AdminScopesCard';
import { useAuth, type AdminScope } from '../../../../contexts/AuthContext';
import { ConfirmDialog } from '../../../../components/shared/ConfirmDialog';
import { SeasonDateInput } from '../../../../components/admin/SeasonDateInput';
import { PaymentEditModal } from '../../../../components/admin/PaymentEditModal';
import {
  fetchMemberById,
  updateMemberProfile,
  updateMemberRole,
  deactivateMember,
  updateSeasonMemberStatus,
  updateSeasonMemberHousing,
  recordPayment,
  updatePayment,
  deletePayment,
  type MemberData,
  type PaymentData,
} from '../../../../lib/adminApi';

type Tab = 'season' | 'payments' | 'profile';

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;

  // Validate UUID format
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);

  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('season');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Active season member (first active season entry from the member's seasonMembers)
  const activeSeasonMember = member?.seasonMembers?.find((sm) => sm.season.isActive) || member?.seasonMembers?.[0] || null;
  const payments: PaymentData[] = activeSeasonMember?.payments || [];

  // Editable season fields
  const [editStatus, setEditStatus] = useState('');
  const [editHousingType, setEditHousingType] = useState('');
  const [editHousingSize, setEditHousingSize] = useState('');
  const [editGridPower, setEditGridPower] = useState('');
  const [editArrival, setEditArrival] = useState('');
  const [editDeparture, setEditDeparture] = useState('');
  const [editBuildCrew, setEditBuildCrew] = useState(false);
  const [editStrikeCrew, setEditStrikeCrew] = useState(false);
  const [editSpecialRequests, setEditSpecialRequests] = useState('');

  // Editable profile fields
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPlayaName, setEditPlayaName] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editDietary, setEditDietary] = useState('');
  const [editAllergies, setEditAllergies] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Confirm dialogs
  const { user: currentUser } = useAuth();
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [pendingRole, setPendingRole] = useState('');

  // Record payment
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [paymentType, setPaymentType] = useState('DUES');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('VENMO');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Edit / delete existing payments
  const [editingPayment, setEditingPayment] = useState<PaymentData | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<PaymentData | null>(null);

  const loadMember = useCallback(async () => {
    if (!isValidUUID) {
      setError('Invalid member ID format.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchMemberById(memberId);
      setMember(data);

      // Populate profile fields
      setEditName(data.name || '');
      setEditEmail(data.email || '');
      setEditPhone(data.phone || '');
      setEditPlayaName(data.playaName || '');
      setEditGender(data.gender || '');
      setEditEmergencyName(data.emergencyContactName || '');
      setEditEmergencyPhone(data.emergencyContactPhone || '');
      setEditDietary(data.dietaryRestrictions || '');
      setEditAllergies(data.allergies || '');
      setEditNotes(data.notes || '');

      // Populate season fields from active season member
      const sm = data.seasonMembers?.find((s) => s.season.isActive) || data.seasonMembers?.[0];
      if (sm) {
        setEditStatus(sm.status || '');
        setEditHousingType(sm.housingType || '');
        setEditHousingSize(sm.housingSize || '');
        setEditGridPower(sm.gridPower || 'NONE');
        setEditArrival(sm.arrivalDate ? sm.arrivalDate.split('T')[0] : '');
        setEditDeparture(sm.departureDate ? sm.departureDate.split('T')[0] : '');
        setEditBuildCrew(sm.buildCrew || false);
        setEditStrikeCrew(sm.strikeCrew || false);
        setEditSpecialRequests(sm.specialRequests || '');
      }

      setError(null);
    } catch {
      setError('Unable to load member details. The server may not be running.');
    } finally {
      setLoading(false);
    }
  }, [memberId, isValidUUID]);

  useEffect(() => {
    loadMember();
  }, [loadMember]);

  const showSaveNotification = (text: string, type: 'success' | 'error') => {
    setSaveMessage({ text, type });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const saveSeasonData = async () => {
    if (!activeSeasonMember) return;
    try {
      setSaving(true);

      await updateSeasonMemberStatus(activeSeasonMember.id, editStatus);
      await updateSeasonMemberHousing(activeSeasonMember.id, {
        housingType: editHousingType || null,
        housingSize: editHousingSize || null,
        gridPower: editGridPower,
      });

      showSaveNotification('Season data saved successfully.', 'success');
    } catch {
      showSaveNotification('Failed to save season data.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveProfileData = async () => {
    if (!member) return;
    try {
      setSaving(true);
      await updateMemberProfile(member.id, {
        name: editName,
        email: editEmail,
        phone: editPhone || null,
        playaName: editPlayaName || null,
        gender: editGender || null,
        emergencyContactName: editEmergencyName || null,
        emergencyContactPhone: editEmergencyPhone || null,
        dietaryRestrictions: editDietary || null,
        allergies: editAllergies || null,
        notes: editNotes || null,
      });
      showSaveNotification('Profile saved successfully.', 'success');
    } catch {
      showSaveNotification('Failed to save profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRole = async () => {
    if (!member || !pendingRole) return;
    try {
      await updateMemberRole(member.id, pendingRole as 'LEAD' | 'MANAGER' | 'STAFF' | 'MEMBER');
      setMember({ ...member, role: pendingRole });
      showSaveNotification('Role updated successfully.', 'success');
    } catch {
      showSaveNotification('Failed to update role.', 'error');
    }
  };

  const handleDeactivate = async () => {
    if (!member) return;
    try {
      await deactivateMember(member.id);
      setMember({ ...member, isActive: false });
      showSaveNotification('Member deactivated.', 'success');
    } catch {
      showSaveNotification('Failed to deactivate member.', 'error');
    }
  };

  const handleRecordPayment = async () => {
    if (!activeSeasonMember || !paymentAmount) return;
    try {
      setRecordingPayment(true);
      await recordPayment({
        seasonMemberId: activeSeasonMember.id,
        type: paymentType,
        amount: Math.round(parseFloat(paymentAmount) * 100),
        method: paymentMethod,
        paidAt: new Date().toISOString(),
        notes: paymentNotes || undefined,
      });
      setShowRecordPayment(false);
      setPaymentAmount('');
      setPaymentNotes('');
      showSaveNotification('Payment recorded successfully.', 'success');
      loadMember(); // Refresh data
    } catch {
      showSaveNotification('Failed to record payment.', 'error');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    try {
      await deletePayment(deletingPayment.id);
      showSaveNotification('Payment deleted.', 'success');
      loadMember();
    } catch {
      showSaveNotification('Failed to delete payment.', 'error');
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'season', label: 'Season', icon: Calendar },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
        <p className="text-sm text-ink-soft">Loading member details...</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-display-thin text-xl text-ink mb-2">Member Not Found</h2>
        <p className="text-body-relaxed text-sm text-ink-soft mb-6">
          {error || 'The member could not be loaded.'}
        </p>
        <Link
          href="/admin/members"
          className="inline-flex items-center gap-2 text-sm font-medium text-gold hover:text-gold/80 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Members
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Back Link */}
      <Link
        href="/admin/members"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-gold transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Members
      </Link>

      {/* Save Notification */}
      <AnimatePresence>
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-3 ${
              saveMessage.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}
          >
            {saveMessage.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle className="h-4 w-4 shrink-0" />
            )}
            {saveMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Card */}
      <div className="luxury-card p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sage/10 border border-sage/20">
              <User className="h-7 w-7 text-sage" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-display-thin text-2xl text-ink">
                  {member.name}
                </h1>
                <span className="inline-flex items-center rounded-md bg-sage/10 px-2 py-0.5 text-xs font-medium text-sage">
                  {member.role}
                </span>
                {!member.isActive && (
                  <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 border border-red-200">
                    Inactive
                  </span>
                )}
                {activeSeasonMember && (
                  <StatusBadge status={activeSeasonMember.status} variant="season" />
                )}
              </div>
              {member.playaName && (
                <p className="text-sm text-ink-soft">
                  &ldquo;{member.playaName}&rdquo;
                </p>
              )}
              <div className="flex items-center gap-4 mt-1 text-sm text-ink-soft">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {member.email}
                </span>
                {member.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {member.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPendingRole(member.role === 'LEAD' ? 'MEMBER' : member.role === 'MANAGER' ? 'LEAD' : 'MANAGER');
                setShowRoleDialog(true);
              }}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream transition-colors flex items-center gap-1.5"
            >
              <Shield className="h-4 w-4" />
              Change Role
            </button>
            {member.isActive && (
              <button
                onClick={() => setShowDeactivateDialog(true)}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
              >
                <UserX className="h-4 w-4" />
                Deactivate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Per-area admin grants. Read-only unless the viewer is a LEAD. */}
      <AdminScopesCard
        memberId={member.id}
        memberName={member.name}
        initialScopes={((member as { adminScopes?: AdminScope[] }).adminScopes ?? [])}
        canEdit={currentUser?.role === 'LEAD'}
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-tan/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-gold text-gold'
                : 'border-transparent text-ink-soft hover:text-ink hover:border-tan/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.id === 'payments' && payments.length > 0 && (
              <span className="ml-1 text-xs bg-sage/10 text-sage px-1.5 py-0.5 rounded-full">
                {payments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Season Tab */}
      {activeTab === 'season' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="luxury-card p-6 space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-display-thin text-lg text-ink">
              Season Enrollment
            </h2>
            {activeSeasonMember && (
              <span className="text-sm text-ink-soft">
                {activeSeasonMember.season.name}
              </span>
            )}
          </div>

          {!activeSeasonMember ? (
            <div className="text-center py-8">
              <Calendar className="h-10 w-10 text-ink-soft/30 mx-auto mb-3" />
              <p className="text-sm text-ink-soft mb-4">
                This member is not enrolled in any season.
              </p>
            </div>
          ) : (
            <>
              {/* Status */}
              <div>
                <label className="form-label">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="form-input w-full max-w-xs"
                >
                  <option value="INTERESTED">Interested</option>
                  <option value="MAYBE">Maybe</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="WAITLISTED">Waitlisted</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Housing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Housing Type</label>
                  <select
                    value={editHousingType}
                    onChange={(e) => setEditHousingType(e.target.value)}
                    className="form-input"
                  >
                    <option value="">Not Set</option>
                    <option value="TENT">Tent</option>
                    <option value="SHIFTPOD">Shiftpod</option>
                    <option value="RV">RV</option>
                    <option value="TRAILER">Trailer</option>
                    <option value="DORM">Dorm</option>
                    <option value="SHARED">Shared</option>
                    <option value="HEXAYURT">Hexayurt</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Housing Size</label>
                  <input
                    type="text"
                    value={editHousingSize}
                    onChange={(e) => setEditHousingSize(e.target.value)}
                    placeholder='e.g. "10x12", "25ft"'
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Grid Power</label>
                  <select
                    value={editGridPower}
                    onChange={(e) => setEditGridPower(e.target.value)}
                    className="form-input"
                  >
                    <option value="NONE">None</option>
                    <option value="AMP_15">15 Amp</option>
                    <option value="AMP_30">30 Amp</option>
                    <option value="AMP_50">50 Amp</option>
                  </select>
                </div>
              </div>

              {/* Dates — bound to the active season's BM calendar with milestone chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SeasonDateInput
                  label="Arrival Date"
                  value={editArrival}
                  onChange={setEditArrival}
                  season={activeSeasonMember?.season}
                  mode="arrival"
                />
                <SeasonDateInput
                  label="Departure Date"
                  value={editDeparture}
                  onChange={setEditDeparture}
                  season={activeSeasonMember?.season}
                  mode="departure"
                />
              </div>

              {/* Crew */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editBuildCrew}
                    onChange={(e) => setEditBuildCrew(e.target.checked)}
                    className="h-4 w-4 rounded border-tan text-gold focus:ring-gold"
                  />
                  <span className="text-sm font-medium text-ink">Build Crew</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editStrikeCrew}
                    onChange={(e) => setEditStrikeCrew(e.target.checked)}
                    className="h-4 w-4 rounded border-tan text-gold focus:ring-gold"
                  />
                  <span className="text-sm font-medium text-ink">Strike Crew</span>
                </label>
              </div>

              {/* Special Requests */}
              <div>
                <label className="form-label">Special Requests</label>
                <textarea
                  value={editSpecialRequests}
                  onChange={(e) => setEditSpecialRequests(e.target.value)}
                  rows={3}
                  className="form-input"
                  placeholder="Any special requests or notes..."
                />
              </div>

              {/* Save */}
              <div className="flex justify-end">
                <button
                  onClick={saveSeasonData}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Season Data
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="luxury-card p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-display-thin text-lg text-ink">
              Payment History
            </h2>
            {activeSeasonMember && (
              <button
                onClick={() => setShowRecordPayment(!showRecordPayment)}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage-700 transition-colors flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Record Payment
              </button>
            )}
          </div>

          {/* Record Payment Form */}
          <AnimatePresence>
            {showRecordPayment && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border border-tan/30 rounded-xl p-4 space-y-4 overflow-hidden"
              >
                <h3 className="text-sm font-medium text-ink">New Payment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Type</label>
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value)}
                      className="form-input"
                    >
                      <option value="DUES">Dues</option>
                      <option value="GRID">Grid</option>
                      <option value="FOOD">Food</option>
                      <option value="RV_VOUCHER">RV Voucher</option>
                      <option value="BEER_FUND">Beer Fund</option>
                      <option value="TENT">Tent</option>
                      <option value="TICKET">Ticket</option>
                      <option value="FUNDRAISING">Fundraising</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="form-input"
                    >
                      <option value="VENMO">Venmo</option>
                      <option value="ZELLE">Zelle</option>
                      <option value="CASH">Cash</option>
                      <option value="ACH">ACH / Bank</option>
                      <option value="CARD">Card</option>
                      <option value="PAYPAL">PayPal</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Notes</label>
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Optional notes"
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowRecordPayment(false)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-ink-soft border border-tan/40 hover:bg-cream transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRecordPayment}
                    disabled={recordingPayment || !paymentAmount}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {recordingPayment && <Loader2 className="h-4 w-4 animate-spin" />}
                    Record
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Payments Table */}
          {payments.length === 0 ? (
            <div className="text-center py-10">
              <CreditCard className="h-10 w-10 text-ink-soft/30 mx-auto mb-3" />
              <p className="text-sm text-ink-soft">
                No payments recorded for this member.
              </p>
            </div>
          ) : (
            <>
              {/* Payment Summary */}
              <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-cream border border-tan/20">
                <div>
                  <p className="text-xs font-medium text-ink-soft uppercase tracking-wider">Total Paid</p>
                  <p className="text-lg font-semibold text-ink tabular-nums">
                    {(payments.reduce((sum, p) => sum + p.amount, 0) / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-soft uppercase tracking-wider">Payments</p>
                  <p className="text-lg font-semibold text-ink tabular-nums">{payments.length}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-sage/10">
                      <th className="text-left py-3 px-2 text-xs font-medium text-ink-soft uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-ink-soft uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-ink-soft uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-ink-soft uppercase tracking-wider">
                        Method
                      </th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-ink-soft uppercase tracking-wider hidden sm:table-cell">
                        Notes
                      </th>
                      <th className="text-right py-3 px-2">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-sage/5 hover:bg-sage/[0.03] transition-colors"
                      >
                        <td className="py-3 px-2 text-ink-soft">
                          {new Date(payment.paidAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center rounded-md bg-sage/5 px-2 py-0.5 text-xs font-medium text-sage">
                            {payment.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-ink font-medium tabular-nums">
                          {(payment.amount / 100).toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          })}
                        </td>
                        <td className="py-3 px-2 text-ink-soft">
                          {payment.method}
                        </td>
                        <td className="py-3 px-2 text-ink-soft text-xs hidden sm:table-cell">
                          {payment.notes || '\u2014'}
                        </td>
                        <td className="py-3 px-2 text-right whitespace-nowrap">
                          {payment.processor ? (
                            <span
                              className="inline-flex items-center text-ink-soft/40"
                              title="Recorded by a payment processor \u2014 locked"
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <button
                                onClick={() => setEditingPayment(payment)}
                                className="rounded-md p-1.5 text-ink-soft hover:text-gold hover:bg-cream transition-colors"
                                title="Edit payment"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingPayment(payment)}
                                className="rounded-md p-1.5 text-ink-soft hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete payment"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="luxury-card p-6 space-y-6"
        >
          <h2 className="text-display-thin text-lg text-ink">
            Personal Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Phone number"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Playa Name</label>
              <input
                type="text"
                value={editPlayaName}
                onChange={(e) => setEditPlayaName(e.target.value)}
                placeholder="Playa name"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Gender</label>
              <select
                value={editGender}
                onChange={(e) => setEditGender(e.target.value)}
                className="form-input"
              >
                <option value="">Not specified</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="NON_BINARY">Non-binary</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="border-t border-tan/30 pt-6">
            <h3 className="text-sm font-medium text-ink mb-4 flex items-center gap-2">
              <Phone className="h-4 w-4 text-gold" />
              Emergency Contact
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Contact Name</label>
                <input
                  type="text"
                  value={editEmergencyName}
                  onChange={(e) => setEditEmergencyName(e.target.value)}
                  placeholder="Emergency contact name"
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Contact Phone</label>
                <input
                  type="tel"
                  value={editEmergencyPhone}
                  onChange={(e) => setEditEmergencyPhone(e.target.value)}
                  placeholder="Emergency contact phone"
                  className="form-input"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">Dietary Restrictions</label>
            <input
              type="text"
              value={editDietary}
              onChange={(e) => setEditDietary(e.target.value)}
              placeholder="e.g., Vegetarian, Vegan, Gluten-free"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Food Allergies</label>
            <input
              type="text"
              value={editAllergies}
              onChange={(e) => setEditAllergies(e.target.value)}
              placeholder="Safety-critical: e.g., Nuts, Shellfish, Dairy"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Admin Notes</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={4}
              className="form-input"
              placeholder="Internal notes about this member..."
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveProfileData}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Profile
            </button>
          </div>
        </motion.div>
      )}

      {/* Season History */}
      {member.seasonMembers && member.seasonMembers.length > 1 && activeTab === 'season' && (
        <div className="luxury-card p-6">
          <h2 className="text-display-thin text-lg text-ink mb-4">
            Season History
          </h2>
          <div className="space-y-2">
            {member.seasonMembers.map((sm) => (
              <div
                key={sm.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  sm.season.isActive
                    ? 'border-gold/30 bg-gold/5'
                    : 'border-tan/20 bg-cream/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-ink-soft" />
                  <div>
                    <p className="text-sm font-medium text-ink">{sm.season.name}</p>
                    {sm.season.isActive && (
                      <span className="text-xs text-gold font-medium">Current Season</span>
                    )}
                  </div>
                </div>
                <StatusBadge status={sm.status} variant="season" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change Role Dialog */}
      <ConfirmDialog
        open={showRoleDialog}
        onClose={() => setShowRoleDialog(false)}
        onConfirm={handleChangeRole}
        title="Change Member Role"
        message={`Are you sure you want to change ${member.name}'s role to ${pendingRole}? This will affect their access permissions.`}
        confirmLabel={`Set as ${pendingRole}`}
        variant="warning"
      />

      {/* Edit Payment Modal */}
      <PaymentEditModal
        payment={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSave={async (input) => {
          await updatePayment(input);
          showSaveNotification('Payment updated.', 'success');
          loadMember();
        }}
      />

      {/* Delete Payment Dialog */}
      <ConfirmDialog
        open={!!deletingPayment}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDeletePayment}
        title="Delete Payment"
        message={`Delete this ${deletingPayment ? (deletingPayment.amount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : ''} ${deletingPayment?.type.replace(/_/g, ' ') ?? ''} payment? This removes the ledger entry permanently. If it was the member's only dues payment, their dues status flips back to unpaid.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Deactivate Dialog */}
      <ConfirmDialog
        open={showDeactivateDialog}
        onClose={() => setShowDeactivateDialog(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Member"
        message={`Are you sure you want to deactivate ${member.name}? They will no longer be able to access the member portal. This action can be reversed.`}
        confirmLabel="Deactivate"
        variant="danger"
      />
    </motion.div>
  );
}
